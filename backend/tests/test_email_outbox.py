import json
from threading import Event, Thread
from types import SimpleNamespace

import pytest

from app import create_app
from database.connection import cursor_for, get_connection_context
from models.email_outbox_model import EmailOutboxModel
from services.email_outbox_worker import _health_check, processar_proxima
from utils.email_token_cipher import decrypt_recovery_token


@pytest.fixture()
def client():
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()


def _criar_solicitacao_recuperacao(client, email):
    cadastro = client.post(
        "/api/auth/cadastro",
        json={"nome": "Teste Outbox", "email": email, "senha": "SenhaSegura123!"},
    )
    assert cadastro.status_code == 201
    resposta = client.post("/api/auth/esqueci-senha", json={"email": email})
    assert resposta.status_code == 200
    return resposta.get_json()["data"]["token_teste"]


def _outbox_row():
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT id, recuperacao_token_id, email_destino, token_cifrado,
                       status, tentativas
                FROM password_reset_email_outbox
                ORDER BY id DESC
                LIMIT 1
                """
            )
            return cursor.fetchone()
        finally:
            cursor.close()


def _outbox_by_id(outbox_id):
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT id, recuperacao_token_id, email_destino, token_cifrado,
                       status, tentativas
                FROM password_reset_email_outbox
                WHERE id = ?
                """,
                (outbox_id,),
            )
            return cursor.fetchone()
        finally:
            cursor.close()


def test_recovery_request_persists_encrypted_token_in_outbox(client):
    token = _criar_solicitacao_recuperacao(
        client, "recovery-outbox@example.com"
    )

    row = _outbox_row()

    assert row["status"] == "pending"
    assert row["email_destino"] == "recovery-outbox@example.com"
    assert token not in row["token_cifrado"]
    assert decrypt_recovery_token(row["token_cifrado"]) == token


def test_new_recovery_request_cancels_superseded_email(client):
    email = "recovery-superseded@example.com"
    _criar_solicitacao_recuperacao(client, email)
    primeira = _outbox_row()

    resposta = client.post("/api/auth/esqueci-senha", json={"email": email})
    assert resposta.status_code == 200

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT status, token_cifrado
                FROM password_reset_email_outbox
                WHERE id = ?
                """,
                (primeira["id"],),
            )
            substituida = cursor.fetchone()
            cursor.execute(
                """
                SELECT status
                FROM password_reset_email_outbox
                ORDER BY id DESC
                LIMIT 1
                """
            )
            atual = cursor.fetchone()
        finally:
            cursor.close()

    assert substituida["status"] == "cancelled"
    assert substituida["token_cifrado"] is None
    assert atual["status"] == "pending"


def test_new_recovery_request_waits_for_inflight_email_dispatch(
    client, monkeypatch
):
    email = "recovery-inflight@example.com"
    token = _criar_solicitacao_recuperacao(client, email)
    primeira = _outbox_row()
    smtp_started = Event()
    finish_smtp = Event()
    request_started = Event()
    request_finished = Event()
    sent = []
    worker_results = []
    request_results = []
    thread_errors = []

    def send_recovery_email(destination, recovery_token):
        sent.append((destination, recovery_token))
        smtp_started.set()
        if not finish_smtp.wait(timeout=10):
            raise TimeoutError("Test did not release the mocked SMTP call.")
        return True

    def run_worker():
        try:
            worker_results.append(processar_proxima())
        except Exception as error:
            thread_errors.append(error)

    def request_another_recovery():
        request_started.set()
        try:
            with create_app().test_client() as request_client:
                request_results.append(
                    request_client.post(
                        "/api/auth/esqueci-senha",
                        json={"email": email},
                    )
                )
        except Exception as error:
            thread_errors.append(error)
        finally:
            request_finished.set()

    monkeypatch.setattr(
        "services.email_outbox_worker.EmailService.enviar_recuperacao_senha",
        send_recovery_email,
    )
    worker = Thread(target=run_worker)
    worker.start()
    assert smtp_started.wait(timeout=5)

    new_request = Thread(target=request_another_recovery)
    new_request.start()
    assert request_started.wait(timeout=5)
    try:
        assert not request_finished.wait(timeout=0.2)
    finally:
        finish_smtp.set()
        worker.join(timeout=5)
        new_request.join(timeout=5)

    assert not worker.is_alive()
    assert not new_request.is_alive()
    assert thread_errors == []
    assert worker_results == [True]
    assert request_results[0].status_code == 200
    assert sent == [(email, token)]
    assert _outbox_by_id(primeira["id"])["status"] == "sent"
    assert _outbox_row()["status"] == "pending"


def test_recovery_token_and_outbox_roll_back_together(client, monkeypatch):
    from models.email_outbox_model import EmailOutboxModel as OutboxModel

    original = OutboxModel.enfileirar

    def fail_after_enqueue(*args):
        original(*args)
        raise RuntimeError("simulated outbox failure")

    monkeypatch.setattr(OutboxModel, "enfileirar", staticmethod(fail_after_enqueue))
    client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Teste Transação",
            "email": "recovery-rollback@example.com",
            "senha": "SenhaSegura123!",
        },
    )

    with pytest.raises(RuntimeError, match="simulated outbox failure"):
        client.post(
            "/api/auth/esqueci-senha",
            json={"email": "recovery-rollback@example.com"},
        )

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT COUNT(*) AS total
                FROM recuperacao_tokens r
                JOIN usuarios u ON u.id = r.usuario_id
                WHERE u.email = ?
                """,
                ("recovery-rollback@example.com",),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM password_reset_email_outbox"
            )
            assert cursor.fetchone()["total"] == 0
        finally:
            cursor.close()


def test_worker_recovers_stale_reservation_after_process_restart(
    client, monkeypatch
):
    token = _criar_solicitacao_recuperacao(
        client, "recovery-crash@example.com"
    )
    row = _outbox_row()
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                UPDATE password_reset_email_outbox
                SET status = 'processing',
                    tentativas = 1,
                    reservado_em = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 600 SECOND)
                WHERE id = ?
                """,
                (row["id"],),
            )
            connection.commit()
        finally:
            cursor.close()

    enviados = []
    monkeypatch.setattr(
        "services.email_outbox_worker.EmailService.enviar_recuperacao_senha",
        lambda email, recovery_token: (
            enviados.append((email, recovery_token)) or True
        ),
    )

    assert processar_proxima()

    atualizado = _outbox_row()
    assert enviados == [("recovery-crash@example.com", token)]
    assert atualizado["status"] == "sent"
    assert atualizado["tentativas"] == 2
    assert atualizado["token_cifrado"] is None


def test_expired_recovery_email_fails_without_sending_or_reprocessing(
    client, monkeypatch, caplog
):
    _criar_solicitacao_recuperacao(client, "recovery-expired@example.com")
    row = _outbox_row()
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                UPDATE recuperacao_tokens
                SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)
                WHERE id = ?
                """,
                (row["recuperacao_token_id"],),
            )
            connection.commit()
        finally:
            cursor.close()
    monkeypatch.setattr(
        "services.email_outbox_worker.EmailService.enviar_recuperacao_senha",
        lambda *_args: pytest.fail("Expired recovery links must not be sent."),
    )

    assert processar_proxima()

    expirado = _outbox_row()
    assert expirado["status"] == "failed"
    assert expirado["token_cifrado"] is None
    assert EmailOutboxModel.reprocessar_falhos(row["id"]) == 0
    assert "token expirou antes do envio" in caplog.text


def test_smtp_failure_backoff_health_alert_and_manual_reprocessing(
    client, monkeypatch, caplog, capsys
):
    _criar_solicitacao_recuperacao(client, "recovery-retry@example.com")
    row = _outbox_row()
    monkeypatch.setattr(
        "services.email_outbox_worker.EmailService.enviar_recuperacao_senha",
        lambda *_args: False,
    )

    assert processar_proxima(max_tentativas=2)
    primeira_falha = _outbox_row()
    assert primeira_falha["status"] == "pending"
    assert primeira_falha["tentativas"] == 1

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT disponivel_em > CURRENT_TIMESTAMP AS backoff_ativo
                FROM password_reset_email_outbox WHERE id = ?
                """,
                (row["id"],),
            )
            assert cursor.fetchone()["backoff_ativo"] == 1
            cursor.execute(
                """
                UPDATE password_reset_email_outbox
                SET disponivel_em = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)
                WHERE id = ?
                """,
                (row["id"],),
            )
            connection.commit()
        finally:
            cursor.close()

    assert processar_proxima(max_tentativas=2)
    falha_final = _outbox_row()
    assert falha_final["status"] == "failed"
    assert falha_final["tentativas"] == 2

    resultado = _health_check(
        SimpleNamespace(
            max_pending_count=100,
            max_pending_age_seconds=300,
            max_failed_count=0,
            heartbeat_max_age_seconds=15,
        )
    )
    assert resultado == 1
    assert json.loads(capsys.readouterr().out)["queue"]["failed"] == 1
    assert "falhou permanentemente" in caplog.text

    assert EmailOutboxModel.reprocessar_falhos(row["id"]) == 1
    monkeypatch.setattr(
        "services.email_outbox_worker.EmailService.enviar_recuperacao_senha",
        lambda *_args: True,
    )
    assert processar_proxima()
    assert _outbox_row()["status"] == "sent"

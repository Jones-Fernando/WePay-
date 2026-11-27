import json
import sys
from types import SimpleNamespace

from contextlib import contextmanager

import pytest

from services import email_outbox_worker


@contextmanager
def _token_lock(token):
    yield token


_SNAPSHOT = {
    "pending": 0,
    "processing": 0,
    "failed": 0,
    "sent": 0,
    "cancelled": 0,
    "oldest_pending_age_seconds": 0,
    "stale_processing": 0,
}


def _args(**overrides):
    values = {
        "max_pending_count": 100,
        "max_pending_age_seconds": 300,
        "max_failed_count": 0,
        "heartbeat_max_age_seconds": 15,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_health_check_uses_heartbeat_and_reports_queue_status(
    monkeypatch, tmp_path, capsys
):
    heartbeat = tmp_path / "worker" / "heartbeat"
    monkeypatch.setenv("EMAIL_OUTBOX_HEARTBEAT_FILE", str(heartbeat))
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "health_snapshot",
        staticmethod(lambda _timeout: _SNAPSHOT),
    )
    email_outbox_worker._write_heartbeat()

    assert email_outbox_worker._health_check(_args()) == 0
    result = json.loads(capsys.readouterr().out)
    assert result["status"] == "ok"
    assert result["checks"]["heartbeat"] is True


def test_health_check_fails_when_heartbeat_is_missing(
    monkeypatch, tmp_path, capsys
):
    monkeypatch.setenv(
        "EMAIL_OUTBOX_HEARTBEAT_FILE",
        str(tmp_path / "missing-heartbeat"),
    )
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "health_snapshot",
        staticmethod(lambda _timeout: _SNAPSHOT),
    )

    assert email_outbox_worker._health_check(_args()) == 1
    result = json.loads(capsys.readouterr().out)
    assert result["checks"]["heartbeat"] is False


def test_process_returns_false_when_outbox_is_empty(monkeypatch):
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "reivindicar_proxima",
        staticmethod(lambda *_args: None),
    )

    assert email_outbox_worker.processar_proxima() is False


def test_process_marks_used_token_as_cancelled_without_sending(
    monkeypatch,
):
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "reivindicar_proxima",
        staticmethod(
            lambda *_args: {
                "id": 3,
                "recuperacao_token_id": 8,
                "email_destino": "user@example.com",
                "token_cifrado": "encrypted",
                "tentativas": 1,
            }
        ),
    )
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "bloquear_token_para_envio",
        staticmethod(
            lambda _token_id: _token_lock(
                {
                    "usado_em": "2026-01-01 00:00:00",
                    "nao_expirado": 1,
                }
            )
        ),
    )
    cancelled = []
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "marcar_token_indisponivel",
        staticmethod(lambda outbox_id, expired: cancelled.append((outbox_id, expired)) or True),
    )
    monkeypatch.setattr(
        email_outbox_worker.EmailService,
        "enviar_recuperacao_senha",
        staticmethod(lambda *_args: pytest.fail("Used token must not be sent.")),
    )

    assert email_outbox_worker.processar_proxima()
    assert cancelled == [(3, False)]


@pytest.mark.parametrize(
    ("token", "max_attempts", "expected_level"),
    [
        (None, 1, "permanent"),
        ({"usado_em": None, "nao_expirado": 1}, 2, "retry"),
    ],
)
def test_process_records_invalid_outbox_payload(
    monkeypatch, caplog, token, max_attempts, expected_level
):
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "reivindicar_proxima",
        staticmethod(
            lambda *_args: {
                "id": 4,
                "recuperacao_token_id": 9,
                "email_destino": "user@example.com",
                "token_cifrado": None if token else "encrypted",
                "tentativas": (
                    max_attempts if expected_level == "permanent" else 1
                ),
            }
        ),
    )
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "bloquear_token_para_envio",
        staticmethod(lambda _token_id: _token_lock(token)),
    )
    failures = []
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "registrar_falha",
        staticmethod(lambda *args: failures.append(args) or True),
    )

    assert email_outbox_worker.processar_proxima(max_attempts)
    assert len(failures) == 1
    if expected_level == "permanent":
        assert "falhou permanentemente" in caplog.text
    else:
        assert "Falha ao processar e-mail de recuperação" in caplog.text


@pytest.mark.parametrize(
    ("arguments", "retry_result", "expected"),
    [
        (["--retry-failed", "42"], 1, 0),
        (["--retry-failed", "42"], 0, 1),
        (["--retry-all-failed"], 3, 0),
    ],
)
def test_cli_reprocessing_commands(monkeypatch, capsys, arguments, retry_result, expected):
    monkeypatch.setattr(sys, "argv", ["email_outbox_worker", *arguments])
    monkeypatch.setattr(
        email_outbox_worker.EmailOutboxModel,
        "reprocessar_falhos",
        staticmethod(lambda *_args: retry_result),
    )

    assert email_outbox_worker.main() == expected
    captured = capsys.readouterr()
    assert json.loads(captured.out)["reprocessados"] == retry_result


def test_cli_health_check_and_once_modes(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["email_outbox_worker", "--health-check"])
    monkeypatch.setattr(
        email_outbox_worker,
        "_health_check",
        lambda _args: 7,
    )
    assert email_outbox_worker.main() == 7

    monkeypatch.setattr(sys, "argv", ["email_outbox_worker", "--once"])
    monkeypatch.setattr(
        email_outbox_worker, "processar_proxima", lambda: False
    )
    assert email_outbox_worker.main() == 0


@pytest.mark.parametrize(
    "arguments",
    [
        ["--poll-seconds", "0"],
        ["--max-failed-count", "-1"],
        ["--retry-failed", "0"],
    ],
)
def test_cli_rejects_invalid_values(monkeypatch, arguments):
    monkeypatch.setattr(sys, "argv", ["email_outbox_worker", *arguments])

    with pytest.raises(SystemExit):
        email_outbox_worker.main()

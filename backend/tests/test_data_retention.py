import re
from contextlib import contextmanager

from database.connection import cursor_for, get_connection_context
from models import data_retention_model
from models.data_retention_model import DataRetentionModel, RETENTION_RULES


class FakeConnection:
    def __init__(self, row_counts=None, select_count=0):
        self.row_counts = row_counts or {}
        self.select_count = select_count
        self.statements = []
        self.commits = 0
        self.rowcount = 0
        self.result = None
        self.description = None

    def cursor(self):
        return self

    def execute(self, query, params=None):
        self.statements.append((query, params))
        if query.lstrip().startswith("SELECT COUNT(*)"):
            self.result = {"total": self.select_count}
            self.description = (("total",),)
            return

        match = re.search(r"DELETE FROM (\w+)", query)
        if match:
            table = match.group(1)
            batches = self.row_counts.get(table, [])
            self.rowcount = batches.pop(0) if batches else 0

    def fetchone(self):
        return self.result

    def close(self):
        pass

    def commit(self):
        self.commits += 1


def install_fake_connection(monkeypatch, connection):
    @contextmanager
    def get_connection_context():
        yield connection

    monkeypatch.setattr(
        data_retention_model,
        "get_connection_context",
        get_connection_context,
    )
    monkeypatch.setattr(
        data_retention_model,
        "cursor_for",
        lambda _connection: connection,
    )


def test_data_retention_dry_run_counts_without_deleting(monkeypatch):
    connection = FakeConnection(select_count=4)
    install_fake_connection(monkeypatch, connection)

    counts = DataRetentionModel.limpar_registros_expirados(dry_run=True)

    assert counts == {table: 4 for table, _condition in RETENTION_RULES}
    assert connection.commits == 0
    assert len(connection.statements) == len(RETENTION_RULES)
    assert all(
        query.lstrip().startswith("SELECT COUNT(*)")
        for query, _params in connection.statements
    )


def test_data_retention_deletes_in_bounded_batches_and_keeps_failed_pushes(
    monkeypatch,
):
    connection = FakeConnection(row_counts={"push_outbox": [2, 1]})
    install_fake_connection(monkeypatch, connection)

    counts = DataRetentionModel.limpar_registros_expirados(batch_size=2)

    assert counts["push_outbox"] == 3
    assert all(counts[table] == 0 for table, _ in RETENTION_RULES if table != "push_outbox")
    delete_queries = [
        query for query, _params in connection.statements
        if query.lstrip().startswith("DELETE")
    ]
    assert all("ORDER BY id" in query and "LIMIT ?" in query for query in delete_queries)
    push_rule = dict(RETENTION_RULES)["push_outbox"]
    assert "status = 'sent'" in push_rule
    assert "failed" not in push_rule
    assert connection.commits == 2


def _insert_user(cursor, email):
    cursor.execute(
        "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
        (email, email, "test-hash"),
    )
    return cursor.lastrowid


def _timestamp_days_ago(days):
    return f"DATE_SUB(CURRENT_TIMESTAMP, INTERVAL {days} DAY)"


def _insert_notification_and_outbox(cursor, usuario_id, status, sent_days_ago):
    cursor.execute(
        "INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem) "
        "VALUES (?, ?, ?, ?)",
        (usuario_id, "retention-test", "Retention test", "Retention test"),
    )
    notificacao_id = cursor.lastrowid
    sent_at = (
        _timestamp_days_ago(sent_days_ago)
        if sent_days_ago is not None
        else "NULL"
    )
    cursor.execute(
        "INSERT INTO push_outbox (notificacao_id, status, enviado_em) "
        f"VALUES (?, ?, {sent_at})",
        (notificacao_id, status),
    )
    outbox_id = cursor.lastrowid
    cursor.execute(
        "INSERT INTO push_outbox_destinatarios (outbox_id, token) VALUES (?, ?)",
        (outbox_id, f"push-token-{outbox_id}"),
    )
    return outbox_id


def test_data_retention_applies_real_mysql_deadlines_and_outbox_cascade():
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            owner_id = _insert_user(cursor, "retention-owner@example.com")
            cursor.execute(
                "INSERT INTO grupos (nome, criado_por) VALUES (?, ?)",
                ("Retention test group", owner_id),
            )
            group_id = cursor.lastrowid

            for token_hash, days_ago in (
                ("1" * 64, 31),
                ("b" * 64, 31),
                ("2" * 64, 29),
            ):
                cursor.execute(
                    "INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at) "
                    f"VALUES (?, ?, {_timestamp_days_ago(days_ago)})",
                    (owner_id, token_hash),
                )

            for jti, days_ago in (
                ("00000000-0000-0000-0000-000000000001", 31),
                ("00000000-0000-0000-0000-000000000002", 29),
            ):
                cursor.execute(
                    "INSERT INTO revoked_tokens (jti, token_type, expires_at) "
                    f"VALUES (?, 'access', {_timestamp_days_ago(days_ago)})",
                    (jti,),
                )

            recovery_records = (
                ("3" * 64, 31, None),
                ("4" * 64, 31, 31),
                ("5" * 64, 31, 29),
                ("6" * 64, 29, None),
            )
            for token_hash, expiration_days, used_days in recovery_records:
                used_at = (
                    _timestamp_days_ago(used_days)
                    if used_days is not None
                    else "NULL"
                )
                cursor.execute(
                    "INSERT INTO recuperacao_tokens "
                    "(usuario_id, token_hash, expires_at, usado_em) "
                    f"VALUES (?, ?, {_timestamp_days_ago(expiration_days)}, {used_at})",
                    (owner_id, token_hash),
                )

            invite_records = (
                ("7" * 64, 91, None),
                ("8" * 64, 91, 91),
                ("9" * 64, 91, 89),
                ("a" * 64, 89, None),
            )
            for token_hash, expiration_days, used_days in invite_records:
                used_at = (
                    _timestamp_days_ago(used_days)
                    if used_days is not None
                    else "NULL"
                )
                cursor.execute(
                    "INSERT INTO convites_grupo "
                    "(grupo_id, email, token_hash, expires_at, usado_em, criado_por) "
                    f"VALUES (?, ?, ?, {_timestamp_days_ago(expiration_days)}, {used_at}, ?)",
                    (
                        group_id,
                        f"{token_hash[:8]}@example.com",
                        token_hash,
                        owner_id,
                    ),
                )

            outbox_ids = {
                (status, days_ago): _insert_notification_and_outbox(
                    cursor, owner_id, status, days_ago
                )
                for status, days_ago in (
                    ("sent", 91),
                    ("sent", 89),
                    ("failed", 91),
                    ("pending", 91),
                    ("processing", 91),
                )
            }
            connection.commit()
        finally:
            cursor.close()

    dry_run_counts = DataRetentionModel.limpar_registros_expirados(
        dry_run=True
    )
    assert dry_run_counts == {
        "refresh_tokens": 2,
        "revoked_tokens": 1,
        "recuperacao_tokens": 2,
        "convites_grupo": 2,
        "push_outbox": 1,
    }

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            for table, expected_count in (
                ("refresh_tokens", 3),
                ("revoked_tokens", 2),
                ("recuperacao_tokens", 4),
                ("convites_grupo", 4),
                ("push_outbox", 5),
                ("push_outbox_destinatarios", 5),
            ):
                cursor.execute(f"SELECT COUNT(*) AS total FROM {table}")
                assert cursor.fetchone()["total"] == expected_count
        finally:
            cursor.close()

    deleted_counts = DataRetentionModel.limpar_registros_expirados(batch_size=1)
    assert deleted_counts == dry_run_counts

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            for table, expected_count in (
                ("refresh_tokens", 1),
                ("revoked_tokens", 1),
                ("recuperacao_tokens", 2),
                ("convites_grupo", 2),
                ("push_outbox", 4),
                ("push_outbox_destinatarios", 4),
            ):
                cursor.execute(f"SELECT COUNT(*) AS total FROM {table}")
                assert cursor.fetchone()["total"] == expected_count

            cursor.execute("SELECT token_hash FROM refresh_tokens")
            assert {row["token_hash"] for row in cursor.fetchall()} == {"2" * 64}

            cursor.execute("SELECT jti FROM revoked_tokens")
            assert {
                row["jti"] for row in cursor.fetchall()
            } == {"00000000-0000-0000-0000-000000000002"}

            cursor.execute("SELECT token_hash FROM recuperacao_tokens")
            assert {row["token_hash"] for row in cursor.fetchall()} == {
                "5" * 64,
                "6" * 64,
            }

            cursor.execute("SELECT token_hash FROM convites_grupo")
            assert {row["token_hash"] for row in cursor.fetchall()} == {
                "9" * 64,
                "a" * 64,
            }

            cursor.execute(
                "SELECT COUNT(*) AS total FROM push_outbox_destinatarios "
                "WHERE outbox_id = ?",
                (outbox_ids[("sent", 91)],),
            )
            assert cursor.fetchone()["total"] == 0

            cursor.execute(
                "SELECT status, COUNT(*) AS total FROM push_outbox "
                "GROUP BY status"
            )
            remaining_statuses = {
                row["status"]: row["total"] for row in cursor.fetchall()
            }
            assert remaining_statuses == {
                "failed": 1,
                "pending": 1,
                "processing": 1,
                "sent": 1,
            }
        finally:
            cursor.close()

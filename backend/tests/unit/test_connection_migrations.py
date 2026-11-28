from types import SimpleNamespace
from typing import Any

import pytest

import database.connection as database_connection
from database.connection import (
    _apply_auth_version_migration,
    _apply_account_anonymization_migration,
    _apply_email_login_migration,
    _apply_user_updated_timestamp_migration,
    _apply_created_timestamp_migration,
    _apply_group_updated_timestamp_migration,
    _apply_group_icon_migration,
    _apply_group_cover_icon_preferences_migration,
    _apply_schema_varchar_width_migrations,
    _apply_user_avatar_migration,
    _apply_user_pix_key_migration,
    _apply_notification_preferences_migration,
    _apply_notification_reference_migration,
    _apply_notification_timestamp_migration,
    _apply_group_expense_observation_migration,
    _apply_group_expense_creator_migration,
    _apply_push_outbox_destination_migration,
    _apply_push_outbox_retention_migration,
    _apply_gemini_usage_user_index_migration,
    _apply_payment_idempotency_migration,
    _apply_categoria_migration,
    _apply_user_categories_migration,
    _apply_participantes_migration,
    _apply_saldos_migration,
)
from database.legacy_finance_migrations import apply_legacy_finance_migrations


class FakeCursor:
    def __init__(
        self,
        columns: dict[str, dict[str, str]] | None = None,
        indexes: dict[str, list[tuple[Any, ...]]] | None = None,
        foreign_keys: dict[tuple[str, str], list[str]] | None = None,
        counts: list[int] | None = None,
    ) -> None:
        self.columns = columns if columns is not None else {}
        self.indexes = indexes if indexes is not None else {}
        self.foreign_keys = foreign_keys if foreign_keys is not None else {}
        self.counts = list(counts) if counts is not None else []
        self.result: list[Any] = []
        self.statements = []

    def execute(self, operation: str, params: Any = None) -> None:
        self.statements.append((operation, params))
        if operation.startswith("SHOW COLUMNS FROM"):
            table = operation.split("`")[1]
            self.result = [
                (name, column_type, "NO", None, None, "")
                for name, column_type in self.columns[table].items()
            ]
        elif operation.startswith("SHOW INDEX FROM"):
            table = operation.split("`")[1]
            self.result = self.indexes.get(table, [])
        elif "information_schema.KEY_COLUMN_USAGE" in operation:
            table, column = params
            self.result = [
                (name,) for name in self.foreign_keys.get((table, column), [])
            ]
        else:
            self.result = []

    def fetchall(self) -> list[Any]:
        return self.result

    def fetchone(self) -> tuple[int]:
        return (self.counts.pop(0) if self.counts else 0,)


def test_database_connections_use_a_shared_resetting_pool(monkeypatch):
    class FakePool:
        instances = []

        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self.connections = []
            self.__class__.instances.append(self)

        def get_connection(self):
            connection = object()
            self.connections.append(connection)
            return connection

    monkeypatch.setattr(database_connection, "_connection_pool", None)
    monkeypatch.setattr(
        database_connection,
        "mysql_connector",
        SimpleNamespace(
            pooling=SimpleNamespace(MySQLConnectionPool=FakePool),
            connect=lambda **kwargs: kwargs,
        ),
    )

    first = database_connection._connect_mysql(database_connection.Config.DB_NAME)
    second = database_connection._connect_mysql(database_connection.Config.DB_NAME)

    assert first is not second
    assert len(FakePool.instances) == 1
    assert FakePool.instances[0].kwargs["pool_size"] == database_connection.Config.DB_POOL_SIZE
    assert FakePool.instances[0].kwargs["pool_reset_session"] is True
    assert len(FakePool.instances[0].connections) == 2


def test_server_level_database_connection_remains_unpooled(monkeypatch):
    connected = []
    monkeypatch.setattr(
        database_connection,
        "mysql_connector",
        SimpleNamespace(
            pooling=SimpleNamespace(MySQLConnectionPool=object),
            connect=lambda **kwargs: connected.append(kwargs) or "direct",
        ),
    )

    assert database_connection._connect_mysql() == "direct"
    assert connected == [
        {
            "host": database_connection.Config.DB_HOST,
            "port": database_connection.Config.DB_PORT,
            "user": database_connection.Config.DB_USER,
            "password": database_connection.Config.DB_PASSWORD,
        }
    ]


def test_ensure_mysql_database_does_not_create_an_existing_database(monkeypatch):
    class Cursor:
        def __init__(self):
            self.statements = []

        def execute(self, statement, params=None):
            self.statements.append((statement, params))

        def fetchone(self):
            return ("wepay_db",)

        def close(self):
            pass

    class Connection:
        def __init__(self):
            self.cursor_instance = Cursor()
            self.committed = False
            self.closed = False

        def cursor(self):
            return self.cursor_instance

        def commit(self):
            self.committed = True

        def close(self):
            self.closed = True

    connection = Connection()
    monkeypatch.setattr(
        database_connection,
        "_connect_mysql",
        lambda: connection,
    )
    monkeypatch.setattr(database_connection.Config, "DB_NAME", "wepay_db")

    database_connection._ensure_mysql_database()

    assert connection.cursor_instance.statements == [
        (
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA "
            "WHERE SCHEMA_NAME = %s",
            ("wepay_db",),
        )
    ]
    assert not connection.committed
    assert connection.closed


@pytest.mark.parametrize("environment", ["production", "migration"])
def test_secure_database_connections_verify_ca_and_identity(
    monkeypatch, environment
):
    connected = []
    monkeypatch.setattr(database_connection, "_connection_pool", None)
    monkeypatch.setattr(database_connection.Config, "ENVIRONMENT", environment)
    monkeypatch.setattr(database_connection.Config, "DB_SSL_CA", "C:\\certs\\mysql-ca.pem")
    monkeypatch.setattr(
        database_connection,
        "mysql_connector",
        SimpleNamespace(
            pooling=SimpleNamespace(
                MySQLConnectionPool=lambda **kwargs: connected.append(kwargs)
                or SimpleNamespace(get_connection=lambda: "pooled")
            ),
            connect=lambda **kwargs: connected.append(kwargs) or "direct",
        ),
    )

    assert database_connection._connect_mysql() == "direct"
    assert database_connection._connect_mysql("wepay_db") == "pooled"

    expected_tls = {
        "ssl_ca": "C:\\certs\\mysql-ca.pem",
        "ssl_verify_cert": True,
        "ssl_verify_identity": True,
    }
    assert all(
        {key: params[key] for key in expected_tls} == expected_tls
        for params in connected
    )


def test_initialization_refuses_legacy_installment_tables(monkeypatch):
    class Cursor:
        def __init__(self):
            self.query = ""
            self.parameters = ()
            self.closed = False

        def execute(self, query, parameters):
            self.query = query
            self.parameters = parameters

        def fetchall(self):
            return [("parcelamentos",)]

        def close(self):
            self.closed = True

    class Connection:
        def __init__(self, cursor):
            self.cursor_instance = cursor
            self.closed = False

        def cursor(self):
            return self.cursor_instance

        def close(self):
            self.closed = True

    cursor = Cursor()
    connection = Connection(cursor)
    monkeypatch.setattr(
        database_connection,
        "_connect_mysql",
        lambda: connection,
    )
    monkeypatch.setattr(
        database_connection.Config,
        "DB_NAME",
        "wepay_production",
    )

    with pytest.raises(RuntimeError, match="tabelas legadas de parcelamento"):
        database_connection._reject_legacy_installment_removal()

    assert "information_schema.TABLES" in cursor.query
    assert cursor.parameters == (
        "wepay_production",
        *database_connection._LEGACY_INSTALLMENT_TABLES,
    )
    assert cursor.closed
    assert connection.closed


@pytest.mark.parametrize(
    "environment",
    ["development", "production", "migration"],
)
def test_non_test_initialization_preflights_before_schema_changes(
    monkeypatch, environment
):
    calls = []
    monkeypatch.setattr(
        database_connection.Config,
        "ENVIRONMENT",
        environment,
    )
    monkeypatch.setattr(
        database_connection,
        "_reject_legacy_installment_removal",
        lambda: calls.append("preflight"),
    )
    monkeypatch.setattr(
        database_connection,
        "_ensure_schema",
        lambda: calls.append("schema"),
    )
    monkeypatch.setattr(
        database_connection,
        "_apply_compatibility_migrations",
        lambda: calls.append("compatibility"),
    )
    monkeypatch.setattr(
        database_connection,
        "_record_schema_version",
        lambda: calls.append("version"),
    )

    database_connection.initialize_database()

    assert calls == ["preflight", "schema", "compatibility", "version"]


def _legacy_cursor(counts=None):
    return FakeCursor(
        columns={
            "participantes": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "usuario_id": "bigint unsigned",
                "papel": "enum('ADMIN','MEMBRO')",
                "status": "enum('ATIVO','REMOVIDO')",
                "data_entrada": "datetime",
                "data_saida": "datetime",
            },
            "saldos": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "participante_id": "bigint unsigned",
                "valor_saldo": "decimal(12,2)",
                "updated_at": "datetime",
            },
            "despesas": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "pagador_participante_id": "bigint unsigned",
                "categoria_id": "bigint unsigned",
                "valor_total": "decimal(12,2)",
                "tipo_divisao": "enum('IGUAL','PERCENTUAL','VALOR')",
                "data_despesa": "date",
                "created_by": "bigint unsigned",
                "created_at": "datetime",
                "updated_at": "datetime",
            },
            "despesa_divisoes": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "despesa_id": "bigint unsigned",
                "participante_id": "bigint unsigned",
                "percentual": "decimal(7,4)",
                "valor_devido": "decimal(12,2)",
                "created_at": "datetime",
                "updated_at": "datetime",
            },
            "pagamentos": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "pagador_participante_id": "bigint unsigned",
                "recebedor_participante_id": "bigint unsigned",
                "valor": "decimal(12,2)",
                "data_pagamento": "date",
                "metodo": "enum('PIX','DINHEIRO','TRANSFERENCIA','OUTRO')",
                "registrado_por": "bigint unsigned",
                "created_at": "datetime",
            },
        },
        indexes={
            "participantes": [
                ("participantes", 1, "idx_participantes_grupo_status", 1, "grupo_id"),
                ("participantes", 1, "idx_participantes_grupo_status", 2, "status"),
            ],
            "saldos": [
                ("saldos", 0, "uk_saldo_grupo_participante", 1, "grupo_id"),
                ("saldos", 0, "uk_saldo_grupo_participante", 2, "participante_id"),
                ("saldos", 1, "idx_saldos_grupo_valor", 1, "grupo_id"),
                ("saldos", 1, "idx_saldos_grupo_valor", 2, "valor_saldo"),
            ],
            "despesas": [],
            "despesa_divisoes": [],
            "pagamentos": [],
        },
        foreign_keys={
            ("saldos", "participante_id"): ["fk_saldos_participante"],
            ("despesas", "pagador_participante_id"): ["fk_despesas_pagador"],
            ("despesa_divisoes", "participante_id"): ["fk_divisoes_participante"],
            ("pagamentos", "pagador_participante_id"): ["fk_pagamentos_pagador"],
            ("pagamentos", "recebedor_participante_id"): [
                "fk_pagamentos_recebedor"
            ],
        },
        counts=counts,
    )


def test_email_login_migration_verifies_all_users_and_sets_verified_default():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_email_login_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN email_verificado "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )
    assert cursor.statements[2][0] == (
        "UPDATE usuarios SET email_verificado = 1 WHERE email_verificado = 0"
    )


def test_category_migration_adds_type_and_preserves_legacy_created_timestamp():
    cursor = FakeCursor(
        columns={
            "categorias": {
                "id": "bigint unsigned",
                "usuario_id": "bigint unsigned",
                "nome": "varchar(100)",
                "ativo": "tinyint(1)",
                "created_at": "datetime",
                "updated_at": "datetime",
            }
        }
    )

    _apply_categoria_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE categorias ADD COLUMN tipo "
        "ENUM('pessoal', 'grupo', 'ambos') NOT NULL DEFAULT 'ambos'"
    )
    assert cursor.statements[2][0] == (
        "ALTER TABLE categorias CHANGE COLUMN created_at criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )
    assert cursor.statements[3][0] == (
        "ALTER TABLE categorias ADD COLUMN icone "
        "VARCHAR(16) NOT NULL DEFAULT '📌'"
    )
    assert cursor.statements[4][0] == (
        "ALTER TABLE categorias ADD COLUMN origem "
        "ENUM('padrao', 'personalizada') NOT NULL DEFAULT 'personalizada'"
    )
    assert "uq_categoria_usuario_nome_tipo UNIQUE" in cursor.statements[7][0]
    assert "CREATE TABLE IF NOT EXISTS categorias_icones_usuario" in (
        cursor.statements[8][0]
    )


def test_category_migration_creates_override_table_for_current_schema():
    cursor = FakeCursor(
        columns={
            "categorias": {
                "id": "bigint unsigned",
                "usuario_id": "bigint unsigned",
                "nome": "varchar(100)",
                "tipo": "enum('pessoal','grupo','ambos')",
                "icone": "varchar(16)",
                "criado_em": "datetime",
            }
        }
    )

    _apply_categoria_migration(cursor)

    assert len(cursor.statements) == 6
    assert cursor.statements[1][0].startswith(
        "ALTER TABLE categorias ADD COLUMN origem "
    )
    assert "uq_categoria_usuario_nome_tipo UNIQUE" in cursor.statements[4][0]
    assert "CREATE TABLE IF NOT EXISTS categorias_icones_usuario" in (
        cursor.statements[5][0]
    )


def test_user_category_migration_normalizes_collations_before_name_comparisons():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "categorias_inicializadas": "tinyint(1)",
            },
            "categorias": {
                "id": "bigint unsigned",
                "usuario_id": "bigint unsigned",
                "nome": "varchar(100)",
                "icone": "varchar(16)",
                "tipo": "enum('pessoal','grupo','ambos')",
                "origem": "enum('padrao','personalizada')",
            },
            "despesas_pessoais": {
                "categoria_id": "bigint unsigned",
                "categoria": "varchar(100)",
                "usuario_id": "bigint unsigned",
            },
            "despesas": {
                "categoria_id": "bigint unsigned",
                "categoria": "varchar(100)",
                "criado_por": "bigint unsigned",
                "pagador_id": "bigint unsigned",
            },
        }
    )

    _apply_user_categories_migration(cursor)

    statements = "\n".join(statement for statement, _ in cursor.statements)
    assert "CONVERT(c.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci" in statements
    assert "CONVERT(dp.categoria USING utf8mb4) COLLATE utf8mb4_unicode_ci" in statements
    assert "CONVERT(d.categoria USING utf8mb4) COLLATE utf8mb4_unicode_ci" in statements


def test_email_login_migration_updates_existing_column_to_open_login():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "email_verificado": "tinyint(1)",
            }
        }
    )

    _apply_email_login_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios MODIFY COLUMN email_verificado "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )
    assert cursor.statements[2][0] == (
        "UPDATE usuarios SET email_verificado = 1 WHERE email_verificado = 0"
    )


def test_auth_version_migration_adds_version_to_existing_users_table():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_auth_version_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN auth_version "
        "INT UNSIGNED NOT NULL DEFAULT 0"
    )


def test_auth_version_migration_does_not_replace_existing_version():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "auth_version": "int unsigned",
            }
        }
    )

    _apply_auth_version_migration(cursor)

    assert len(cursor.statements) == 1


def test_account_anonymization_migration_adds_deleted_timestamp():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_account_anonymization_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN excluido_em DATETIME NULL"
    )


def test_account_anonymization_migration_keeps_existing_deleted_timestamp():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "excluido_em": "datetime",
            }
        }
    )

    _apply_account_anonymization_migration(cursor)

    assert len(cursor.statements) == 1


def test_user_timestamp_migration_adds_missing_updated_timestamp():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_user_updated_timestamp_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN atualizado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP "
        "ON UPDATE CURRENT_TIMESTAMP"
    )


def test_user_timestamp_migration_renames_legacy_updated_at():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "updated_at": "timestamp",
            }
        }
    )

    _apply_user_updated_timestamp_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios CHANGE COLUMN updated_at atualizado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP "
        "ON UPDATE CURRENT_TIMESTAMP"
    )


def test_user_timestamp_migration_preserves_current_timestamp_column():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "atualizado_em": "datetime",
            }
        }
    )

    _apply_user_updated_timestamp_migration(cursor)

    assert len(cursor.statements) == 1


def test_created_timestamp_migration_renames_legacy_created_at():
    cursor = FakeCursor(
        columns={
            "grupos": {
                "id": "bigint unsigned",
                "created_at": "datetime",
            }
        }
    )

    _apply_created_timestamp_migration(cursor, "grupos")

    assert cursor.statements[1][0] == (
        "ALTER TABLE `grupos` CHANGE COLUMN created_at criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )


def test_group_updated_timestamp_migration_renames_legacy_updated_at():
    cursor = FakeCursor(
        columns={
            "grupos": {
                "id": "bigint unsigned",
                "updated_at": "datetime",
            }
        }
    )

    _apply_group_updated_timestamp_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE grupos CHANGE COLUMN updated_at atualizado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP "
        "ON UPDATE CURRENT_TIMESTAMP"
    )


def test_schema_varchar_width_migration_widens_legacy_columns():
    cursor = FakeCursor(
        columns={
            "usuarios": {"email": "varchar(180)"},
            "despesas": {"descricao": "varchar(180)"},
            "categorias": {"nome": "varchar(80)"},
            "notificacoes": {"titulo": "varchar(120)"},
        }
    )

    _apply_schema_varchar_width_migrations(cursor)

    statements = [
        statement
        for statement, _ in cursor.statements
        if statement.startswith("ALTER TABLE")
    ]
    assert statements == [
        "ALTER TABLE `usuarios` MODIFY COLUMN `email` VARCHAR(255) NOT NULL",
        "ALTER TABLE `despesas` MODIFY COLUMN `descricao` VARCHAR(255) NOT NULL",
        "ALTER TABLE `categorias` MODIFY COLUMN `nome` VARCHAR(100) NOT NULL",
        "ALTER TABLE `notificacoes` MODIFY COLUMN `titulo` VARCHAR(150) NOT NULL",
    ]


class InstallmentRemovalCursor:
    def __init__(self, tables):
        self.tables = tables
        self.result = []
        self.statements = []

    def execute(self, operation, params=None):
        self.statements.append((operation, params))
        if "SELECT TABLE_NAME FROM information_schema.TABLES" in operation:
            self.result = [(table,) for table in self.tables]
        elif operation.startswith("SELECT DISTINCT grupo_id FROM parcelamentos"):
            self.result = [(8,), (3,), (8,)]
        elif operation.startswith("SELECT DISTINCT p.grupo_id FROM pagamentos"):
            self.result = [(8,), (3,), (8,)]
        else:
            self.result = []

    def fetchall(self):
        return self.result


class InstallmentRemovalConnection:
    def __init__(self):
        self.commit_count = 0

    def commit(self):
        self.commit_count += 1


def test_installment_removal_deletes_only_linked_records_and_recalculates_groups(
    monkeypatch,
):
    tables = {
        "parcela_pagamentos",
        "parcela_eventos",
        "parcela_rateios",
        "parcelas",
        "parcelamentos",
    }
    cursor = InstallmentRemovalCursor(tables)
    connection = InstallmentRemovalConnection()
    recalculated_groups = []
    monkeypatch.setattr(
        "services.financeiro_saldo_service.FinanceiroSaldoService.recalcular_saldos",
        staticmethod(
            lambda conn, grupo_id: recalculated_groups.append((conn, grupo_id))
        ),
    )

    database_connection._apply_installment_removal_migration(cursor, connection)

    statements = [statement for statement, _ in cursor.statements]
    assert any(
        statement.startswith("DELETE p FROM pagamentos p")
        for statement in statements
    )
    assert any(
        statement.startswith("DELETE dd FROM despesa_divisoes dd")
        for statement in statements
    )
    assert any(
        statement.startswith("DELETE dp FROM despesas_pessoais dp")
        for statement in statements
    )
    assert any(
        statement.startswith("DELETE d FROM despesas d")
        for statement in statements
    )
    assert [grupo_id for _, grupo_id in recalculated_groups] == [3, 8]
    assert all(conn is connection for conn, _ in recalculated_groups)
    assert connection.commit_count == 1
    assert [
        statement for statement in statements if statement.startswith("DROP TABLE")
    ] == [
        "DROP TABLE IF EXISTS `parcela_pagamentos`",
        "DROP TABLE IF EXISTS `parcela_eventos`",
        "DROP TABLE IF EXISTS `parcela_rateios`",
        "DROP TABLE IF EXISTS `parcelas`",
        "DROP TABLE IF EXISTS `parcelamentos`",
    ]


def test_installment_removal_is_a_noop_when_tables_are_already_absent():
    cursor = InstallmentRemovalCursor(set())
    connection = InstallmentRemovalConnection()

    database_connection._apply_installment_removal_migration(cursor, connection)

    assert len(cursor.statements) == 1
    assert connection.commit_count == 0


def test_user_avatar_migration_adds_avatar_storage():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_user_avatar_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN avatar_url MEDIUMTEXT NULL"
    )


def test_user_avatar_migration_preserves_existing_storage():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "avatar_url": "mediumtext",
            }
        }
    )

    _apply_user_avatar_migration(cursor)

    assert len(cursor.statements) == 1


def test_user_pix_key_migration_adds_optional_key_storage():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_user_pix_key_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN pix_chave VARCHAR(77) NULL"
    )


def test_user_pix_key_migration_preserves_existing_key_storage():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "pix_chave": "varchar(77)",
            }
        }
    )

    _apply_user_pix_key_migration(cursor)

    assert len(cursor.statements) == 1


def test_notification_preferences_migration_adds_disabled_defaults():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_notification_preferences_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN notificacoes_ativas "
        "TINYINT(1) NOT NULL DEFAULT 0"
    )
    assert cursor.statements[2][0] == (
        "ALTER TABLE usuarios ADD COLUMN sons_notificacoes_ativos "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )
    assert cursor.statements[3][0] == (
        "ALTER TABLE usuarios ADD COLUMN notificacoes_despesas_ativas "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )
    assert cursor.statements[4][0] == (
        "ALTER TABLE usuarios ADD COLUMN notificacoes_cobrancas_ativas "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )


def test_notification_preferences_migration_preserves_existing_columns():
    cursor = FakeCursor(
        columns={
            "usuarios": {
                "id": "bigint unsigned",
                "notificacoes_ativas": "tinyint(1)",
                "sons_notificacoes_ativos": "tinyint(1)",
                "notificacoes_despesas_ativas": "tinyint(1)",
                "notificacoes_cobrancas_ativas": "tinyint(1)",
            }
        }
    )

    _apply_notification_preferences_migration(cursor)

    assert len(cursor.statements) == 1


def test_notification_reference_migration_adds_optional_reference():
    cursor = FakeCursor(columns={"notificacoes": {"id": "bigint unsigned"}})

    _apply_notification_reference_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE notificacoes ADD COLUMN referencia_id "
        "BIGINT UNSIGNED NULL"
    )


def test_notification_reference_migration_preserves_existing_reference():
    cursor = FakeCursor(
        columns={
            "notificacoes": {
                "id": "bigint unsigned",
                "referencia_id": "bigint unsigned",
            }
        }
    )

    _apply_notification_reference_migration(cursor)

    assert len(cursor.statements) == 1


def test_notification_timestamp_migration_renames_legacy_created_at():
    cursor = FakeCursor(
        columns={
            "notificacoes": {
                "id": "bigint unsigned",
                "created_at": "datetime",
            }
        }
    )

    _apply_notification_timestamp_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE notificacoes CHANGE COLUMN created_at criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )


def test_notification_timestamp_migration_preserves_canonical_column():
    cursor = FakeCursor(
        columns={
            "notificacoes": {
                "id": "bigint unsigned",
                "criado_em": "datetime",
            }
        }
    )

    _apply_notification_timestamp_migration(cursor)

    assert len(cursor.statements) == 1


def test_group_expense_observation_migration_adds_optional_column():
    cursor = FakeCursor(columns={"despesas": {"id": "bigint unsigned"}})

    _apply_group_expense_observation_migration(cursor)

    assert cursor.statements[-1][0] == (
        "ALTER TABLE despesas ADD COLUMN observacao VARCHAR(500) NULL"
    )


def test_group_expense_observation_migration_preserves_existing_column():
    cursor = FakeCursor(
        columns={
            "despesas": {
                "id": "bigint unsigned",
                "observacao": "varchar(500)",
            }
        }
    )

    _apply_group_expense_observation_migration(cursor)

    assert len(cursor.statements) == 1


def test_group_expense_creator_migration_adds_nullable_legacy_field_and_index():
    cursor = FakeCursor(
        columns={"despesas": {"id": "bigint unsigned"}},
    )

    _apply_group_expense_creator_migration(cursor)

    statements = [operation for operation, _ in cursor.statements]
    assert (
        "ALTER TABLE despesas ADD COLUMN criado_por BIGINT UNSIGNED NULL"
        in statements
    )
    index_statement = (
        "CREATE INDEX idx_despesas_criador ON despesas (criado_por)"
    )
    foreign_key_statement = next(
        statement for statement in statements if "FOREIGN KEY (criado_por)" in statement
    )
    assert index_statement in statements
    assert statements.index(index_statement) < statements.index(foreign_key_statement)


def test_group_expense_creator_migration_preserves_existing_constraints():
    cursor = FakeCursor(
        columns={
            "despesas": {
                "id": "bigint unsigned",
                "criado_por": "bigint unsigned",
            }
        },
        indexes={
            "despesas": [
                (1, 0, "fk_despesa_criador", 1, "criado_por"),
            ]
        },
        foreign_keys={
            ("despesas", "criado_por"): ["fk_despesa_criador"],
        },
    )

    _apply_group_expense_creator_migration(cursor)

    assert len(cursor.statements) == 3


def test_push_outbox_migration_renames_delivery_to_provider_acceptance():
    cursor = FakeCursor(
        columns={
            "push_outbox_destinatarios": {
                "status": "enum('pending','ticketed','delivered','failed')",
            }
        }
    )

    _apply_push_outbox_destination_migration(cursor)

    statements = [operation for operation, _ in cursor.statements]
    assert len(statements) == 6
    assert "provider_accepted" in statements[1]
    assert (
        "UPDATE push_outbox_destinatarios "
        "SET status = 'provider_accepted' WHERE status = 'delivered'"
        in statements
    )
    assert "delivered" not in statements[3]
    assert "ADD COLUMN receipt_expires_at DATETIME NULL" in statements[4]
    assert "INTERVAL 1 DAY" in statements[5]


def test_push_outbox_migration_is_idempotent_for_current_schema():
    cursor = FakeCursor(
        columns={
            "push_outbox_destinatarios": {
                "status": "enum('pending','ticketed','provider_accepted','failed')",
                "receipt_expires_at": "datetime",
            }
        }
    )

    _apply_push_outbox_destination_migration(cursor)

    assert len(cursor.statements) == 1


def test_push_outbox_retention_migration_adds_index():
    cursor = FakeCursor(indexes={"push_outbox": []})

    _apply_push_outbox_retention_migration(cursor)

    assert cursor.statements == [
        ("SHOW INDEX FROM `push_outbox`", None),
        (
            "CREATE INDEX idx_push_outbox_retencao "
            "ON push_outbox (status, enviado_em, id)",
            None,
        )
    ]


def test_push_outbox_retention_migration_preserves_existing_index():
    cursor = FakeCursor(
        indexes={
            "push_outbox": [
                (1, 0, "idx_custom_retention", 1, "status"),
                (1, 0, "idx_custom_retention", 2, "enviado_em"),
            ]
        }
    )

    _apply_push_outbox_retention_migration(cursor)

    assert cursor.statements == [("SHOW INDEX FROM `push_outbox`", None)]


def test_gemini_usage_user_index_migration_adds_index():
    cursor = FakeCursor(indexes={"gemini_usage_diaria": []})

    _apply_gemini_usage_user_index_migration(cursor)

    assert cursor.statements == [
        ("SHOW INDEX FROM `gemini_usage_diaria`", None),
        (
            "CREATE INDEX idx_gemini_usage_user_date "
            "ON gemini_usage_diaria (usuario_id, data_utc)",
            None,
        ),
    ]


def test_gemini_usage_user_index_migration_preserves_existing_index():
    cursor = FakeCursor(
        indexes={
            "gemini_usage_diaria": [
                (1, 0, "idx_custom_user_date", 1, "usuario_id"),
                (1, 0, "idx_custom_user_date", 2, "data_utc"),
            ]
        }
    )

    _apply_gemini_usage_user_index_migration(cursor)

    assert cursor.statements == [("SHOW INDEX FROM `gemini_usage_diaria`", None)]


def test_payment_idempotency_migration_adds_column_and_unique_index():
    cursor = FakeCursor(
        columns={
            "pagamentos": {
                "id": "bigint",
                "grupo_id": "bigint",
                "pagador_id": "bigint",
            }
        },
        indexes={"pagamentos": []},
    )

    _apply_payment_idempotency_migration(cursor)

    assert cursor.statements == [
        ("SHOW COLUMNS FROM `pagamentos`", None),
        (
            "ALTER TABLE pagamentos ADD COLUMN idempotency_key "
            "VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL",
            None,
        ),
        ("SHOW INDEX FROM `pagamentos`", None),
        (
            "CREATE UNIQUE INDEX uq_pagamentos_idempotencia "
            "ON pagamentos (grupo_id, pagador_id, idempotency_key)",
            None,
        ),
    ]


def test_payment_idempotency_migration_preserves_existing_column_and_index():
    cursor = FakeCursor(
        columns={
            "pagamentos": {
                "id": "bigint",
                "grupo_id": "bigint",
                "pagador_id": "bigint",
                "idempotency_key": "varchar(64)",
            }
        },
        indexes={
            "pagamentos": [
                (1, 0, "uq_custom_idempotency", 1, "grupo_id"),
                (1, 0, "uq_custom_idempotency", 2, "pagador_id"),
                (1, 0, "uq_custom_idempotency", 3, "idempotency_key"),
            ]
        },
    )

    _apply_payment_idempotency_migration(cursor)

    assert cursor.statements == [
        ("SHOW COLUMNS FROM `pagamentos`", None),
        ("SHOW INDEX FROM `pagamentos`", None),
    ]


def test_participantes_migration_maps_legacy_fields():
    cursor = _legacy_cursor()

    _apply_participantes_migration(cursor)

    statements = "\n".join(operation for operation, _ in cursor.statements)
    normalized = " ".join(statements.split())
    assert "WHEN 'ATIVO' THEN 1 WHEN 'REMOVIDO' THEN 0" in normalized
    assert "criado_em = data_entrada" in normalized
    assert "removido_em = data_saida" in normalized
    assert "WHEN 'ADMIN' THEN 'admin'" in normalized
    assert "DROP COLUMN `data_entrada`, DROP COLUMN `data_saida`, DROP COLUMN `status`" in normalized
    assert "idx_participantes_grupo_ativo (grupo_id, ativo)" in normalized


def test_saldos_migration_maps_legacy_fields_and_constraints():
    cursor = _legacy_cursor()

    _apply_saldos_migration(cursor)

    statements = "\n".join(operation for operation, _ in cursor.statements)
    normalized = " ".join(statements.split())
    assert "s.usuario_id = p.usuario_id, s.saldo = s.valor_saldo" in normalized
    assert "ON p.id = s.participante_id AND p.grupo_id = s.grupo_id" in normalized
    assert "atualizado_em = updated_at" in normalized
    assert "DROP FOREIGN KEY `fk_saldos_participante`" in normalized
    assert "DROP COLUMN `participante_id`, DROP COLUMN `updated_at`, DROP COLUMN `valor_saldo`" in normalized
    assert "UNIQUE (grupo_id, usuario_id)" in normalized
    assert "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)" in normalized


def test_group_icon_migration_adds_nullable_icon_to_legacy_schema():
    cursor = FakeCursor(columns={"grupos": {"id": "bigint unsigned", "nome": "varchar(120)"}})

    _apply_group_icon_migration(cursor)
    cursor.columns["grupos"]["icone"] = "varchar(16)"
    _apply_group_icon_migration(cursor)

    assert cursor.statements == [
        ("SHOW COLUMNS FROM `grupos`", None),
        ("ALTER TABLE grupos ADD COLUMN icone VARCHAR(16) NULL", None),
        ("SHOW COLUMNS FROM `grupos`", None),
    ]


def test_group_icon_migration_does_not_rewrite_existing_column():
    cursor = FakeCursor(
        columns={
            "grupos": {
                "id": "bigint unsigned",
                "nome": "varchar(120)",
                "icone": "varchar(16)",
            }
        }
    )

    _apply_group_icon_migration(cursor)

    assert cursor.statements == [("SHOW COLUMNS FROM `grupos`", None)]


def test_group_cover_icon_preferences_migration_uses_idempotent_table_creation():
    cursor = FakeCursor()

    _apply_group_cover_icon_preferences_migration(cursor)
    _apply_group_cover_icon_preferences_migration(cursor)

    assert len(cursor.statements) == 6
    assert all(
        "CREATE TABLE IF NOT EXISTS grupo_icones_capa_" in statement
        for statement, _ in cursor.statements
        if statement.startswith("CREATE TABLE")
    )
    assert "icone VARCHAR(16) COLLATE utf8mb4_bin NOT NULL" in cursor.statements[0][0]
    assert not any(
        statement.startswith("ALTER TABLE grupo_icones_capa_ocultos")
        for statement, _ in cursor.statements
    )


def test_group_cover_icon_preferences_migration_fixes_legacy_collation():
    class LegacyCollationCursor(FakeCursor):
        def execute(self, operation: str, params: Any = None) -> None:
            super().execute(operation, params)
            if "SELECT COLLATION_NAME FROM information_schema.COLUMNS" in operation:
                self.result = [("utf8mb4_unicode_ci",)]

    cursor = LegacyCollationCursor()

    _apply_group_cover_icon_preferences_migration(cursor)

    assert (
        "ALTER TABLE grupo_icones_capa_ocultos "
        "MODIFY COLUMN icone VARCHAR(16) CHARACTER SET utf8mb4 "
        "COLLATE utf8mb4_bin NOT NULL",
        None,
    ) in cursor.statements


def test_participantes_migration_stops_on_unknown_legacy_status():
    cursor = _legacy_cursor(counts=[1])

    with pytest.raises(RuntimeError, match="status legado desconhecido"):
        _apply_participantes_migration(cursor)

    assert not any(
        operation.startswith(("ALTER TABLE", "UPDATE"))
        for operation, _ in cursor.statements
    )


def test_saldos_migration_stops_before_changes_when_participant_is_missing():
    cursor = _legacy_cursor(counts=[1])

    with pytest.raises(RuntimeError, match="participante legado inexistente"):
        _apply_saldos_migration(cursor)

    assert not any(
        operation.startswith(("ALTER TABLE", "UPDATE"))
        for operation, _ in cursor.statements
    )


def test_legacy_finance_migrations_add_current_columns_and_preserve_legacy_data():
    cursor = _legacy_cursor()

    apply_legacy_finance_migrations(cursor)

    statements = "\n".join(operation for operation, _ in cursor.statements)
    normalized = " ".join(statements.split())
    assert "SET d.pagador_id = p.usuario_id" in normalized
    assert "SET valor = valor_total WHERE valor IS NULL" in normalized
    assert "SET d.categoria = c.nome" in normalized
    assert "ADD COLUMN `vencimento` DATE NULL" in normalized
    assert "SET dd.usuario_id = p.usuario_id" in normalized
    assert "SET valor = valor_devido WHERE valor IS NULL" in normalized
    assert "WHEN 'PERCENTUAL' THEN 'porcentagem'" in normalized
    assert "SET pg.`pagador_id` = p.usuario_id" in normalized
    assert "SET pg.`recebedor_id` = p.usuario_id" in normalized
    assert "DROP COLUMN" not in normalized


def test_legacy_finance_migration_stops_on_orphan_expense_payer():
    cursor = _legacy_cursor(counts=[1])

    with pytest.raises(RuntimeError, match="pagador legado inexistente"):
        apply_legacy_finance_migrations(cursor)

    assert not any(
        operation.startswith(("ALTER TABLE", "UPDATE"))
        for operation, _ in cursor.statements
    )


def test_current_finance_schema_is_not_altered():
    cursor = FakeCursor(
        columns={
            "despesas": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "pagador_id": "bigint unsigned",
                "categoria": "varchar(100)",
                "valor": "decimal(12,2)",
                "data_despesa": "date",
                "vencimento": "date",
                "criado_em": "datetime",
                "atualizado_em": "datetime",
            },
            "despesa_divisoes": {
                "id": "bigint unsigned",
                "despesa_id": "bigint unsigned",
                "usuario_id": "bigint unsigned",
                "tipo": "enum('igual','porcentagem','valores')",
                "percentual": "decimal(7,4)",
                "valor": "decimal(12,2)",
                "criado_em": "datetime",
            },
            "pagamentos": {
                "id": "bigint unsigned",
                "grupo_id": "bigint unsigned",
                "pagador_id": "bigint unsigned",
                "recebedor_id": "bigint unsigned",
                "valor": "decimal(12,2)",
                "criado_em": "datetime",
            },
        }
    )

    apply_legacy_finance_migrations(cursor)

    assert not any(
        operation.startswith(("ALTER TABLE", "UPDATE"))
        for operation, _ in cursor.statements
    )

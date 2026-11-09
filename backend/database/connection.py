"""Camada de conexão MySQL do WEPAY."""

from contextlib import contextmanager
from collections.abc import Generator, Mapping, Sequence
from decimal import Decimal
from pathlib import Path
from threading import Lock
from typing import Any, Protocol

from config import Config
from database.legacy_finance_migrations import apply_legacy_finance_migrations
from database.legacy_invite_migrations import apply_legacy_invitation_migration
from database.legacy_recovery_migrations import apply_legacy_recovery_migration
from database.sql_identifiers import quote_mysql_identifier

mysql_connector: Any = None
try:
    import mysql.connector as mysql_connector
except ImportError:  # pragma: no cover - dependência obrigatória em runtime
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_FILE = BASE_DIR / "database" / "wepay.sql"
SCHEMA_VERSION = "data_retention"
_connection_pool: Any = None
_connection_pool_lock = Lock()


class _MigrationCursor(Protocol):
    def execute(self, operation: str, params: Any = None) -> Any: ...

    def fetchall(self) -> list[Any]: ...

    def fetchone(self) -> Any: ...


def adapt_query(query: str) -> str:
    """Converte os placeholders usados pelos modelos para MySQL."""
    return query.replace("?", "%s")


def _connect_mysql(database: str | None = None) -> Any:
    global _connection_pool
    if mysql_connector is None:
        raise RuntimeError(
            "mysql-connector-python não está instalado. Execute: pip install -r requirements.txt"
        )

    params: dict[str, Any] = {
        "host": Config.DB_HOST,
        "port": Config.DB_PORT,
        "user": Config.DB_USER,
        "password": Config.DB_PASSWORD,
    }
    if database:
        params["database"] = database
        with _connection_pool_lock:
            if _connection_pool is None:
                _connection_pool = mysql_connector.pooling.MySQLConnectionPool(
                    pool_name="wepay_pool",
                    pool_size=Config.DB_POOL_SIZE,
                    pool_reset_session=True,
                    **params,
                )
        return _connection_pool.get_connection()
    return mysql_connector.connect(**params)


def _ensure_mysql_database() -> None:
    db_name = quote_mysql_identifier(Config.DB_NAME)
    connection = _connect_mysql()
    try:
        cursor = connection.cursor()
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS {db_name} "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        connection.commit()
        cursor.close()
    finally:
        connection.close()


def _ensure_schema() -> None:
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Schema não encontrado: {SCHEMA_FILE}")

    _ensure_mysql_database()
    connection = _connect_mysql(Config.DB_NAME)
    try:
        cursor = connection.cursor()
        sql = SCHEMA_FILE.read_text(encoding="utf-8-sig")
        for statement in sql.split(";"):
            statement = statement.strip()
            if statement:
                try:
                    cursor.execute(statement)
                except Exception as exc:
                    raise RuntimeError(
                        "Falha ao aplicar o schema inicial do banco de dados. "
                        f"Comando: {statement[:120]!r}"
                    ) from exc
        connection.commit()
        cursor.close()
    finally:
        connection.close()


def _record_schema_version() -> None:
    """Registra a versão aplicada para tornar migrações auditáveis."""
    connection = _connect_mysql(Config.DB_NAME)
    try:
        cursor = connection.cursor()
        try:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(100) NOT NULL PRIMARY KEY,
                    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cursor.execute(
                "INSERT IGNORE INTO schema_migrations (version) VALUES (%s)",
                (SCHEMA_VERSION,),
            )
            connection.commit()
        finally:
            cursor.close()
    finally:
        connection.close()


def _column_metadata(cursor: _MigrationCursor, table: str) -> dict[str, str]:
    cursor.execute(f"SHOW COLUMNS FROM {quote_mysql_identifier(table)}")
    return {str(column[0]): str(column[1]) for column in cursor.fetchall()}


def _index_metadata(
    cursor: _MigrationCursor, table: str
) -> dict[str, tuple[bool, tuple[str, ...]]]:
    cursor.execute(f"SHOW INDEX FROM {quote_mysql_identifier(table)}")
    indexes: dict[str, tuple[bool, list[str]]] = {}
    for row in cursor.fetchall():
        name = str(row[2])
        if name not in indexes:
            indexes[name] = (not bool(row[1]), [])
        indexes[name][1].append(str(row[4]))
    return {
        name: (unique, tuple(columns))
        for name, (unique, columns) in indexes.items()
    }


def _drop_indexes_for_columns(
    cursor: _MigrationCursor, table: str, column_names: set[str]
) -> None:
    for name, (_, columns) in _index_metadata(cursor, table).items():
        if name != "PRIMARY" and column_names.intersection(columns):
            cursor.execute(
                f"ALTER TABLE {quote_mysql_identifier(table)} "
                f"DROP INDEX {quote_mysql_identifier(name)}"
            )


def _foreign_keys_for_column(
    cursor: _MigrationCursor, table: str, column: str
) -> list[str]:
    cursor.execute(
        """
        SELECT DISTINCT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
          AND REFERENCED_TABLE_NAME IS NOT NULL
        """,
        (table, column),
    )
    return [str(row[0]) for row in cursor.fetchall()]


def _apply_email_login_migration(cursor: _MigrationCursor) -> None:
    cursor.execute("SHOW COLUMNS FROM `usuarios`")
    columns = {str(column[0]): column for column in cursor.fetchall()}
    if "email_verificado" not in columns:
        cursor.execute(
            "ALTER TABLE usuarios ADD COLUMN email_verificado "
            "TINYINT(1) NOT NULL DEFAULT 1"
        )
    else:
        cursor.execute(
            "ALTER TABLE usuarios MODIFY COLUMN email_verificado "
            "TINYINT(1) NOT NULL DEFAULT 1"
        )

    cursor.execute(
        "UPDATE usuarios SET email_verificado = 1 WHERE email_verificado = 0"
    )


def _apply_auth_version_migration(cursor: _MigrationCursor) -> None:
    cursor.execute("SHOW COLUMNS FROM `usuarios`")
    columns = {str(column[0]) for column in cursor.fetchall()}
    if "auth_version" not in columns:
        cursor.execute(
            "ALTER TABLE usuarios ADD COLUMN auth_version "
            "INT UNSIGNED NOT NULL DEFAULT 0"
        )


def _apply_account_anonymization_migration(cursor: _MigrationCursor) -> None:
    cursor.execute("SHOW COLUMNS FROM `usuarios`")
    columns = {str(column[0]) for column in cursor.fetchall()}
    if "excluido_em" not in columns:
        cursor.execute(
            "ALTER TABLE usuarios ADD COLUMN excluido_em DATETIME NULL"
        )


def _apply_notification_preferences_migration(
    cursor: _MigrationCursor,
) -> None:
    cursor.execute("SHOW COLUMNS FROM `usuarios`")
    columns = {str(column[0]) for column in cursor.fetchall()}
    if "notificacoes_ativas" not in columns:
        cursor.execute(
            "ALTER TABLE usuarios ADD COLUMN notificacoes_ativas "
            "TINYINT(1) NOT NULL DEFAULT 0"
        )
    if "sons_notificacoes_ativos" not in columns:
        cursor.execute(
            "ALTER TABLE usuarios ADD COLUMN sons_notificacoes_ativos "
            "TINYINT(1) NOT NULL DEFAULT 1"
        )


def _apply_group_expense_observation_migration(
    cursor: _MigrationCursor,
) -> None:
    columns = _column_metadata(cursor, "despesas")
    if "observacao" not in columns:
        cursor.execute(
            "ALTER TABLE despesas ADD COLUMN observacao VARCHAR(500) NULL"
        )


def _apply_group_expense_creator_migration(
    cursor: _MigrationCursor,
) -> None:
    columns = _column_metadata(cursor, "despesas")
    if "criado_por" not in columns:
        cursor.execute(
            "ALTER TABLE despesas ADD COLUMN criado_por BIGINT UNSIGNED NULL"
        )
    indexes = _index_metadata(cursor, "despesas")
    if not any(
        columns and columns[0] == "criado_por"
        for _, columns in indexes.values()
    ):
        cursor.execute(
            "CREATE INDEX idx_despesas_criador ON despesas (criado_por)"
        )
    if not _foreign_keys_for_column(cursor, "despesas", "criado_por"):
        cursor.execute(
            "ALTER TABLE despesas ADD CONSTRAINT fk_despesa_criador "
            "FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL"
        )


def _apply_push_outbox_destination_migration(
    cursor: _MigrationCursor,
) -> None:
    columns = _column_metadata(cursor, "push_outbox_destinatarios")
    status_type = columns.get("status", "").lower()
    if "provider_accepted" not in status_type:
        cursor.execute(
            "ALTER TABLE push_outbox_destinatarios MODIFY COLUMN status "
            "ENUM('pending', 'ticketed', 'delivered', 'provider_accepted', 'failed') "
            "NOT NULL DEFAULT 'pending'"
        )
        cursor.execute(
            "UPDATE push_outbox_destinatarios "
            "SET status = 'provider_accepted' WHERE status = 'delivered'"
        )
        cursor.execute(
            "ALTER TABLE push_outbox_destinatarios MODIFY COLUMN status "
            "ENUM('pending', 'ticketed', 'provider_accepted', 'failed') "
            "NOT NULL DEFAULT 'pending'"
        )
    if "receipt_expires_at" not in columns:
        cursor.execute(
            "ALTER TABLE push_outbox_destinatarios "
            "ADD COLUMN receipt_expires_at DATETIME NULL"
        )
        cursor.execute(
            """
            UPDATE push_outbox_destinatarios
            SET receipt_expires_at = DATE_ADD(
                COALESCE(receipt_check_at, CURRENT_TIMESTAMP), INTERVAL 1 DAY
            )
            WHERE status = 'ticketed'
            """
        )


def _apply_push_outbox_retention_migration(cursor: _MigrationCursor) -> None:
    indexes = _index_metadata(cursor, "push_outbox")
    if not any(
        columns[:2] == ("status", "enviado_em")
        for _, columns in indexes.values()
    ):
        cursor.execute(
            "CREATE INDEX idx_push_outbox_retencao "
            "ON push_outbox (status, enviado_em, id)"
        )


def _apply_participantes_migration(cursor: _MigrationCursor) -> None:
    columns = _column_metadata(cursor, "participantes")
    legacy_columns = {
        name
        for name in ("status", "data_entrada", "data_saida")
        if name in columns
    }
    papel_type = columns.get("papel", "").lower()
    target_papel = "'admin'" in papel_type and "'participante'" in papel_type
    if (
        {"ativo", "criado_em", "removido_em"}.issubset(columns)
        and not legacy_columns
        and target_papel
    ):
        return

    if "status" in columns:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM participantes
            WHERE status IS NULL
               OR UPPER(CAST(status AS CHAR)) NOT IN ('ATIVO', 'REMOVIDO')
            """
        )
        if int(cursor.fetchone()[0]):
            raise RuntimeError(
                "Migração de participantes interrompida: status legado desconhecido."
            )
    if papel_type and not target_papel:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM participantes
            WHERE papel IS NULL
               OR UPPER(CAST(papel AS CHAR)) NOT IN (
                   'ADMIN', 'MEMBRO', 'PARTICIPANTE'
               )
            """
        )
        if int(cursor.fetchone()[0]):
            raise RuntimeError(
                "Migração de participantes interrompida: papel legado desconhecido."
            )

    if "ativo" not in columns:
        cursor.execute("ALTER TABLE participantes ADD COLUMN ativo TINYINT(1) NULL")
    if "criado_em" not in columns:
        cursor.execute(
            "ALTER TABLE participantes ADD COLUMN criado_em DATETIME NULL"
        )
    if "removido_em" not in columns:
        cursor.execute(
            "ALTER TABLE participantes ADD COLUMN removido_em DATETIME NULL"
        )

    if "status" in columns:
        cursor.execute(
            """
            UPDATE participantes
            SET ativo = CASE UPPER(CAST(status AS CHAR))
                WHEN 'ATIVO' THEN 1
                WHEN 'REMOVIDO' THEN 0
                ELSE NULL
            END
            """
        )
    else:
        cursor.execute(
            "UPDATE participantes SET ativo = 1 WHERE ativo IS NULL"
        )

    if "data_entrada" in columns:
        cursor.execute(
            "UPDATE participantes SET criado_em = data_entrada "
            "WHERE data_entrada IS NOT NULL"
        )
    cursor.execute(
        "UPDATE participantes SET criado_em = CURRENT_TIMESTAMP "
        "WHERE criado_em IS NULL"
    )
    if "data_saida" in columns:
        cursor.execute(
            "UPDATE participantes SET removido_em = data_saida "
            "WHERE data_saida IS NOT NULL"
        )

    if papel_type and not target_papel:
        cursor.execute(
            "ALTER TABLE participantes MODIFY COLUMN papel VARCHAR(30) NULL"
        )
        cursor.execute(
            """
            UPDATE participantes
            SET papel = CASE UPPER(CAST(papel AS CHAR))
                WHEN 'ADMIN' THEN 'admin'
                WHEN 'MEMBRO' THEN 'participante'
                WHEN 'PARTICIPANTE' THEN 'participante'
                ELSE NULL
            END
            """
        )
        cursor.execute(
            "ALTER TABLE participantes MODIFY COLUMN papel "
            "ENUM('admin', 'participante') NOT NULL DEFAULT 'participante'"
        )

    cursor.execute(
        "ALTER TABLE participantes MODIFY COLUMN ativo "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )
    cursor.execute(
        "ALTER TABLE participantes MODIFY COLUMN criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )
    cursor.execute(
        "ALTER TABLE participantes MODIFY COLUMN removido_em DATETIME NULL"
    )

    if legacy_columns:
        _drop_indexes_for_columns(cursor, "participantes", legacy_columns)
        drop_clauses = ", ".join(
            f"DROP COLUMN {quote_mysql_identifier(name)}"
            for name in sorted(legacy_columns)
        )
        cursor.execute(
            f"ALTER TABLE {quote_mysql_identifier('participantes')} {drop_clauses}"
        )

    indexes = _index_metadata(cursor, "participantes")
    if not any(columns == ("grupo_id", "ativo") for _, columns in indexes.values()):
        cursor.execute(
            "ALTER TABLE participantes ADD INDEX "
            "idx_participantes_grupo_ativo (grupo_id, ativo)"
        )


def _apply_saldos_migration(cursor: _MigrationCursor) -> None:
    columns = _column_metadata(cursor, "saldos")
    legacy_columns = {
        name
        for name in ("participante_id", "valor_saldo", "updated_at")
        if name in columns
    }
    migration_required = (
        not {"usuario_id", "saldo", "criado_em", "atualizado_em"}.issubset(
            columns
        )
        or bool(legacy_columns)
    )

    if migration_required:
        if "participante_id" in columns:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM saldos s
                LEFT JOIN participantes p
                  ON p.id = s.participante_id AND p.grupo_id = s.grupo_id
                WHERE p.id IS NULL
                """
            )
            if int(cursor.fetchone()[0]):
                raise RuntimeError(
                    "Migração de saldos interrompida: participante legado inexistente."
                )
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM (
                    SELECT s.grupo_id, p.usuario_id
                    FROM saldos s
                    JOIN participantes p
                      ON p.id = s.participante_id AND p.grupo_id = s.grupo_id
                    GROUP BY s.grupo_id, p.usuario_id
                    HAVING COUNT(*) > 1
                ) duplicados
                """
            )
            if int(cursor.fetchone()[0]):
                raise RuntimeError(
                    "Migração de saldos interrompida: há saldos duplicados por grupo e usuário."
                )
        elif "usuario_id" in columns:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM (
                    SELECT grupo_id, usuario_id
                    FROM saldos
                    GROUP BY grupo_id, usuario_id
                    HAVING COUNT(*) > 1
                ) duplicados
                """
            )
            if int(cursor.fetchone()[0]):
                raise RuntimeError(
                    "Migração de saldos interrompida: há saldos duplicados por grupo e usuário."
                )
        else:
            cursor.execute("SELECT COUNT(*) FROM saldos")
            if int(cursor.fetchone()[0]):
                raise RuntimeError(
                    "Migração de saldos interrompida: não há usuário para migrar."
                )

        if "valor_saldo" not in columns and "saldo" not in columns:
            cursor.execute("SELECT COUNT(*) FROM saldos")
            if int(cursor.fetchone()[0]):
                raise RuntimeError(
                    "Migração de saldos interrompida: não há valor para migrar."
                )

    if "usuario_id" not in columns:
        cursor.execute("ALTER TABLE saldos ADD COLUMN usuario_id BIGINT UNSIGNED NULL")
    if "saldo" not in columns:
        cursor.execute("ALTER TABLE saldos ADD COLUMN saldo DECIMAL(12,2) NULL")
    if "criado_em" not in columns:
        cursor.execute("ALTER TABLE saldos ADD COLUMN criado_em DATETIME NULL")
    if "atualizado_em" not in columns:
        cursor.execute(
            "ALTER TABLE saldos ADD COLUMN atualizado_em DATETIME NULL"
        )

    if migration_required:
        if "participante_id" in columns:
            if "valor_saldo" in columns:
                cursor.execute(
                    """
                    UPDATE saldos s
                    JOIN participantes p
                      ON p.id = s.participante_id AND p.grupo_id = s.grupo_id
                    SET s.usuario_id = p.usuario_id, s.saldo = s.valor_saldo
                    """
                )
            else:
                cursor.execute(
                    """
                    UPDATE saldos s
                    JOIN participantes p
                      ON p.id = s.participante_id AND p.grupo_id = s.grupo_id
                    SET s.usuario_id = p.usuario_id
                    """
                )
        elif "valor_saldo" in columns:
            cursor.execute("UPDATE saldos SET saldo = valor_saldo")

        if "updated_at" in columns:
            cursor.execute(
                "UPDATE saldos SET atualizado_em = updated_at "
                "WHERE updated_at IS NOT NULL"
            )
        cursor.execute(
            "UPDATE saldos SET criado_em = CURRENT_TIMESTAMP "
            "WHERE criado_em IS NULL"
        )
        cursor.execute(
            "UPDATE saldos SET atualizado_em = CURRENT_TIMESTAMP "
            "WHERE atualizado_em IS NULL"
        )
        cursor.execute(
            "SELECT COUNT(*) FROM saldos WHERE usuario_id IS NULL OR saldo IS NULL"
        )
        if int(cursor.fetchone()[0]):
            raise RuntimeError(
                "Migração de saldos interrompida: saldo ou usuário sem correspondência."
            )

        cursor.execute(
            "ALTER TABLE saldos MODIFY COLUMN usuario_id BIGINT UNSIGNED NOT NULL"
        )
        cursor.execute(
            "ALTER TABLE saldos MODIFY COLUMN saldo "
            "DECIMAL(12,2) NOT NULL DEFAULT 0.00"
        )
        cursor.execute(
            "ALTER TABLE saldos MODIFY COLUMN criado_em "
            "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
        )
        cursor.execute(
            "ALTER TABLE saldos MODIFY COLUMN atualizado_em "
            "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        )

    indexes = _index_metadata(cursor, "saldos")
    if not any(
        unique and columns == ("grupo_id", "usuario_id")
        for unique, columns in indexes.values()
    ):
        cursor.execute(
            "ALTER TABLE saldos ADD CONSTRAINT uq_saldo "
            "UNIQUE (grupo_id, usuario_id)"
        )
    if not any(columns == ("grupo_id",) for _, columns in indexes.values()):
        cursor.execute(
            "ALTER TABLE saldos ADD INDEX idx_saldos_grupo (grupo_id)"
        )

    foreign_keys = _foreign_keys_for_column(cursor, "saldos", "usuario_id")
    if not foreign_keys:
        cursor.execute(
            "ALTER TABLE saldos ADD CONSTRAINT fk_saldo_usuario "
            "FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE"
        )

    if legacy_columns:
        if "participante_id" in legacy_columns:
            for name in _foreign_keys_for_column(
                cursor, "saldos", "participante_id"
            ):
                cursor.execute(
                    f"ALTER TABLE {quote_mysql_identifier('saldos')} "
                    f"DROP FOREIGN KEY {quote_mysql_identifier(name)}"
                )
        _drop_indexes_for_columns(cursor, "saldos", legacy_columns)
        drop_clauses = ", ".join(
            f"DROP COLUMN {quote_mysql_identifier(name)}"
            for name in sorted(legacy_columns)
        )
        cursor.execute(
            f"ALTER TABLE {quote_mysql_identifier('saldos')} {drop_clauses}"
        )


def _apply_compatibility_migrations() -> None:
    """Aplica ajustes mínimos em bancos criados por versões anteriores."""
    connection = _connect_mysql(Config.DB_NAME)
    try:
        cursor = connection.cursor()
        cursor.execute("SHOW COLUMNS FROM usuarios")
        colunas = {coluna[0] for coluna in cursor.fetchall()}

        if "senha_hash" in colunas and "senha" not in colunas:
            cursor.execute(
                "ALTER TABLE usuarios CHANGE COLUMN senha_hash senha VARCHAR(255) NOT NULL"
            )
        elif "senha_hash" in colunas and "senha" in colunas:
            cursor.execute(
                "UPDATE usuarios SET senha = senha_hash WHERE senha IS NULL OR senha = ''"
            )
            cursor.execute("ALTER TABLE usuarios DROP COLUMN senha_hash")
            cursor.execute("ALTER TABLE usuarios MODIFY COLUMN senha VARCHAR(255) NOT NULL")
        elif "senha" not in colunas:
            cursor.execute("ALTER TABLE usuarios ADD COLUMN senha VARCHAR(255) NULL")

        if "telefone" not in colunas:
            cursor.execute("ALTER TABLE usuarios ADD COLUMN telefone VARCHAR(30) NULL")

        _apply_email_login_migration(cursor)
        _apply_auth_version_migration(cursor)
        _apply_account_anonymization_migration(cursor)
        _apply_notification_preferences_migration(cursor)
        _apply_group_expense_observation_migration(cursor)
        _apply_group_expense_creator_migration(cursor)
        _apply_push_outbox_destination_migration(cursor)
        _apply_push_outbox_retention_migration(cursor)

        cursor.execute("SHOW COLUMNS FROM refresh_tokens")
        colunas_refresh = {coluna[0] for coluna in cursor.fetchall()}

        if "expira_at" in colunas_refresh and "expires_at" not in colunas_refresh:
            cursor.execute(
                "ALTER TABLE refresh_tokens CHANGE COLUMN expira_at expires_at DATETIME NOT NULL"
            )
        elif "expira_at" in colunas_refresh and "expires_at" in colunas_refresh:
            cursor.execute(
                "UPDATE refresh_tokens SET expires_at = expira_at WHERE expires_at IS NULL"
            )
            cursor.execute("ALTER TABLE refresh_tokens DROP COLUMN expira_at")

        if "expires_at" not in colunas_refresh and "expira_at" not in colunas_refresh:
            cursor.execute(
                "ALTER TABLE refresh_tokens ADD COLUMN expires_at DATETIME NULL"
            )

        if "revogado_em" not in colunas_refresh:
            cursor.execute(
                "ALTER TABLE refresh_tokens ADD COLUMN revogado_em DATETIME NULL"
            )

        apply_legacy_recovery_migration(cursor)
        _apply_participantes_migration(cursor)
        _apply_saldos_migration(cursor)
        apply_legacy_finance_migrations(cursor)
        apply_legacy_invitation_migration(cursor)

        connection.commit()

        cursor.close()
    finally:
        connection.close()


def initialize_database() -> None:
    """Cria o banco e as tabelas quando a aplicação é iniciada."""
    _ensure_schema()
    _apply_compatibility_migrations()
    _record_schema_version()


@contextmanager
def get_connection_context() -> Generator[Any, None, None]:
    connection = _connect_mysql(Config.DB_NAME)
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def get_connection() -> Any:
    return _connect_mysql(Config.DB_NAME)


def normalize_row(
    row: Mapping[object, Any] | Sequence[Any] | None,
    description: Sequence[Sequence[Any]] | None = None,
) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, Mapping):
        return {str(key): value for key, value in row.items()}
    if description:
        return {column[0]: value for column, value in zip(description, row)}
    raise TypeError("Uma linha sem descrição precisa ser um mapeamento.")


def fetch_one(cursor: "CursorAdapter") -> dict[str, Any] | None:
    row = cursor.fetchone()
    return normalize_row(row, cursor.description)


def fetch_all(cursor: "CursorAdapter") -> list[dict[str, Any]]:
    rows = cursor.fetchall()
    return [
        normalized
        for row in rows
        if (normalized := normalize_row(row, cursor.description)) is not None
    ]


class CursorAdapter:
    """Adaptador dos cursores MySQL para a API dos modelos."""

    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor

    @staticmethod
    def _params(
        params: Sequence[Any] | Mapping[str, Any] | None,
    ) -> Sequence[Any] | Mapping[str, Any] | None:
        if params is None:
            return None
        if isinstance(params, (list, tuple)):
            return tuple(str(item) if isinstance(item, Decimal) else item for item in params)
        return params

    def execute(self, operation: str, params: Any = None) -> Any:
        if params is None:
            return self._cursor.execute(adapt_query(operation))
        return self._cursor.execute(adapt_query(operation), self._params(params))

    def executemany(self, operation: str, seq_of_params: list[Any]) -> Any:
        return self._cursor.executemany(
            adapt_query(operation), [self._params(params) for params in seq_of_params]
        )

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()

    @property
    def lastrowid(self) -> int:
        return self._cursor.lastrowid

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    @property
    def description(self) -> Any:
        return self._cursor.description

    def close(self) -> None:
        self._cursor.close()


def cursor_for(connection: Any) -> CursorAdapter:
    """Cria um cursor MySQL que retorna linhas como dicionários."""
    return CursorAdapter(connection.cursor(dictionary=True))

"""Camada de conexão MySQL do WEPAY."""

from contextlib import contextmanager
from collections.abc import Generator, Mapping, Sequence
from decimal import Decimal
from pathlib import Path
from typing import Any

from config import Config

mysql_connector: Any = None
try:
    import mysql.connector as mysql_connector
except ImportError:  # pragma: no cover - dependência obrigatória em runtime
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_FILE = BASE_DIR / "database" / "wepay.sql"


def adapt_query(query: str) -> str:
    """Converte os placeholders usados pelos modelos para MySQL."""
    return query.replace("?", "%s")


def _connect_mysql(database: str | None = None) -> Any:
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
    return mysql_connector.connect(**params)


def _ensure_mysql_database() -> None:
    db_name = Config.DB_NAME.replace("`", "")
    connection = _connect_mysql()
    try:
        cursor = connection.cursor()
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
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
                except Exception:
                    pass
        connection.commit()
        cursor.close()
    finally:
        connection.close()


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

        connection.commit()

        cursor.close()
    finally:
        connection.close()


def initialize_database() -> None:
    """Cria o banco e as tabelas quando a aplicação é iniciada."""
    _ensure_schema()
    _apply_compatibility_migrations()


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

from typing import Any, Protocol

from database.sql_identifiers import quote_mysql_identifier


class MigrationCursor(Protocol):
    def execute(self, operation: str, params: Any = None) -> Any: ...

    def fetchall(self) -> list[Any]: ...

    def fetchone(self) -> Any: ...


def _columns(cursor: MigrationCursor) -> dict[str, tuple[str, bool, Any]]:
    cursor.execute("SHOW COLUMNS FROM `recuperacao_tokens`")
    return {
        str(row[0]): (str(row[1]), str(row[2]).upper() == "YES", row[4])
        for row in cursor.fetchall()
    }


def _count(cursor: MigrationCursor, query: str) -> int:
    cursor.execute(query)
    return int(cursor.fetchone()[0])


def apply_legacy_recovery_migration(cursor: MigrationCursor) -> None:
    """Adds current recovery-token column names while preserving legacy data."""
    columns = _columns(cursor)
    row_count = _count(cursor, "SELECT COUNT(*) FROM `recuperacao_tokens`")

    aliases = {
        "expires_at": "expira_at",
        "usado_em": "usado_at",
        "criado_em": "created_at",
    }
    if row_count:
        missing_sources = [
            target
            for target, source in aliases.items()
            if target not in columns and source not in columns
        ]
        if missing_sources:
            raise RuntimeError(
                "Migração de recuperação interrompida: não há campos legados "
                f"para preencher {', '.join(missing_sources)}."
            )

    additions = {
        "expires_at": "DATETIME NULL",
        "usado_em": "DATETIME NULL",
        "criado_em": "DATETIME NULL",
    }
    for name, definition in additions.items():
        if name not in columns:
            cursor.execute(
                f"ALTER TABLE `recuperacao_tokens` ADD COLUMN "
                f"{quote_mysql_identifier(name)} {definition}"
            )

    for target, source in aliases.items():
        if source in columns:
            cursor.execute(
                f"UPDATE `recuperacao_tokens` "
                f"SET {quote_mysql_identifier(target)} = "
                f"{quote_mysql_identifier(source)} "
                f"WHERE {quote_mysql_identifier(target)} IS NULL"
            )
            if not columns[source][1]:
                cursor.execute(
                    f"ALTER TABLE `recuperacao_tokens` MODIFY COLUMN "
                    f"{quote_mysql_identifier(source)} "
                    f"{columns[source][0]} NULL"
                )

    cursor.execute(
        "UPDATE `recuperacao_tokens` SET `criado_em` = CURRENT_TIMESTAMP "
        "WHERE `criado_em` IS NULL"
    )

    if _count(
        cursor,
        "SELECT COUNT(*) FROM `recuperacao_tokens` "
        "WHERE `usuario_id` IS NULL OR `token_hash` IS NULL "
        "OR `expires_at` IS NULL OR `criado_em` IS NULL",
    ):
        raise RuntimeError(
            "Migração de recuperação interrompida: há tokens sem usuário, "
            "hash, validade ou data de criação."
        )

    for name, nullable, default in (
        ("expires_at", False, None),
        ("usado_em", True, None),
        ("criado_em", False, "current_timestamp"),
    ):
        column = columns.get(name)
        if (
            column is None
            or column[1] != nullable
            or (
                default is not None
                and default not in str(column[2]).lower()
            )
        ):
            definition = (
                "DATETIME NULL"
                if nullable
                else (
                    "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    if default
                    else "DATETIME NOT NULL"
                )
            )
            cursor.execute(
                f"ALTER TABLE `recuperacao_tokens` "
                f"MODIFY COLUMN {quote_mysql_identifier(name)} {definition}"
            )

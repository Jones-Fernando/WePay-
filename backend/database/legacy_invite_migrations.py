from typing import Any, Protocol


class MigrationCursor(Protocol):
    def execute(self, operation: str, params: Any = None) -> Any: ...

    def fetchall(self) -> list[Any]: ...

    def fetchone(self) -> Any: ...


def _columns(cursor: MigrationCursor) -> dict[str, tuple[str, bool, Any]]:
    cursor.execute("SHOW COLUMNS FROM `convites_grupo`")
    return {
        str(row[0]): (str(row[1]), str(row[2]).upper() == "YES", row[4])
        for row in cursor.fetchall()
    }


def _count(cursor: MigrationCursor, query: str) -> int:
    cursor.execute(query)
    return int(cursor.fetchone()[0])


def _indexes(cursor: MigrationCursor) -> dict[str, tuple[str, ...]]:
    cursor.execute("SHOW INDEX FROM `convites_grupo`")
    indexes: dict[str, list[tuple[int, str]]] = {}
    for row in cursor.fetchall():
        indexes.setdefault(str(row[2]), []).append((int(row[3]), str(row[4])))
    return {
        name: tuple(column for _, column in sorted(columns))
        for name, columns in indexes.items()
    }


def _ensure_index(
    cursor: MigrationCursor, name: str, column: str
) -> None:
    if (column,) in _indexes(cursor).values():
        return
    cursor.execute(
        f"ALTER TABLE `convites_grupo` ADD INDEX `{name}` (`{column}`)"
    )


def _has_foreign_key(cursor: MigrationCursor, column: str) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'convites_grupo'
          AND COLUMN_NAME = %s
          AND REFERENCED_TABLE_NAME = 'usuarios'
        LIMIT 1
        """,
        (column,),
    )
    return bool(cursor.fetchall())


def apply_legacy_invitation_migration(cursor: MigrationCursor) -> None:
    """Adds the current invitation fields while preserving legacy columns."""
    columns = _columns(cursor)
    row_count = _count(cursor, "SELECT COUNT(*) FROM convites_grupo")

    legacy_sources = {
        "email": "email_convidado",
        "expires_at": "expira_at",
        "criado_por": "convidado_por",
    }
    if row_count:
        missing_sources = [
            target
            for target, source in legacy_sources.items()
            if target not in columns and source not in columns
        ]
        if missing_sources:
            raise RuntimeError(
                "Migração de convites interrompida: não há campos legados "
                f"para preencher {', '.join(missing_sources)}."
            )

    additions = {
        "email": "VARCHAR(255) NULL",
        "expires_at": "DATETIME NULL",
        "usado_em": "DATETIME NULL",
        "criado_por": "BIGINT UNSIGNED NULL",
        "criado_em": "DATETIME NULL",
    }
    for name, definition in additions.items():
        if name not in columns:
            cursor.execute(
                f"ALTER TABLE `convites_grupo` ADD COLUMN `{name}` {definition}"
            )

    for target, source in legacy_sources.items():
        if source in columns:
            empty_check = f"`{target}` IS NULL"
            if target == "email":
                empty_check += f" OR `{target}` = ''"
            cursor.execute(
                f"UPDATE `convites_grupo` SET `{target}` = `{source}` "
                f"WHERE {empty_check}"
            )
            if not columns[source][1]:
                cursor.execute(
                    f"ALTER TABLE `convites_grupo` MODIFY COLUMN `{source}` "
                    f"{columns[source][0]} NULL"
                )

    if "created_at" in columns:
        cursor.execute(
            "UPDATE `convites_grupo` SET `criado_em` = `created_at` "
            "WHERE `criado_em` IS NULL"
        )
    cursor.execute(
        "UPDATE `convites_grupo` SET `criado_em` = CURRENT_TIMESTAMP "
        "WHERE `criado_em` IS NULL"
    )

    if "status" in columns:
        accepted_at = (
            "COALESCE(`aceito_at`, CURRENT_TIMESTAMP)"
            if "aceito_at" in columns
            else "CURRENT_TIMESTAMP"
        )
        cursor.execute(
            "UPDATE `convites_grupo` "
            f"SET `usado_em` = {accepted_at} "
            "WHERE `usado_em` IS NULL AND `status` <> 'PENDENTE'"
        )
    elif "aceito_at" in columns:
        cursor.execute(
            "UPDATE `convites_grupo` SET `usado_em` = `aceito_at` "
            "WHERE `usado_em` IS NULL AND `aceito_at` IS NOT NULL"
        )

    if _count(
        cursor,
        "SELECT COUNT(*) FROM `convites_grupo` "
        "WHERE `email` IS NULL OR `email` = '' OR `expires_at` IS NULL "
        "OR `criado_por` IS NULL",
    ):
        raise RuntimeError(
            "Migração de convites interrompida: há registros sem e-mail, "
            "expiração ou criador."
        )

    if _count(
        cursor,
        """
        SELECT COUNT(*)
        FROM convites_grupo c
        LEFT JOIN usuarios u ON u.id = c.criado_por
        WHERE u.id IS NULL
        """,
    ):
        raise RuntimeError(
            "Migração de convites interrompida: há criadores inexistentes."
        )

    if "email" not in columns or columns["email"][0].lower() != "varchar(255)":
        cursor.execute(
            "ALTER TABLE `convites_grupo` MODIFY COLUMN `email` "
            "VARCHAR(255) NOT NULL"
        )
    elif columns["email"][1]:
        cursor.execute(
            "ALTER TABLE `convites_grupo` MODIFY COLUMN `email` "
            "VARCHAR(255) NOT NULL"
        )

    if "expires_at" not in columns or columns["expires_at"][1]:
        cursor.execute(
            "ALTER TABLE `convites_grupo` MODIFY COLUMN `expires_at` "
            "DATETIME NOT NULL"
        )
    if "criado_por" not in columns or columns["criado_por"][1]:
        cursor.execute(
            "ALTER TABLE `convites_grupo` MODIFY COLUMN `criado_por` "
            "BIGINT UNSIGNED NOT NULL"
        )
    if (
        "criado_em" not in columns
        or columns["criado_em"][1]
        or "current_timestamp" not in str(columns["criado_em"][2]).lower()
    ):
        cursor.execute(
            "ALTER TABLE `convites_grupo` MODIFY COLUMN `criado_em` "
            "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
        )

    _ensure_index(cursor, "idx_convite_email", "email")
    _ensure_index(cursor, "idx_convite_expiracao", "expires_at")
    if not _has_foreign_key(cursor, "criado_por"):
        cursor.execute(
            "ALTER TABLE `convites_grupo` "
            "ADD CONSTRAINT `fk_convite_criador` "
            "FOREIGN KEY (`criado_por`) REFERENCES `usuarios` (`id`) "
            "ON DELETE RESTRICT"
        )

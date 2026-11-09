from typing import Any, Protocol

from database.sql_identifiers import quote_mysql_identifier


class MigrationCursor(Protocol):
    def execute(self, operation: str, params: Any = None) -> Any: ...

    def fetchall(self) -> list[Any]: ...

    def fetchone(self) -> Any: ...


def _columns(
    cursor: MigrationCursor, table: str
) -> dict[str, tuple[str, bool, Any]]:
    cursor.execute(f"SHOW COLUMNS FROM {quote_mysql_identifier(table)}")
    return {
        str(row[0]): (
            str(row[1]),
            str(row[2]).upper() == "YES",
            row[4],
        )
        for row in cursor.fetchall()
    }


def _legacy_columns_need_adjustment(
    columns: dict[str, tuple[str, bool, Any]],
    nullable_columns: set[str],
    timestamp_columns: set[str],
) -> bool:
    if any(name in columns and not columns[name][1] for name in nullable_columns):
        return True
    return any(
        name in columns
        and "current_timestamp" not in str(columns[name][2]).lower()
        for name in timestamp_columns
    )


def _indexes(
    cursor: MigrationCursor, table: str
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


def _ensure_index(
    cursor: MigrationCursor,
    table: str,
    name: str,
    columns: tuple[str, ...],
    unique: bool = False,
) -> None:
    if any(
        existing_unique == unique and existing_columns == columns
        for existing_unique, existing_columns in _indexes(cursor, table).values()
    ):
        return
    column_list = ", ".join(
        quote_mysql_identifier(column) for column in columns
    )
    kind = "UNIQUE INDEX" if unique else "INDEX"
    cursor.execute(
        f"ALTER TABLE {quote_mysql_identifier(table)} ADD {kind} "
        f"{quote_mysql_identifier(name)} ({column_list})"
    )


def _foreign_keys_for_column(
    cursor: MigrationCursor, table: str, column: str
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


def _ensure_foreign_key(
    cursor: MigrationCursor,
    table: str,
    column: str,
    name: str,
    referenced_table: str,
    on_delete: str,
) -> None:
    if _foreign_keys_for_column(cursor, table, column):
        return
    cursor.execute(
        f"ALTER TABLE {quote_mysql_identifier(table)} "
        f"ADD CONSTRAINT {quote_mysql_identifier(name)} "
        f"FOREIGN KEY ({quote_mysql_identifier(column)}) "
        f"REFERENCES {quote_mysql_identifier(referenced_table)} (`id`) "
        f"ON DELETE {on_delete}"
    )


def _count(cursor: MigrationCursor, query: str) -> int:
    cursor.execute(query)
    return int(cursor.fetchone()[0])


def _apply_despesas_migration(cursor: MigrationCursor) -> None:
    columns = _columns(cursor, "despesas")
    target_columns = {
        "pagador_id",
        "categoria",
        "valor",
        "vencimento",
        "criado_em",
        "atualizado_em",
    }
    if target_columns.issubset(columns) and not _legacy_columns_need_adjustment(
        columns,
        {
            "pagador_participante_id",
            "categoria_id",
            "valor_total",
            "tipo_divisao",
            "created_by",
            "observacao",
        },
        {"created_at", "updated_at"},
    ):
        return

    if "pagador_participante_id" in columns:
        if _count(
            cursor,
            """
            SELECT COUNT(*)
            FROM despesas d
            LEFT JOIN participantes p
              ON p.id = d.pagador_participante_id AND p.grupo_id = d.grupo_id
            WHERE d.pagador_participante_id IS NOT NULL
              AND p.id IS NULL
            """,
        ):
            raise RuntimeError(
                "Migração de despesas interrompida: pagador legado inexistente."
            )
    elif "pagador_id" not in columns and _count(
        cursor, "SELECT COUNT(*) FROM despesas"
    ):
        raise RuntimeError(
            "Migração de despesas interrompida: não há pagador para migrar."
        )

    if "valor" not in columns and "valor_total" not in columns:
        if _count(cursor, "SELECT COUNT(*) FROM despesas"):
            raise RuntimeError(
                "Migração de despesas interrompida: não há valor para migrar."
            )

    additions = {
        "pagador_id": "BIGINT UNSIGNED NULL",
        "categoria": "VARCHAR(100) NULL",
        "valor": "DECIMAL(12,2) NULL",
        "vencimento": "DATE NULL",
        "criado_em": "DATETIME NULL",
        "atualizado_em": "DATETIME NULL",
    }
    for name, definition in additions.items():
        if name not in columns:
            cursor.execute(
                f"ALTER TABLE despesas ADD COLUMN "
                f"{quote_mysql_identifier(name)} {definition}"
            )

    if "pagador_participante_id" in columns:
        cursor.execute(
            """
            UPDATE despesas d
            JOIN participantes p
              ON p.id = d.pagador_participante_id AND p.grupo_id = d.grupo_id
            SET d.pagador_id = p.usuario_id
            WHERE d.pagador_id IS NULL
            """
        )
    if "valor_total" in columns:
        cursor.execute(
            "UPDATE despesas SET valor = valor_total WHERE valor IS NULL"
        )
    if "categoria_id" in columns:
        cursor.execute(
            """
            UPDATE despesas d
            JOIN categorias c ON c.id = d.categoria_id
            SET d.categoria = c.nome
            WHERE d.categoria IS NULL
            """
        )
    for old_column, new_column in (
        ("created_at", "criado_em"),
        ("updated_at", "atualizado_em"),
    ):
        if old_column in columns:
            cursor.execute(
                f"UPDATE despesas SET {quote_mysql_identifier(new_column)} = "
                f"{quote_mysql_identifier(old_column)} "
                f"WHERE {quote_mysql_identifier(new_column)} IS NULL"
            )
    cursor.execute(
        "UPDATE despesas SET criado_em = CURRENT_TIMESTAMP WHERE criado_em IS NULL"
    )
    cursor.execute(
        "UPDATE despesas SET atualizado_em = CURRENT_TIMESTAMP "
        "WHERE atualizado_em IS NULL"
    )
    if _count(
        cursor,
        "SELECT COUNT(*) FROM despesas "
        "WHERE pagador_id IS NULL OR valor IS NULL OR data_despesa IS NULL",
    ):
        raise RuntimeError(
            "Migração de despesas interrompida: campos essenciais sem correspondência."
        )

    for name, definition in {
        "pagador_participante_id": "BIGINT UNSIGNED NULL",
        "categoria_id": "BIGINT UNSIGNED NULL",
        "valor_total": "DECIMAL(12,2) NULL",
        "tipo_divisao": "ENUM('IGUAL','PERCENTUAL','VALOR') NULL",
        "created_by": "BIGINT UNSIGNED NULL",
        "observacao": "VARCHAR(500) NULL",
    }.items():
        if name in columns:
            cursor.execute(
                f"ALTER TABLE despesas MODIFY COLUMN "
                f"{quote_mysql_identifier(name)} {definition}"
            )
    for name in ("created_at", "updated_at"):
        if name in columns:
            cursor.execute(
                f"ALTER TABLE despesas MODIFY COLUMN "
                f"{quote_mysql_identifier(name)} "
                "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
            )

    cursor.execute(
        "ALTER TABLE despesas MODIFY COLUMN pagador_id BIGINT UNSIGNED NOT NULL"
    )
    cursor.execute(
        "ALTER TABLE despesas MODIFY COLUMN valor DECIMAL(12,2) NOT NULL"
    )
    cursor.execute(
        "ALTER TABLE despesas MODIFY COLUMN criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )
    cursor.execute(
        "ALTER TABLE despesas MODIFY COLUMN atualizado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    )
    _ensure_index(cursor, "despesas", "idx_despesas_pagador_usuario", ("pagador_id",))
    _ensure_foreign_key(
        cursor,
        "despesas",
        "pagador_id",
        "fk_despesa_pagador_usuario",
        "usuarios",
        "RESTRICT",
    )


def _apply_divisoes_migration(cursor: MigrationCursor) -> None:
    columns = _columns(cursor, "despesa_divisoes")
    target_columns = {"usuario_id", "tipo", "percentual", "valor", "criado_em"}
    if target_columns.issubset(columns) and not _legacy_columns_need_adjustment(
        columns,
        {"grupo_id", "participante_id", "valor_devido"},
        {"created_at", "updated_at"},
    ):
        return

    if "participante_id" in columns:
        if _count(
            cursor,
            """
            SELECT COUNT(*)
            FROM despesa_divisoes dd
            LEFT JOIN participantes p
              ON p.id = dd.participante_id AND p.grupo_id = dd.grupo_id
            WHERE dd.participante_id IS NOT NULL AND p.id IS NULL
            """,
        ):
            raise RuntimeError(
                "Migração de divisões interrompida: participante legado inexistente."
            )
    elif "usuario_id" not in columns and _count(
        cursor, "SELECT COUNT(*) FROM despesa_divisoes"
    ):
        raise RuntimeError(
            "Migração de divisões interrompida: não há usuário para migrar."
        )
    if "valor" not in columns and "valor_devido" not in columns:
        if _count(cursor, "SELECT COUNT(*) FROM despesa_divisoes"):
            raise RuntimeError(
                "Migração de divisões interrompida: não há valor para migrar."
            )

    despesas_columns = _columns(cursor, "despesas")
    if "tipo_divisao" not in despesas_columns:
        if _count(cursor, "SELECT COUNT(*) FROM despesa_divisoes"):
            raise RuntimeError(
                "Migração de divisões interrompida: não há tipo para migrar."
            )
    elif _count(
        cursor,
        """
        SELECT COUNT(*)
        FROM despesa_divisoes dd
        JOIN despesas d ON d.id = dd.despesa_id
        WHERE UPPER(CAST(d.tipo_divisao AS CHAR)) NOT IN (
            'IGUAL', 'PERCENTUAL', 'VALOR'
        )
        """,
    ):
        raise RuntimeError(
            "Migração de divisões interrompida: tipo de divisão desconhecido."
        )

    additions = {
        "usuario_id": "BIGINT UNSIGNED NULL",
        "tipo": "ENUM('igual','porcentagem','valores') NULL",
        "percentual": "DECIMAL(7,4) NULL",
        "valor": "DECIMAL(12,2) NULL",
        "criado_em": "DATETIME NULL",
    }
    for name, definition in additions.items():
        if name not in columns:
            cursor.execute(
                f"ALTER TABLE despesa_divisoes ADD COLUMN "
                f"{quote_mysql_identifier(name)} {definition}"
            )

    if "participante_id" in columns:
        cursor.execute(
            """
            UPDATE despesa_divisoes dd
            JOIN participantes p
              ON p.id = dd.participante_id AND p.grupo_id = dd.grupo_id
            SET dd.usuario_id = p.usuario_id
            WHERE dd.usuario_id IS NULL
            """
        )
    if "valor_devido" in columns:
        cursor.execute(
            "UPDATE despesa_divisoes SET valor = valor_devido WHERE valor IS NULL"
        )
    if "created_at" in columns:
        cursor.execute(
            "UPDATE despesa_divisoes SET criado_em = created_at "
            "WHERE criado_em IS NULL"
        )
    if "tipo_divisao" in despesas_columns:
        cursor.execute(
            """
            UPDATE despesa_divisoes dd
            JOIN despesas d ON d.id = dd.despesa_id
            SET dd.tipo = CASE UPPER(CAST(d.tipo_divisao AS CHAR))
                WHEN 'IGUAL' THEN 'igual'
                WHEN 'PERCENTUAL' THEN 'porcentagem'
                WHEN 'VALOR' THEN 'valores'
            END
            WHERE dd.tipo IS NULL
            """
        )
    cursor.execute(
        "UPDATE despesa_divisoes SET criado_em = CURRENT_TIMESTAMP "
        "WHERE criado_em IS NULL"
    )
    if _count(
        cursor,
        "SELECT COUNT(*) FROM despesa_divisoes "
        "WHERE usuario_id IS NULL OR tipo IS NULL OR valor IS NULL",
    ):
        raise RuntimeError(
            "Migração de divisões interrompida: campos essenciais sem correspondência."
        )
    if _count(
        cursor,
        """
        SELECT COUNT(*)
        FROM (
            SELECT despesa_id, usuario_id
            FROM despesa_divisoes
            GROUP BY despesa_id, usuario_id
            HAVING COUNT(*) > 1
        ) duplicadas
        """,
    ):
        raise RuntimeError(
            "Migração de divisões interrompida: há usuários duplicados por despesa."
        )

    for name, definition in (
        ("grupo_id", "BIGINT UNSIGNED NULL"),
        ("participante_id", "BIGINT UNSIGNED NULL"),
        ("valor_devido", "DECIMAL(12,2) NULL"),
    ):
        if name in columns:
            cursor.execute(
                f"ALTER TABLE despesa_divisoes MODIFY COLUMN "
                f"{quote_mysql_identifier(name)} {definition}"
            )
    for name in ("created_at", "updated_at"):
        if name in columns:
            cursor.execute(
                f"ALTER TABLE despesa_divisoes MODIFY COLUMN "
                f"{quote_mysql_identifier(name)} "
                "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
            )
    cursor.execute(
        "ALTER TABLE despesa_divisoes MODIFY COLUMN usuario_id "
        "BIGINT UNSIGNED NOT NULL"
    )
    cursor.execute(
        "ALTER TABLE despesa_divisoes MODIFY COLUMN tipo "
        "ENUM('igual','porcentagem','valores') NOT NULL"
    )
    cursor.execute(
        "ALTER TABLE despesa_divisoes MODIFY COLUMN valor DECIMAL(12,2) NOT NULL"
    )
    cursor.execute(
        "ALTER TABLE despesa_divisoes MODIFY COLUMN criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )
    _ensure_index(
        cursor,
        "despesa_divisoes",
        "uq_despesa_divisao_usuario",
        ("despesa_id", "usuario_id"),
        unique=True,
    )
    _ensure_index(
        cursor, "despesa_divisoes", "idx_divisao_usuario", ("usuario_id",)
    )
    _ensure_foreign_key(
        cursor,
        "despesa_divisoes",
        "usuario_id",
        "fk_divisao_usuario",
        "usuarios",
        "RESTRICT",
    )


def _apply_pagamentos_migration(cursor: MigrationCursor) -> None:
    columns = _columns(cursor, "pagamentos")
    if (
        {"pagador_id", "recebedor_id", "criado_em"}.issubset(columns)
        and not _legacy_columns_need_adjustment(
            columns,
            {
                "pagador_participante_id",
                "recebedor_participante_id",
                "registrado_por",
            },
            {"created_at"},
        )
        and ("metodo" not in columns or "enum(" not in columns["metodo"][0].lower())
    ):
        return

    for old_column, target_column in (
        ("pagador_participante_id", "pagador_id"),
        ("recebedor_participante_id", "recebedor_id"),
    ):
        if old_column in columns:
            if _count(
                cursor,
                f"""
                SELECT COUNT(*)
                FROM pagamentos pg
                LEFT JOIN participantes p
                  ON p.id = pg.{quote_mysql_identifier(old_column)}
                  AND p.grupo_id = pg.grupo_id
                WHERE pg.{quote_mysql_identifier(old_column)} IS NOT NULL
                  AND p.id IS NULL
                """,
            ):
                raise RuntimeError(
                    "Migração de pagamentos interrompida: participante legado inexistente."
                )
        elif target_column not in columns and _count(
            cursor, "SELECT COUNT(*) FROM pagamentos"
        ):
            raise RuntimeError(
                "Migração de pagamentos interrompida: participante sem correspondência."
            )

    additions = {
        "pagador_id": "BIGINT UNSIGNED NULL",
        "recebedor_id": "BIGINT UNSIGNED NULL",
        "criado_em": "DATETIME NULL",
    }
    for name, definition in additions.items():
        if name not in columns:
            cursor.execute(
                f"ALTER TABLE pagamentos ADD COLUMN "
                f"{quote_mysql_identifier(name)} {definition}"
            )
    for old_column, target_column in (
        ("pagador_participante_id", "pagador_id"),
        ("recebedor_participante_id", "recebedor_id"),
    ):
        if old_column in columns:
            cursor.execute(
                f"""
                UPDATE pagamentos pg
                JOIN participantes p
                  ON p.id = pg.{quote_mysql_identifier(old_column)}
                  AND p.grupo_id = pg.grupo_id
                SET pg.{quote_mysql_identifier(target_column)} = p.usuario_id
                WHERE pg.{quote_mysql_identifier(target_column)} IS NULL
                """
            )
    if "created_at" in columns:
        cursor.execute(
            "UPDATE pagamentos SET criado_em = created_at "
            "WHERE criado_em IS NULL"
        )
    cursor.execute(
        "UPDATE pagamentos SET criado_em = CURRENT_TIMESTAMP "
        "WHERE criado_em IS NULL"
    )
    if _count(
        cursor,
        "SELECT COUNT(*) FROM pagamentos "
        "WHERE pagador_id IS NULL OR recebedor_id IS NULL OR valor IS NULL",
    ):
        raise RuntimeError(
            "Migração de pagamentos interrompida: campos essenciais sem correspondência."
        )

    for name in (
        "pagador_participante_id",
        "recebedor_participante_id",
        "registrado_por",
    ):
        if name in columns:
            cursor.execute(
                f"ALTER TABLE pagamentos MODIFY COLUMN "
                f"{quote_mysql_identifier(name)} "
                "BIGINT UNSIGNED NULL"
            )
    if "metodo" in columns:
        cursor.execute(
            "ALTER TABLE pagamentos MODIFY COLUMN metodo VARCHAR(50) NULL"
        )
    if "created_at" in columns:
        cursor.execute(
            "ALTER TABLE pagamentos MODIFY COLUMN created_at "
            "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
        )
    for name in ("pagador_id", "recebedor_id"):
        cursor.execute(
            f"ALTER TABLE pagamentos MODIFY COLUMN "
            f"{quote_mysql_identifier(name)} "
            "BIGINT UNSIGNED NOT NULL"
        )
    cursor.execute(
        "ALTER TABLE pagamentos MODIFY COLUMN criado_em "
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    )
    _ensure_index(
        cursor, "pagamentos", "idx_pagamentos_pagador_usuario", ("pagador_id",)
    )
    _ensure_index(
        cursor,
        "pagamentos",
        "idx_pagamentos_recebedor_usuario",
        ("recebedor_id",),
    )
    _ensure_foreign_key(
        cursor,
        "pagamentos",
        "pagador_id",
        "fk_pagamento_pagador_usuario",
        "usuarios",
        "RESTRICT",
    )
    _ensure_foreign_key(
        cursor,
        "pagamentos",
        "recebedor_id",
        "fk_pagamento_recebedor_usuario",
        "usuarios",
        "RESTRICT",
    )


def apply_legacy_finance_migrations(cursor: MigrationCursor) -> None:
    _apply_despesas_migration(cursor)
    _apply_divisoes_migration(cursor)
    _apply_pagamentos_migration(cursor)

from typing import Any

import pytest

from database.connection import (
    _apply_email_confirmation_migration,
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


def test_email_migration_adds_confirmation_as_verified_for_existing_users():
    cursor = FakeCursor(columns={"usuarios": {"id": "bigint unsigned"}})

    _apply_email_confirmation_migration(cursor)

    assert cursor.statements[1][0] == (
        "ALTER TABLE usuarios ADD COLUMN email_verificado "
        "TINYINT(1) NOT NULL DEFAULT 1"
    )
    assert cursor.statements[2][0] == (
        "ALTER TABLE usuarios MODIFY COLUMN email_verificado "
        "TINYINT(1) NOT NULL DEFAULT 0"
    )
    migration_update = cursor.statements[3][0]
    assert "UPDATE usuarios AS u" in migration_update
    assert "email_verificado = 0" in migration_update
    assert "email_verification_tokens" in migration_update


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

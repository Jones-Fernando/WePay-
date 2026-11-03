from typing import Any

import pytest

from database.legacy_invite_migrations import apply_legacy_invitation_migration


class FakeCursor:
    def __init__(
        self,
        columns: dict[str, tuple[str, str, Any]],
        indexes: list[tuple[Any, ...]] | None = None,
        foreign_keys: set[str] | None = None,
        counts: list[int] | None = None,
    ) -> None:
        self.columns = columns
        self.indexes = indexes or []
        self.foreign_keys = foreign_keys or set()
        self.counts = list(counts or [])
        self.result: list[Any] = []
        self.statements: list[tuple[str, Any]] = []

    def execute(self, operation: str, params: Any = None) -> None:
        self.statements.append((operation, params))
        if operation.startswith("SHOW COLUMNS FROM"):
            self.result = [
                (name, column_type, nullable, "", default, "")
                for name, (column_type, nullable, default) in self.columns.items()
            ]
        elif operation.startswith("SHOW INDEX FROM"):
            self.result = self.indexes
        elif "information_schema.KEY_COLUMN_USAGE" in operation:
            column = params[0]
            self.result = [(1,)] if column in self.foreign_keys else []
        else:
            self.result = []

    def fetchall(self) -> list[Any]:
        return self.result

    def fetchone(self) -> tuple[int]:
        return (self.counts.pop(0),)


def _legacy_cursor(counts: list[int] | None = None) -> FakeCursor:
    return FakeCursor(
        columns={
            "id": ("bigint unsigned", "NO", None),
            "grupo_id": ("bigint unsigned", "NO", None),
            "convidado_por": ("bigint unsigned", "NO", None),
            "email_convidado": ("varchar(180)", "NO", None),
            "token_hash": ("char(64)", "NO", None),
            "status": ("enum('PENDENTE','ACEITO','RECUSADO','EXPIRADO','CANCELADO')", "NO", "PENDENTE"),
            "expira_at": ("datetime", "NO", None),
            "aceito_at": ("datetime", "YES", None),
            "created_at": ("datetime", "NO", "CURRENT_TIMESTAMP"),
        },
        indexes=[
            ("convites_grupo", 0, "uk_convite_token_hash", 1, "token_hash"),
            ("convites_grupo", 1, "idx_convites_email_status", 1, "email_convidado"),
            ("convites_grupo", 1, "idx_convites_grupo_status", 1, "grupo_id"),
        ],
        foreign_keys={"convidado_por"},
        counts=counts or [1, 0, 0],
    )


def test_invitation_migration_maps_legacy_columns_and_preserves_them():
    cursor = _legacy_cursor()

    apply_legacy_invitation_migration(cursor)

    statements = "\n".join(operation for operation, _ in cursor.statements)
    normalized = " ".join(statements.split())
    assert "ADD COLUMN `email` VARCHAR(255) NULL" in normalized
    assert "SET `email` = `email_convidado`" in normalized
    assert "SET `expires_at` = `expira_at`" in normalized
    assert "SET `criado_por` = `convidado_por`" in normalized
    assert "SET `criado_em` = `created_at`" in normalized
    assert "SET `usado_em` = COALESCE(`aceito_at`, CURRENT_TIMESTAMP)" in normalized
    assert "WHERE `usado_em` IS NULL AND `status` <> 'PENDENTE'" in normalized
    assert "MODIFY COLUMN `email_convidado` varchar(180) NULL" in normalized
    assert "MODIFY COLUMN `expira_at` datetime NULL" in normalized
    assert "MODIFY COLUMN `convidado_por` bigint unsigned NULL" in normalized
    assert "DROP COLUMN" not in normalized
    assert "ADD CONSTRAINT `fk_convite_criador`" in normalized
    assert "ADD INDEX `idx_convite_email` (`email`)" in normalized
    assert "ADD INDEX `idx_convite_expiracao` (`expires_at`)" in normalized


def test_invitation_migration_stops_when_legacy_required_fields_are_missing():
    cursor = FakeCursor(
        columns={
            "id": ("bigint unsigned", "NO", None),
            "grupo_id": ("bigint unsigned", "NO", None),
            "token_hash": ("char(64)", "NO", None),
        },
        counts=[1],
    )

    with pytest.raises(RuntimeError, match="não há campos legados"):
        apply_legacy_invitation_migration(cursor)

    assert not any(
        operation.startswith("ALTER TABLE") for operation, _ in cursor.statements
    )

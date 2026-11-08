from typing import Any

import pytest

from database.legacy_recovery_migrations import apply_legacy_recovery_migration


class FakeCursor:
    def __init__(
        self,
        columns: dict[str, tuple[str, str, Any]],
        counts: list[int] | None = None,
    ) -> None:
        self.columns = columns
        self.counts = list(counts or [])
        self.result: list[Any] = []
        self.statements: list[str] = []

    def execute(self, operation: str, params: Any = None) -> None:
        self.statements.append(operation)
        if operation.startswith("SHOW COLUMNS FROM"):
            self.result = [
                (name, column_type, nullable, "", default, "")
                for name, (column_type, nullable, default) in self.columns.items()
            ]
        else:
            self.result = []

    def fetchall(self) -> list[Any]:
        return self.result

    def fetchone(self) -> tuple[int]:
        return (self.counts.pop(0) if self.counts else 0,)


def _legacy_cursor(counts: list[int] | None = None) -> FakeCursor:
    return FakeCursor(
        columns={
            "id": ("bigint unsigned", "NO", None),
            "usuario_id": ("bigint unsigned", "NO", None),
            "token_hash": ("char(64)", "NO", None),
            "expira_at": ("datetime", "NO", None),
            "usado_at": ("datetime", "YES", None),
            "created_at": ("datetime", "NO", "CURRENT_TIMESTAMP"),
        },
        counts=counts or [1, 0],
    )


def test_recovery_migration_preserves_legacy_columns_and_maps_values():
    cursor = _legacy_cursor()

    apply_legacy_recovery_migration(cursor)

    statements = "\n".join(cursor.statements)
    assert "ADD COLUMN `expires_at` DATETIME NULL" in statements
    assert "ADD COLUMN `usado_em` DATETIME NULL" in statements
    assert "ADD COLUMN `criado_em` DATETIME NULL" in statements
    assert "SET `expires_at` = `expira_at`" in statements
    assert "SET `usado_em` = `usado_at`" in statements
    assert "SET `criado_em` = `created_at`" in statements
    assert "MODIFY COLUMN `expira_at` datetime NULL" in statements
    assert "MODIFY COLUMN `created_at` datetime NULL" in statements
    assert "DROP COLUMN" not in statements


def test_recovery_migration_stops_if_legacy_required_fields_are_missing():
    cursor = FakeCursor(
        columns={
            "id": ("bigint unsigned", "NO", None),
            "usuario_id": ("bigint unsigned", "NO", None),
            "token_hash": ("char(64)", "NO", None),
        },
        counts=[1],
    )

    with pytest.raises(RuntimeError, match="não há campos legados"):
        apply_legacy_recovery_migration(cursor)

    assert not any(
        statement.startswith("ALTER TABLE") for statement in cursor.statements
    )

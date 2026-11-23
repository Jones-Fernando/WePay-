"""Cria o banco e o usuário locais usados exclusivamente pela suíte pytest."""

import os
import re
import sys
from pathlib import Path

import mysql.connector
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import Config

TEST_DATABASE = "wepay_test"
TEST_ENV_FILE = Path(__file__).resolve().parents[1] / ".env.test"
TEST_ENV_EXAMPLE = Path(__file__).resolve().parents[1] / ".env.test.example"


def main() -> None:
    admin_user = os.getenv("DB_ADMIN_USER", "").strip()
    admin_password = os.getenv("DB_ADMIN_PASSWORD")
    if not admin_user or admin_password is None:
        raise RuntimeError(
            "Defina DB_ADMIN_USER e DB_ADMIN_PASSWORD no ambiente "
            "somente durante a configuração do banco de testes."
        )

    test_config_path = (
        TEST_ENV_FILE if TEST_ENV_FILE.exists() else TEST_ENV_EXAMPLE
    )
    test_config = dotenv_values(test_config_path)
    test_user = (test_config.get("DB_USER") or "").strip()
    test_password = test_config.get("DB_PASSWORD")
    if not re.fullmatch(r"[A-Za-z0-9_]+", test_user) or not test_password:
        raise RuntimeError(
            f"DB_USER e DB_PASSWORD válidos são necessários em {test_config_path}."
        )

    connection = mysql.connector.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=admin_user,
        password=admin_password,
    )
    cursor = connection.cursor()
    try:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{TEST_DATABASE}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        for host in ("localhost", "127.0.0.1"):
            account = f"'{test_user}'@'{host}'"
            cursor.execute(
                f"CREATE USER IF NOT EXISTS {account} IDENTIFIED BY %s",
                (test_password,),
            )
            cursor.execute(
                f"ALTER USER {account} IDENTIFIED BY %s",
                (test_password,),
            )
            cursor.execute(
                f"GRANT ALL PRIVILEGES ON `{TEST_DATABASE}`.* "
                f"TO {account}"
            )
        connection.commit()
    finally:
        cursor.close()
        connection.close()

    print("Banco e usuário de teste configurados.")


if __name__ == "__main__":
    main()

"""Cria o banco e o usuário locais usados exclusivamente pela suíte pytest."""

import sys
from pathlib import Path

import mysql.connector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import Config

TEST_DATABASE = "wepay_test"
TEST_USER = "wepay_test"
TEST_PASSWORD = "wepay_test"


def main() -> None:
    connection = mysql.connector.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
    )
    cursor = connection.cursor()
    try:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{TEST_DATABASE}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        for host in ("localhost", "127.0.0.1"):
            cursor.execute(
                f"CREATE USER IF NOT EXISTS '{TEST_USER}'@'{host}' "
                f"IDENTIFIED BY '{TEST_PASSWORD}'"
            )
            cursor.execute(
                f"GRANT ALL PRIVILEGES ON `{TEST_DATABASE}`.* "
                f"TO '{TEST_USER}'@'{host}'"
            )
        cursor.execute("FLUSH PRIVILEGES")
        connection.commit()
    finally:
        cursor.close()
        connection.close()

    print("Banco e usuário de teste configurados.")


if __name__ == "__main__":
    main()

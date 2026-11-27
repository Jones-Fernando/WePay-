import check


def test_mysql_diagnostic_uses_application_connection_and_closes(monkeypatch, capsys):
    calls = []

    class ConnectionDouble:
        def get_server_info(self):
            return "8.0.test"

        def close(self):
            calls.append(("close",))

    monkeypatch.setattr(
        check,
        "_connect_mysql",
        lambda database: calls.append(("connect", database)) or ConnectionDouble(),
    )

    check.verificar_mysql()

    assert calls == [("connect", check.Config.DB_NAME), ("close",)]
    assert capsys.readouterr().out == "MySQL OK: 8.0.test\n"

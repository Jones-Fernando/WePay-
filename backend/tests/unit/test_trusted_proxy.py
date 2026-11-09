from flask import Flask, request

from utils.trusted_proxy import TrustedProxyFix


def create_client(proxy_cidrs=("10.0.0.0/8",), trusted_hops=1):
    app = Flask(__name__)

    @app.get("/client-address")
    def client_address():
        return {
            "remote_addr": request.remote_addr,
            "scheme": request.scheme,
            "host": request.host,
        }

    app.wsgi_app = TrustedProxyFix(
        app.wsgi_app,
        trusted_hops=trusted_hops,
        trusted_proxy_cidrs=proxy_cidrs,
    )
    return app.test_client()


def test_uses_forwarded_client_ip_from_configured_proxy():
    client = create_client()

    response = client.get(
        "/client-address",
        headers={
            "X-Forwarded-For": "198.51.100.27",
            "X-Forwarded-Proto": "https",
            "X-Forwarded-Host": "attacker.example",
        },
        environ_overrides={"REMOTE_ADDR": "10.1.2.3"},
    )

    assert response.get_json() == {
        "remote_addr": "198.51.100.27",
        "scheme": "http",
        "host": "localhost",
    }


def test_ignores_spoofed_forwarded_ip_from_untrusted_peer():
    client = create_client()

    response = client.get(
        "/client-address",
        headers={
            "X-Forwarded-For": "198.51.100.27",
            "X-Forwarded-Proto": "https",
        },
        environ_overrides={"REMOTE_ADDR": "203.0.113.15"},
    )

    assert response.get_json() == {
        "remote_addr": "203.0.113.15",
        "scheme": "http",
        "host": "localhost",
    }


def test_trusts_only_configured_number_of_proxy_hops():
    client = create_client(trusted_hops=2)

    response = client.get(
        "/client-address",
        headers={"X-Forwarded-For": "198.51.100.27, 10.1.2.3"},
        environ_overrides={"REMOTE_ADDR": "10.4.5.6"},
    )

    assert response.get_json()["remote_addr"] == "198.51.100.27"


def test_rejects_empty_or_invalid_proxy_configuration():
    app = Flask(__name__)

    try:
        TrustedProxyFix(app.wsgi_app, 1, ())
    except ValueError as exc:
        assert "Configure ao menos uma rede" in str(exc)
    else:
        raise AssertionError("CIDR vazio deveria ser rejeitado.")

    try:
        TrustedProxyFix(app.wsgi_app, 1, ("not-a-cidr",))
    except ValueError as exc:
        assert "rede inválida" in str(exc)
    else:
        raise AssertionError("CIDR inválido deveria ser rejeitado.")

    try:
        TrustedProxyFix(app.wsgi_app, 0, ("10.0.0.0/8",))
    except ValueError as exc:
        assert "trusted_hops" in str(exc)
    else:
        raise AssertionError("Contagem inválida deveria ser rejeitada.")

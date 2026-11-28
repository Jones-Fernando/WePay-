import app as backend_app


def test_payment_preflight_allows_idempotency_key_for_configured_origin(
    monkeypatch,
):
    allowed_origin = "https://frontend.example"
    monkeypatch.setattr(
        backend_app.Config,
        "CORS_ORIGINS",
        [allowed_origin],
    )
    client = backend_app.create_app().test_client()

    response = client.options(
        "/api/pagamentos",
        headers={
            "Origin": allowed_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": (
                "authorization,content-type,idempotency-key"
            ),
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == allowed_origin
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    allowed_headers = {
        header.strip().lower()
        for header in response.headers["Access-Control-Allow-Headers"].split(",")
    }
    assert {"authorization", "content-type", "idempotency-key"} <= allowed_headers


def test_cors_preflight_rejects_unconfigured_origin(monkeypatch):
    monkeypatch.setattr(
        backend_app.Config,
        "CORS_ORIGINS",
        ["https://frontend.example"],
    )
    client = backend_app.create_app().test_client()

    response = client.options(
        "/api/pagamentos",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "idempotency-key",
        },
    )

    assert "Access-Control-Allow-Origin" not in response.headers

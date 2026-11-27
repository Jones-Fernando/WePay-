from types import SimpleNamespace

import app as backend_app


def test_development_server_starts_and_stops_email_worker(monkeypatch):
    events = []
    worker_process = object()
    fake_app = SimpleNamespace(
        logger=SimpleNamespace(
            info=lambda message: events.append(("log", message))
        ),
        run=lambda **_kwargs: events.append(("api", None)),
    )

    monkeypatch.setattr(backend_app.Config, "ENVIRONMENT", "development")
    monkeypatch.setattr(backend_app, "create_app", lambda: fake_app)
    monkeypatch.setattr(
        backend_app,
        "_start_email_outbox_worker",
        lambda: events.append(("start", None)) or worker_process,
    )
    monkeypatch.setattr(
        backend_app,
        "_stop_email_outbox_worker",
        lambda process: events.append(("stop", process)),
    )
    monkeypatch.delenv("FLASK_DEBUG", raising=False)
    monkeypatch.delenv("WERKZEUG_RUN_MAIN", raising=False)

    backend_app.run_development_server()

    assert events[0] == ("start", None)
    assert events[1][0] == "log"
    assert events[2] == ("api", None)
    assert events[3] == ("stop", worker_process)


def test_debug_reloader_parent_does_not_start_duplicate_worker(monkeypatch):
    stopped_processes = []
    fake_app = SimpleNamespace(
        logger=SimpleNamespace(info=lambda _message: None),
        run=lambda **_kwargs: None,
    )

    monkeypatch.setattr(backend_app.Config, "ENVIRONMENT", "development")
    monkeypatch.setattr(backend_app, "create_app", lambda: fake_app)
    monkeypatch.setattr(
        backend_app,
        "_start_email_outbox_worker",
        lambda: (_ for _ in ()).throw(AssertionError("worker started")),
    )
    monkeypatch.setattr(
        backend_app,
        "_stop_email_outbox_worker",
        stopped_processes.append,
    )
    monkeypatch.setenv("FLASK_DEBUG", "true")
    monkeypatch.delenv("WERKZEUG_RUN_MAIN", raising=False)

    backend_app.run_development_server()

    assert stopped_processes == [None]

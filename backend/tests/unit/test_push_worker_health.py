import json
import os
from types import SimpleNamespace

from services import push_outbox_worker


def test_health_check_reports_healthy_worker_and_queue(monkeypatch, tmp_path, capsys):
    heartbeat = tmp_path / "push-worker.heartbeat"
    heartbeat.touch()
    monkeypatch.setenv("PUSH_WORKER_HEARTBEAT_FILE", str(heartbeat))
    monkeypatch.setattr(
        push_outbox_worker.PushOutboxModel,
        "health_snapshot",
        staticmethod(
            lambda: {
                "pending": 2,
                "processing": 1,
                "failed": 0,
                "sent": 30,
                "oldest_pending_age_seconds": 10,
                "stale_processing": 0,
            }
        ),
    )

    result = push_outbox_worker._health_check(
        SimpleNamespace(
            max_pending_count=10,
            max_pending_age_seconds=60,
            max_failed_count=0,
            heartbeat_max_age_seconds=15,
        )
    )

    assert result == 0
    assert json.loads(capsys.readouterr().out)["status"] == "ok"


def test_health_check_fails_for_stale_worker_and_queue(monkeypatch, tmp_path, capsys):
    heartbeat = tmp_path / "push-worker.heartbeat"
    heartbeat.touch()
    old_time = heartbeat.stat().st_mtime - 60
    os.utime(heartbeat, (old_time, old_time))
    monkeypatch.setenv("PUSH_WORKER_HEARTBEAT_FILE", str(heartbeat))
    monkeypatch.setattr(
        push_outbox_worker.PushOutboxModel,
        "health_snapshot",
        staticmethod(
            lambda: {
                "pending": 20,
                "processing": 1,
                "failed": 3,
                "sent": 30,
                "oldest_pending_age_seconds": 600,
                "stale_processing": 1,
            }
        ),
    )

    result = push_outbox_worker._health_check(
        SimpleNamespace(
            max_pending_count=10,
            max_pending_age_seconds=60,
            max_failed_count=0,
            heartbeat_max_age_seconds=15,
        )
    )

    resultado = json.loads(capsys.readouterr().out)
    assert result == 1
    assert resultado["status"] == "degraded"
    assert resultado["checks"] == {
        "heartbeat": False,
        "pending_count": False,
        "pending_age": False,
        "failed_events": False,
        "stale_processing": False,
    }

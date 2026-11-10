import importlib
import sys

import pytest

from config import Config


def test_wsgi_refuses_to_start_outside_production(monkeypatch):
    monkeypatch.setattr(Config, "ENVIRONMENT", "development")
    monkeypatch.delitem(sys.modules, "wsgi", raising=False)

    with pytest.raises(RuntimeError, match="WSGI requer APP_ENV=production"):
        importlib.import_module("wsgi")

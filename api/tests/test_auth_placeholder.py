from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.auth import deps


def set_demo_mode(monkeypatch, on: bool):
    monkeypatch.setattr(deps, "get_settings", lambda: SimpleNamespace(demo_mode=on))


async def test_placeholder_user_in_demo_mode(monkeypatch):
    set_demo_mode(monkeypatch, True)
    assert await deps.current_user() == deps.CurrentUser(id=deps.PLACEHOLDER_ACCOUNT_ID)


async def test_placeholder_refuses_outside_demo_mode(monkeypatch):
    set_demo_mode(monkeypatch, False)
    with pytest.raises(HTTPException) as exc:
        await deps.current_user()
    assert exc.value.status_code == 401

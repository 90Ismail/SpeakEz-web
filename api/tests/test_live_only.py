"""Only "live" notes ever leave the API: not processing, draft, held or blocked ones."""

import uuid
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.dialects import postgresql

from app.auth import deps
from app.db import get_session
from app.repositories import notes as notes_repo
from app.routes import notes as notes_routes
from app.services import notes as notes_service
from app.services import unlock as unlock_service

NOT_LIVE = ["processing", "draft", "held", "blocked"]
NOTE_ID = uuid.uuid4()
BBOX = (-93.25, 44.96, -93.22, 44.98)


class CapturingSession:
    """Records the statement /map sends and returns no rows."""

    def __init__(self):
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return SimpleNamespace(all=lambda: [])


@pytest.fixture(autouse=True)
def no_cache(monkeypatch):
    async def get_or_set(key, ttl, fn):
        return await fn()

    monkeypatch.setattr(notes_service, "get_or_set", get_or_set)
    monkeypatch.setattr(unlock_service, "get_or_set", get_or_set)


def compiled_sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


@pytest.mark.parametrize("status", NOT_LIVE)
async def test_map_query_only_selects_live_notes(status):
    session = CapturingSession()
    await notes_service.map_notes(session, BBOX)
    [stmt] = session.statements
    sql = compiled_sql(stmt)
    assert "notes.status = 'live'" in sql
    assert f"'{status}'" not in sql


@pytest.mark.parametrize("status", NOT_LIVE)
async def test_unlock_route_never_returns_non_live_note(monkeypatch, status):
    monkeypatch.setattr(
        unlock_service, "get_settings", lambda: SimpleNamespace(demo_mode=True, unlock_radius_m=150)
    )

    async def note_summary(session, note_id):
        return (status, "public", "walter-library", "Secret body.", None, "audios/secret.m4a")

    async def within_radius(session, landmark_id, lat, lng, radius_m):
        return True

    monkeypatch.setattr(notes_repo, "note_summary", note_summary)
    monkeypatch.setattr(notes_repo, "within_radius", within_radius)

    app = FastAPI()
    app.include_router(notes_routes.router)
    app.dependency_overrides[get_session] = lambda: None
    app.dependency_overrides[deps.current_user] = lambda: deps.CurrentUser(id=uuid.uuid4())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/notes/{NOTE_ID}/unlock", json={"lat": 44.97536, "lng": -93.2363})

    assert response.status_code == 404
    assert "Secret body" not in response.text
    assert "audios/secret" not in response.text

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

from app.auth.deps import PLACEHOLDER_ACCOUNT_ID
from app.db import get_session
from app.repositories import moderation as moderation_repo
from app.repositories import notes as notes_repo
from app.routes import notes as notes_routes
from app.schemas import PublishResponse
from app.services import publish as publish_service

NOTE_ID = uuid.uuid4()
AUTHOR_ID = PLACEHOLDER_ACCOUNT_ID
BLOCKED_STATUSES = ["processing", "held", "blocked", "live"]


class FakeSession:
    def __init__(self):
        self.commits = 0

    async def commit(self):
        self.commits += 1


@pytest.fixture
def db(monkeypatch):
    """Stubs the repositories. Set db.row to (author_id, status) or None; read what was written."""
    state = SimpleNamespace(row=(AUTHOR_ID, "draft"), scheduled=[], logged=[])

    async def lock_for_publish(session, note_id):
        if state.row is None:
            return None
        author_id, status = state.row
        return SimpleNamespace(author_id=author_id, status=status)

    async def schedule_publish(session, note_id, publish_at, title):
        state.scheduled.append((note_id, publish_at, title))

    async def insert_log(session, note_id, layer, label, decision):
        state.logged.append((note_id, layer, label, decision))

    monkeypatch.setattr(notes_repo, "lock_for_publish", lock_for_publish)
    monkeypatch.setattr(notes_repo, "schedule_publish", schedule_publish)
    monkeypatch.setattr(moderation_repo, "insert_log", insert_log)
    return state


def set_demo_mode(monkeypatch, on: bool):
    monkeypatch.setattr(publish_service, "get_settings", lambda: SimpleNamespace(demo_mode=on))


async def test_draft_publishes_with_random_delay(monkeypatch, db):
    set_demo_mode(monkeypatch, False)
    session = FakeSession()
    before = datetime.now(timezone.utc)
    result = await publish_service.publish_note(session, NOTE_ID, AUTHOR_ID, None)

    [(note_id, publish_at, title)] = db.scheduled
    assert note_id == NOTE_ID and title is None
    assert before + timedelta(minutes=5) <= publish_at <= datetime.now(timezone.utc) + timedelta(minutes=30)
    assert result == {"id": NOTE_ID, "status": "draft", "live_within_minutes": 30}
    assert session.commits == 1


async def test_demo_mode_publishes_without_delay(monkeypatch, db):
    set_demo_mode(monkeypatch, True)
    before = datetime.now(timezone.utc)
    result = await publish_service.publish_note(FakeSession(), NOTE_ID, AUTHOR_ID, None)
    [(_, publish_at, _)] = db.scheduled
    assert before <= publish_at <= datetime.now(timezone.utc)
    assert result["live_within_minutes"] == 0


def test_publish_delay_bounds():
    assert publish_service.publish_delay(True) == timedelta(0)
    for _ in range(200):
        assert timedelta(minutes=5) <= publish_service.publish_delay(False) <= timedelta(minutes=30)


@pytest.mark.parametrize("demo_mode", [False, True])
@pytest.mark.parametrize("status", BLOCKED_STATUSES)
async def test_non_draft_refuses(monkeypatch, db, status, demo_mode):
    set_demo_mode(monkeypatch, demo_mode)
    db.row = (AUTHOR_ID, status)
    with pytest.raises(publish_service.NotPublishable) as exc:
        await publish_service.publish_note(FakeSession(), NOTE_ID, AUTHOR_ID, None)
    assert exc.value.status == status
    assert db.scheduled == []


async def test_demo_mode_still_refuses_held_note(monkeypatch, db):
    set_demo_mode(monkeypatch, True)
    db.row = (AUTHOR_ID, "held")
    with pytest.raises(publish_service.NotPublishable):
        await publish_service.publish_note(FakeSession(), NOTE_ID, AUTHOR_ID, "A nice title")
    assert db.scheduled == []


async def test_clean_title_is_checked_logged_and_saved(monkeypatch, db):
    set_demo_mode(monkeypatch, False)
    await publish_service.publish_note(FakeSession(), NOTE_ID, AUTHOR_ID, "Quiet night at Walter")
    assert db.logged == [(NOTE_ID, "lexicon", None, "draft")]
    assert db.scheduled[0][2] == "Quiet night at Walter"


@pytest.mark.parametrize("demo_mode", [False, True])
@pytest.mark.parametrize(
    "title,decision,label",
    [
        ("I want to unalive myself", "held", "self_harm.unalive"),
        ("gonna shoot up coffman", "blocked", "threat.attack_place"),
    ],
)
async def test_unsafe_title_refuses(monkeypatch, db, title, decision, label, demo_mode):
    set_demo_mode(monkeypatch, demo_mode)
    session = FakeSession()
    with pytest.raises(publish_service.TitleRefused) as exc:
        await publish_service.publish_note(session, NOTE_ID, AUTHOR_ID, title)
    assert exc.value.decision == decision
    assert db.logged == [(NOTE_ID, "lexicon", label, decision)]
    assert session.commits == 1  # the audit row is kept
    assert db.scheduled == []


async def test_status_is_checked_before_title(monkeypatch, db):
    set_demo_mode(monkeypatch, False)
    db.row = (AUTHOR_ID, "blocked")
    with pytest.raises(publish_service.NotPublishable):
        await publish_service.publish_note(FakeSession(), NOTE_ID, AUTHOR_ID, "Quiet night")
    assert db.logged == []


@pytest.mark.parametrize("row", [None, (uuid.uuid4(), "draft")])
async def test_missing_or_someone_elses_note_is_not_found(monkeypatch, db, row):
    set_demo_mode(monkeypatch, False)
    db.row = row
    with pytest.raises(publish_service.NoteNotFound):
        await publish_service.publish_note(FakeSession(), NOTE_ID, AUTHOR_ID, None)
    assert db.scheduled == []


def test_response_never_carries_author_id():
    assert "author_id" not in PublishResponse.model_fields


# HTTP layer: status codes and response shape.


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(notes_routes.router)
    app.dependency_overrides[get_session] = lambda: FakeSession()
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_route_publishes_draft(monkeypatch, db, client):
    set_demo_mode(monkeypatch, True)
    async with client:
        response = await client.post(f"/notes/{NOTE_ID}/publish", json={})
    assert response.status_code == 200
    assert response.json() == {"id": str(NOTE_ID), "status": "draft", "live_within_minutes": 0}
    assert "author" not in response.text


@pytest.mark.parametrize("status", BLOCKED_STATUSES)
async def test_route_returns_409_for_non_draft(monkeypatch, db, client, status):
    set_demo_mode(monkeypatch, True)
    db.row = (AUTHOR_ID, status)
    async with client:
        response = await client.post(f"/notes/{NOTE_ID}/publish", json={})
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "not_draft"
    assert response.json()["detail"]["status"] == status


async def test_route_held_title_tells_app_to_show_care(monkeypatch, db, client):
    set_demo_mode(monkeypatch, True)
    async with client:
        response = await client.post(f"/notes/{NOTE_ID}/publish", json={"title": "kms"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "title_held"


async def test_route_rejects_blank_title(monkeypatch, db, client):
    set_demo_mode(monkeypatch, True)
    async with client:
        response = await client.post(f"/notes/{NOTE_ID}/publish", json={"title": "   "})
    assert response.status_code == 422
    assert db.scheduled == []

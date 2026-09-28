import uuid
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

from app.auth import deps
from app.db import get_session
from app.repositories import notes as notes_repo
from app.routes import notes as notes_routes
from app.services import unlock as unlock_service

NOTE_ID = uuid.uuid4()
ACCOUNT_ID = uuid.uuid4()
WALTER = (44.97536, -93.2363)


@pytest.fixture(autouse=True)
def no_cache(monkeypatch):
    async def get_or_set(key, ttl, fn):
        return await fn()

    monkeypatch.setattr(unlock_service, "get_or_set", get_or_set)


@pytest.fixture(autouse=True)
def no_replies(monkeypatch):
    async def live_replies(session, parent_id):
        return []

    monkeypatch.setattr(notes_repo, "live_replies", live_replies)


@pytest.fixture(autouse=True)
def redis_store(monkeypatch):
    """In-memory stand-in for the Redis counters and last-unlock record."""
    store = {}

    async def incr_with_ttl(key, ttl):
        store[key] = store.get(key, 0) + 1
        return store[key]

    async def get_json(key):
        return store.get(key)

    async def set_json(key, value, ttl):
        store[key] = value

    monkeypatch.setattr(unlock_service, "incr_with_ttl", incr_with_ttl)
    monkeypatch.setattr(unlock_service, "get_json", get_json)
    monkeypatch.setattr(unlock_service, "set_json", set_json)
    return store


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    now = SimpleNamespace(value=1_000_000.0)
    monkeypatch.setattr(unlock_service, "time", SimpleNamespace(time=lambda: now.value))
    return now


def set_demo_mode(monkeypatch, on: bool):
    settings = SimpleNamespace(demo_mode=on, unlock_radius_m=150)
    monkeypatch.setattr(unlock_service, "get_settings", lambda: settings)
    monkeypatch.setattr(deps, "get_settings", lambda: settings)


@pytest.fixture(autouse=True)
def production_mode(monkeypatch):
    set_demo_mode(monkeypatch, False)


def patch_landmark_distance(monkeypatch, meters: float):
    async def landmark_distance_m(session, a, b):
        return meters

    monkeypatch.setattr(notes_repo, "landmark_distance_m", landmark_distance_m)


def note_row(
    status="live",
    visibility="public",
    landmark_id="walter-library",
    body="One.\n\nTwo.",
    words=None,
    audio_key=None,
):
    return (status, visibility, landmark_id, body, words, audio_key)


def patch_note(monkeypatch, row):
    async def note_summary(session, note_id):
        return row

    monkeypatch.setattr(notes_repo, "note_summary", note_summary)


def patch_distance(monkeypatch, near: bool):
    async def within_radius(session, landmark_id, lat, lng, radius_m):
        return near

    monkeypatch.setattr(notes_repo, "within_radius", within_radius)


async def test_unlock_returns_body_when_near(monkeypatch):
    patch_note(monkeypatch, note_row())
    patch_distance(monkeypatch, True)

    result = await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 44.97536, -93.2363)

    assert result["body"] == "One.\n\nTwo."
    assert result["words"] is None
    assert result["audio_url"] is None


async def test_unlock_signs_audio_when_present(monkeypatch):
    patch_note(monkeypatch, note_row(audio_key="audios/note.m4a"))
    patch_distance(monkeypatch, True)
    monkeypatch.setattr(
        unlock_service.storage, "signed_url", lambda key, ttl_seconds=60: f"/media/{key}?sig=test"
    )

    result = await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 44.97536, -93.2363)

    assert result["audio_url"] == "/media/audios/note.m4a?sig=test"


async def test_unlock_refuses_when_far(monkeypatch):
    patch_note(monkeypatch, note_row())
    patch_distance(monkeypatch, False)

    with pytest.raises(unlock_service.TooFar):
        await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 45.0, -93.3)


async def test_unlock_missing_note(monkeypatch):
    patch_note(monkeypatch, None)

    with pytest.raises(unlock_service.NoteNotFound):
        await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 44.97536, -93.2363)


@pytest.mark.parametrize("status", ["processing", "draft", "held", "blocked"])
async def test_unlock_only_live_notes(monkeypatch, status):
    patch_note(monkeypatch, note_row(status=status))
    patch_distance(monkeypatch, True)

    with pytest.raises(unlock_service.NoteNotFound):
        await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 44.97536, -93.2363)


async def test_unlock_never_opens_journal_entries(monkeypatch):
    patch_note(monkeypatch, note_row(visibility="journal"))
    patch_distance(monkeypatch, True)

    with pytest.raises(unlock_service.NoteNotFound):
        await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 44.97536, -93.2363)


async def test_unlock_returns_thread_oldest_first(monkeypatch):
    from datetime import datetime, timezone
    from types import SimpleNamespace

    patch_note(monkeypatch, note_row())
    patch_distance(monkeypatch, True)
    first = SimpleNamespace(
        id=uuid.uuid4(), body="First reply.", audio_key=None, duration_sec=30,
        created_at=datetime(2026, 9, 28, 3, 0, tzinfo=timezone.utc),
    )
    second = SimpleNamespace(
        id=uuid.uuid4(), body="Second reply.", audio_key=None, duration_sec=20,
        created_at=datetime(2026, 9, 28, 4, 0, tzinfo=timezone.utc),
    )

    async def live_replies(session, parent_id):
        assert parent_id == NOTE_ID
        return [first, second]

    monkeypatch.setattr(notes_repo, "live_replies", live_replies)

    result = await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 44.97536, -93.2363)

    assert [reply["body"] for reply in result["replies"]] == ["First reply.", "Second reply."]
    assert result["body"] == "One.\n\nTwo."


async def test_far_away_never_sees_the_thread(monkeypatch):
    patch_note(monkeypatch, note_row())
    patch_distance(monkeypatch, False)

    async def live_replies(session, parent_id):
        raise AssertionError("replies must not load before the distance check passes")

    monkeypatch.setattr(notes_repo, "live_replies", live_replies)

    with pytest.raises(unlock_service.TooFar):
        await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, 45.0, -93.3)


async def unlock_at(landmark_id="walter-library", position=WALTER):
    return await unlock_service.unlock_note(None, NOTE_ID, ACCOUNT_ID, *position)


def setup_note(monkeypatch, landmark_id="walter-library", near=True):
    patch_note(monkeypatch, note_row(landmark_id=landmark_id))
    patch_distance(monkeypatch, near)


async def test_rate_limit_refuses_after_twenty_an_hour(monkeypatch):
    setup_note(monkeypatch)
    for _ in range(unlock_service.UNLOCK_RATE_LIMIT):
        await unlock_at()
    with pytest.raises(unlock_service.RateLimited):
        await unlock_at()


async def test_rate_limit_counts_failed_attempts(monkeypatch):
    setup_note(monkeypatch, near=False)
    for _ in range(unlock_service.UNLOCK_RATE_LIMIT):
        with pytest.raises(unlock_service.TooFar):
            await unlock_at()
    with pytest.raises(unlock_service.RateLimited):
        await unlock_at()


async def test_rate_limit_is_per_account(monkeypatch):
    setup_note(monkeypatch)
    for _ in range(unlock_service.UNLOCK_RATE_LIMIT):
        await unlock_at()
    await unlock_service.unlock_note(None, NOTE_ID, uuid.uuid4(), *WALTER)


async def test_impossible_travel_is_refused(monkeypatch, clock):
    setup_note(monkeypatch, "walter-library")
    await unlock_at()
    setup_note(monkeypatch, "wilson-library")
    patch_landmark_distance(monkeypatch, 1300)
    clock.value += 10
    with pytest.raises(unlock_service.ImpossibleTravel):
        await unlock_at("wilson-library")


async def test_plausible_travel_is_allowed(monkeypatch, clock):
    setup_note(monkeypatch, "walter-library")
    await unlock_at()
    setup_note(monkeypatch, "wilson-library")
    patch_landmark_distance(monkeypatch, 1300)
    clock.value += 300  # 1.3 km in 5 minutes: a brisk walk or a bike
    await unlock_at("wilson-library")


async def test_refused_travel_keeps_the_previous_unlock(monkeypatch, clock, redis_store):
    setup_note(monkeypatch, "walter-library")
    await unlock_at()
    setup_note(monkeypatch, "wilson-library")
    patch_landmark_distance(monkeypatch, 1300)
    clock.value += 10
    with pytest.raises(unlock_service.ImpossibleTravel):
        await unlock_at("wilson-library")
    assert redis_store[f"unlock:last:{ACCOUNT_ID}"]["landmark_id"] == "walter-library"


async def test_only_landmark_and_time_are_stored(monkeypatch, redis_store):
    setup_note(monkeypatch)
    await unlock_at()
    last = redis_store[f"unlock:last:{ACCOUNT_ID}"]
    assert last == {"landmark_id": "walter-library", "at": 1_000_000}
    stored = repr(redis_store)
    assert str(WALTER[0]) not in stored and str(WALTER[1]) not in stored


async def test_demo_mode_skips_rate_limit_and_travel_check(monkeypatch, clock, redis_store):
    set_demo_mode(monkeypatch, True)
    setup_note(monkeypatch, "walter-library")
    for _ in range(unlock_service.UNLOCK_RATE_LIMIT + 5):
        await unlock_at()
    setup_note(monkeypatch, "wilson-library")
    patch_landmark_distance(monkeypatch, 1300)
    clock.value += 1
    await unlock_at("wilson-library")
    assert not any(key.startswith("unlock:") for key in redis_store)
    assert redis_store[f"unlocked:{ACCOUNT_ID}:{NOTE_ID}"] is True


async def test_demo_mode_still_checks_distance(monkeypatch):
    set_demo_mode(monkeypatch, True)
    setup_note(monkeypatch, near=False)
    with pytest.raises(unlock_service.TooFar):
        await unlock_at()


# HTTP layer


UNLOCK_BODY = {"lat": WALTER[0], "lng": WALTER[1]}


def make_client(signed_in: bool):
    app = FastAPI()
    app.include_router(notes_routes.router)
    app.dependency_overrides[get_session] = lambda: None
    if signed_in:
        app.dependency_overrides[deps.current_user] = lambda: deps.CurrentUser(id=ACCOUNT_ID)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_route_requires_a_signed_in_user(monkeypatch):
    setup_note(monkeypatch)
    async with make_client(signed_in=False) as client:
        response = await client.post(f"/notes/{NOTE_ID}/unlock", json=UNLOCK_BODY)
    assert response.status_code == 401


async def test_route_returns_429_when_rate_limited(monkeypatch):
    setup_note(monkeypatch)
    async with make_client(signed_in=True) as client:
        for _ in range(unlock_service.UNLOCK_RATE_LIMIT):
            response = await client.post(f"/notes/{NOTE_ID}/unlock", json=UNLOCK_BODY)
            assert response.status_code == 200
        response = await client.post(f"/notes/{NOTE_ID}/unlock", json=UNLOCK_BODY)
    assert response.status_code == 429


async def test_route_returns_403_for_impossible_travel(monkeypatch, clock):
    setup_note(monkeypatch, "walter-library")
    async with make_client(signed_in=True) as client:
        assert (await client.post(f"/notes/{NOTE_ID}/unlock", json=UNLOCK_BODY)).status_code == 200
        setup_note(monkeypatch, "wilson-library")
        patch_landmark_distance(monkeypatch, 1300)
        clock.value += 10
        response = await client.post(f"/notes/{NOTE_ID}/unlock", json=UNLOCK_BODY)
    assert response.status_code == 403

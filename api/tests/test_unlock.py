import uuid

import pytest

from app.repositories import notes as notes_repo
from app.services import unlock as unlock_service

NOTE_ID = uuid.uuid4()


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

    result = await unlock_service.unlock_note(None, NOTE_ID, 44.97536, -93.2363)

    assert result["body"] == "One.\n\nTwo."
    assert result["words"] is None
    assert result["audio_url"] is None


async def test_unlock_signs_audio_when_present(monkeypatch):
    patch_note(monkeypatch, note_row(audio_key="audios/note.m4a"))
    patch_distance(monkeypatch, True)
    monkeypatch.setattr(
        unlock_service.storage, "signed_url", lambda key, ttl_seconds=60: f"/media/{key}?sig=test"
    )

    result = await unlock_service.unlock_note(None, NOTE_ID, 44.97536, -93.2363)

    assert result["audio_url"] == "/media/audios/note.m4a?sig=test"


async def test_unlock_refuses_when_far(monkeypatch):
    patch_note(monkeypatch, note_row())
    patch_distance(monkeypatch, False)

    with pytest.raises(unlock_service.TooFar):
        await unlock_service.unlock_note(None, NOTE_ID, 45.0, -93.3)


async def test_unlock_missing_note(monkeypatch):
    patch_note(monkeypatch, None)

    with pytest.raises(unlock_service.NoteNotFound):
        await unlock_service.unlock_note(None, NOTE_ID, 44.97536, -93.2363)


@pytest.mark.parametrize("status", ["processing", "draft", "held", "blocked"])
async def test_unlock_only_live_notes(monkeypatch, status):
    patch_note(monkeypatch, note_row(status=status))
    patch_distance(monkeypatch, True)

    with pytest.raises(unlock_service.NoteNotFound):
        await unlock_service.unlock_note(None, NOTE_ID, 44.97536, -93.2363)


async def test_unlock_never_opens_journal_entries(monkeypatch):
    patch_note(monkeypatch, note_row(visibility="journal"))
    patch_distance(monkeypatch, True)

    with pytest.raises(unlock_service.NoteNotFound):
        await unlock_service.unlock_note(None, NOTE_ID, 44.97536, -93.2363)


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

    result = await unlock_service.unlock_note(None, NOTE_ID, 44.97536, -93.2363)

    assert [reply["body"] for reply in result["replies"]] == ["First reply.", "Second reply."]
    assert result["body"] == "One.\n\nTwo."


async def test_far_away_never_sees_the_thread(monkeypatch):
    patch_note(monkeypatch, note_row())
    patch_distance(monkeypatch, False)

    async def live_replies(session, parent_id):
        raise AssertionError("replies must not load before the distance check passes")

    monkeypatch.setattr(notes_repo, "live_replies", live_replies)

    with pytest.raises(unlock_service.TooFar):
        await unlock_service.unlock_note(None, NOTE_ID, 45.0, -93.3)

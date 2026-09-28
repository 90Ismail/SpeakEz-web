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


def note_row(status="live", landmark_id="walter-library", body="One.\n\nTwo.", words=None, audio_key=None):
    return (status, landmark_id, body, words, audio_key)


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

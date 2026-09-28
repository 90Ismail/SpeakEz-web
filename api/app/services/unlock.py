import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from .. import storage
from ..cache import get_or_set
from ..config import get_settings
from ..repositories import notes as notes_repo

NOTE_CACHE_TTL_SECONDS = 300


class NoteNotFound(Exception):
    pass


class TooFar(Exception):
    pass


async def _load_note(session: AsyncSession, note_id: uuid.UUID) -> dict | None:
    row = await notes_repo.note_summary(session, note_id)
    if row is None:
        return None
    status, landmark_id, body, words, audio_key = row
    return {
        "status": status,
        "landmark_id": landmark_id,
        "body": body,
        "words": words,
        "audio_key": audio_key,
    }


async def unlock_note(
    session: AsyncSession, note_id: uuid.UUID, lat: float, lng: float
) -> dict:
    """Return body, words and a signed audio URL once the server confirms the position."""
    note = await get_or_set(
        f"note:{note_id}", NOTE_CACHE_TTL_SECONDS, lambda: _load_note(session, note_id)
    )
    if note is None or note["status"] != "live":
        raise NoteNotFound

    near = await notes_repo.within_radius(
        session, note["landmark_id"], lat, lng, get_settings().unlock_radius_m
    )
    if not near:
        raise TooFar

    return {
        "body": note["body"] or "",
        "words": note["words"],
        "audio_url": storage.signed_url(note["audio_key"]) if note["audio_key"] else None,
    }

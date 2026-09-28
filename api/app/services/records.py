"""The write path: upload a recording, submit it to the worker, read the draft back.

Routes call these; they own the rules (public notes need a landmark, only the
author sees a draft) and the repositories. Nothing here returns an author id.
"""

import asyncio
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from .. import storage
from ..queue import enqueue_process_note
from ..repositories import notes as notes_repo

MAX_DURATION_SEC = 180

# Phone recorders hand us m4a/AAC; keep whatever the client sent so ffmpeg can read it.
_EXTENSIONS = {"m4a": "m4a", "mp4": "m4a", "aac": "m4a", "wav": "wav", "caf": "caf", "mp3": "mp3"}
_MEDIA_TYPES = {
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/x-caf": "caf",
    "audio/mpeg": "mp3",
}


class NoteNotFound(Exception):
    """Missing, or not the caller's. Both look the same so drafts don't leak."""


class NoteNotProcessing(Exception):
    def __init__(self, status: str):
        super().__init__(status)
        self.status = status


class LandmarkNotFound(Exception):
    pass


class InvalidVisibility(Exception):
    pass


def audio_extension(filename: str | None, content_type: str | None) -> str:
    """Pick a safe extension from the upload, defaulting to m4a (the phone recorder's format)."""
    if content_type:
        from_type = _MEDIA_TYPES.get(content_type.split(";")[0].strip().lower())
        if from_type:
            return from_type
    if filename and "." in filename:
        suffix = filename.rsplit(".", 1)[-1].lower()
        if suffix in _EXTENSIONS:
            return _EXTENSIONS[suffix]
    return "m4a"


async def create_note(
    session: AsyncSession,
    account_id: uuid.UUID,
    *,
    landmark_id: str | None,
    duration_sec: int,
    visibility: str,
    prompt_id: int | None,
    filename: str | None,
    content_type: str | None,
    data: bytes,
    parent_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Save the audio and insert a "processing" note. Returns its id.

    A reply (parent_id set) is always public and takes the parent's landmark: a
    reply belongs in the thread at the original post's place, never on the map alone.
    """
    if visibility not in ("public", "journal"):
        raise InvalidVisibility(visibility)
    if duration_sec < 1 or duration_sec > MAX_DURATION_SEC:
        duration_sec = max(1, min(duration_sec, MAX_DURATION_SEC))

    if parent_id is not None:
        parent = await notes_repo.parent_landmark(session, parent_id)
        if parent is None or parent.visibility != "public" or parent.status != "live":
            raise NoteNotFound
        visibility = "public"
        landmark_id = parent.landmark_id
    # A public post must sit at a real landmark; a journal entry has no place (hard rule 1).
    elif visibility == "public":
        if landmark_id is None or not await notes_repo.landmark_exists(session, landmark_id):
            raise LandmarkNotFound
    else:
        landmark_id = None

    note_id = uuid.uuid4()
    audio_key = f"audios/{note_id}.{audio_extension(filename, content_type)}"
    # Disk writes block; keep them off the event loop.
    await asyncio.to_thread(storage.save, audio_key, data)

    await notes_repo.create_note(
        session,
        note_id=note_id,
        author_id=account_id,
        landmark_id=landmark_id,
        visibility=visibility,
        prompt_id=prompt_id,
        duration_sec=duration_sec,
        audio_key=audio_key,
        parent_id=parent_id,
    )
    await session.commit()
    return note_id


async def submit_note(
    session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID
) -> str:
    """Queue a processing note for the worker. Returns the (unchanged) status."""
    row = await notes_repo.owned_status(session, note_id)
    if row is None or row.author_id != account_id:
        raise NoteNotFound
    if row.status != "processing":
        raise NoteNotProcessing(row.status)
    await enqueue_process_note(note_id)
    return row.status


async def get_draft(
    session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID
) -> dict:
    """Author-only view of a note after processing: status, title, transcript, words."""
    row = await notes_repo.draft_view(session, note_id)
    if row is None or row.author_id != account_id:
        raise NoteNotFound
    return {
        "id": note_id,
        "status": row.status,
        "title": row.title,
        "body": row.body,
        "words": row.words,
        "visibility": row.visibility,
    }

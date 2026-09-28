"""Publish a reviewed draft: the last gate before a note can go live.

The note must be the caller's, must be "draft" (only the worker's safety check sets that), and any
edited title must pass the same lexicon. Publishing only schedules publish_at; the scheduled job
flips "draft" to "live" once it passes.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..repositories import notes as notes_repo
from . import safety

# A random delay so the moment a note appears can't be matched to when someone walked away.
MIN_DELAY_MINUTES = 5
MAX_DELAY_MINUTES = 30


class NoteNotFound(Exception):
    """Missing, or not the caller's. Both look the same so drafts don't leak."""


class NotPublishable(Exception):
    def __init__(self, status: str):
        super().__init__(status)
        self.status = status


class TitleRefused(Exception):
    def __init__(self, decision: str):
        super().__init__(decision)
        self.decision = decision  # "held" | "blocked"


def publish_delay(demo_mode: bool) -> timedelta:
    if demo_mode:
        return timedelta(0)
    span = (MAX_DELAY_MINUTES - MIN_DELAY_MINUTES) * 60
    return timedelta(seconds=MIN_DELAY_MINUTES * 60 + secrets.randbelow(span + 1))


async def publish_note(
    session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID, title: str | None
) -> dict:
    row = await notes_repo.lock_for_publish(session, note_id)
    if row is None or row.author_id != account_id:
        raise NoteNotFound

    # Checked before anything else, and demo mode has no way around it.
    if row.status != "draft":
        raise NotPublishable(row.status)

    if title is not None:
        verdict = safety.check_transcript(title)
        await safety.record_verdict(session, note_id, verdict)
        if verdict.decision != "draft":
            await session.commit()  # keep the audit row even though the publish is refused
            raise TitleRefused(verdict.decision)

    demo_mode = get_settings().demo_mode
    publish_at = datetime.now(timezone.utc) + publish_delay(demo_mode)
    await notes_repo.schedule_publish(session, note_id, publish_at, title)
    await session.commit()
    return {
        "id": note_id,
        "status": "draft",
        "live_within_minutes": 0 if demo_mode else MAX_DELAY_MINUTES,
    }

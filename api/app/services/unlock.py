import time
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from .. import storage
from ..cache import get_json, get_or_set, incr_with_ttl, set_json
from ..config import get_settings
from ..repositories import notes as notes_repo

NOTE_CACHE_TTL_SECONDS = 300

# The client sends its own position, so it can lie. These raise the cost of lying: an account
# gets 20 unlock attempts an hour and can't hop between far-apart landmarks faster than a bike.
# Both are skipped in demo mode, where teleporting with a fake position is the point and every
# phone shares the placeholder account.
UNLOCK_RATE_LIMIT = 20
UNLOCK_RATE_WINDOW_SECONDS = 3600
MAX_TRAVEL_SPEED_MPS = 10
LAST_UNLOCK_TTL_SECONDS = 3600


class NoteNotFound(Exception):
    pass


class TooFar(Exception):
    pass


class RateLimited(Exception):
    pass


class ImpossibleTravel(Exception):
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


async def _check_travel(
    session: AsyncSession, last: dict | None, landmark_id: str, now: int, radius_m: int
) -> None:
    if last is None or last["landmark_id"] == landmark_id:
        return
    meters = await notes_repo.landmark_distance_m(session, last["landmark_id"], landmark_id)
    # Each unlock may have been anywhere within the radius of its landmark.
    must_travel = max(0.0, meters - 2 * radius_m)
    if must_travel > MAX_TRAVEL_SPEED_MPS * max(0, now - last["at"]):
        raise ImpossibleTravel


async def unlock_note(
    session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID, lat: float, lng: float
) -> dict:
    """Return body, words and a signed audio URL once the server confirms the position.

    Outside demo mode, also rate-limits the account and refuses impossible travel. Only the last
    unlocked landmark and its time are kept (1 h); the position itself is never stored.
    """
    settings = get_settings()
    enforce = not settings.demo_mode
    now = int(time.time())

    # Counted before anything else, so failed attempts (probing for notes) count too.
    if enforce:
        attempts = await incr_with_ttl(f"unlock:count:{account_id}", UNLOCK_RATE_WINDOW_SECONDS)
        if attempts > UNLOCK_RATE_LIMIT:
            raise RateLimited

    note = await get_or_set(
        f"note:{note_id}", NOTE_CACHE_TTL_SECONDS, lambda: _load_note(session, note_id)
    )
    if note is None or note["status"] != "live":
        raise NoteNotFound

    near = await notes_repo.within_radius(
        session, note["landmark_id"], lat, lng, settings.unlock_radius_m
    )
    if not near:
        raise TooFar

    if enforce:
        last_key = f"unlock:last:{account_id}"
        await _check_travel(
            session, await get_json(last_key), note["landmark_id"], now, settings.unlock_radius_m
        )
        last = {"landmark_id": note["landmark_id"], "at": now}
        await set_json(last_key, last, LAST_UNLOCK_TTL_SECONDS)

    return {
        "body": note["body"] or "",
        "words": note["words"],
        "audio_url": storage.signed_url(note["audio_key"]) if note["audio_key"] else None,
    }

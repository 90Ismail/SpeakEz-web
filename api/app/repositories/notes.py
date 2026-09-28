import uuid
from collections.abc import Sequence
from datetime import datetime

from geoalchemy2 import Geography, Geometry
from sqlalchemy import Row, cast, exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ..models import Landmark, ModerationLog, Note, Prompt

Bbox = tuple[float, float, float, float]


async def note_summary(session: AsyncSession, note_id: uuid.UUID) -> Row | None:
    stmt = select(
        Note.status, Note.visibility, Note.landmark_id, Note.body, Note.words, Note.audio_key
    ).where(Note.id == note_id)
    return (await session.execute(stmt)).first()


async def landmark_exists(session: AsyncSession, landmark_id: str) -> bool:
    return bool(await session.scalar(select(exists().where(Landmark.id == landmark_id))))


async def nearest_landmark(session: AsyncSession, lat: float, lng: float) -> Row | None:
    """The landmark closest to (lat, lng). Landmark coordinates only, never stored."""
    point = cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography)
    stmt = (
        select(
            Landmark.id,
            Landmark.name,
            func.ST_Y(cast(Landmark.geom, Geometry)).label("lat"),
            func.ST_X(cast(Landmark.geom, Geometry)).label("lng"),
            func.ST_Distance(Landmark.geom, point).label("distance_m"),
        )
        .order_by("distance_m")
        .limit(1)
    )
    return (await session.execute(stmt)).first()


async def create_note(
    session: AsyncSession,
    *,
    note_id: uuid.UUID,
    author_id: uuid.UUID,
    landmark_id: str | None,
    visibility: str,
    prompt_id: int | None,
    duration_sec: int,
    audio_key: str,
    parent_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Insert a new note in "processing". The caller commits."""
    session.add(
        Note(
            id=note_id,
            author_id=author_id,
            landmark_id=landmark_id,
            visibility=visibility,
            prompt_id=prompt_id,
            duration_sec=duration_sec,
            audio_key=audio_key,
            status="processing",
            parent_id=parent_id,
        )
    )
    await session.flush()
    return note_id


async def owned_status(session: AsyncSession, note_id: uuid.UUID) -> Row | None:
    """(author_id, status) for a note, so submit can check ownership before enqueuing."""
    stmt = select(Note.author_id, Note.status).where(Note.id == note_id)
    return (await session.execute(stmt)).first()


async def parent_landmark(session: AsyncSession, parent_id: uuid.UUID) -> Row | None:
    """(landmark_id, visibility, status) for a note a reply is answering."""
    stmt = select(Note.landmark_id, Note.visibility, Note.status).where(Note.id == parent_id)
    return (await session.execute(stmt)).first()


async def draft_view(session: AsyncSession, note_id: uuid.UUID) -> Row | None:
    """(author_id, status, title, body, words, visibility) for the author's review screen."""
    stmt = select(
        Note.author_id, Note.status, Note.title, Note.body, Note.words, Note.visibility
    ).where(Note.id == note_id)
    return (await session.execute(stmt)).first()


async def save_transcript(
    session: AsyncSession, note_id: uuid.UUID, title: str, body: str, words: list[dict]
) -> None:
    """Write the worker's transcript, title and word timings. The caller commits."""
    await session.execute(
        update(Note).where(Note.id == note_id).values(title=title, body=body, words=words)
    )


async def within_radius(
    session: AsyncSession, landmark_id: str, lat: float, lng: float, radius_m: int
) -> bool:
    point = cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography)
    stmt = (
        select(func.ST_DWithin(Landmark.geom, point, radius_m))
        .where(Landmark.id == landmark_id)
    )
    return bool(await session.scalar(stmt))


async def live_notes_in_bbox(
    session: AsyncSession, bbox: Bbox
) -> Sequence[tuple[Note, Landmark, float, float, int]]:
    """Live public original posts whose landmark falls inside `bbox` (w, s, e, n),
    flattened to (note, landmark, lat, lng, reply_count).

    Journal entries and replies never appear here, whatever their status.
    """
    west, south, east, north = bbox
    replies = aliased(Note)
    reply_count = (
        select(func.count())
        .select_from(replies)
        .where(replies.parent_id == Note.id)
        .where(replies.status == "live")
        .correlate(Note)
        .scalar_subquery()
    )
    envelope = func.ST_MakeEnvelope(
        west, south, east, north, 4326, type_=Geometry(geometry_type="POLYGON", srid=4326)
    )
    stmt = (
        select(
            Note,
            Landmark,
            func.ST_Y(cast(Landmark.geom, Geometry)).label("lat"),
            func.ST_X(cast(Landmark.geom, Geometry)).label("lng"),
            reply_count.label("reply_count"),
        )
        .join(Landmark, Note.landmark_id == Landmark.id)
        .where(Note.status == "live")
        .where(Note.visibility == "public")
        .where(Note.parent_id.is_(None))
        .where(func.ST_Intersects(Landmark.geom, envelope.cast(Geography)))
        .order_by(Note.created_at.desc())
    )
    result = await session.execute(stmt)
    return result.all()


async def live_replies(session: AsyncSession, parent_id: uuid.UUID) -> Sequence[Note]:
    """The thread under a note: live public replies, oldest first, so the original post stays on top."""
    stmt = (
        select(Note)
        .where(Note.parent_id == parent_id)
        .where(Note.status == "live")
        .where(Note.visibility == "public")
        .order_by(Note.created_at.asc())
    )
    return (await session.scalars(stmt)).all()


async def all_prompts(session: AsyncSession) -> Sequence[Prompt]:
    return (await session.scalars(select(Prompt).order_by(Prompt.id))).all()


async def lock_for_publish(session: AsyncSession, note_id: uuid.UUID) -> Row | None:
    """(author_id, status) for a note, row-locked until the transaction ends so two publish
    calls can't race past the status check."""
    stmt = select(Note.author_id, Note.status).where(Note.id == note_id).with_for_update()
    return (await session.execute(stmt)).first()


async def schedule_publish(
    session: AsyncSession, note_id: uuid.UUID, publish_at: datetime, title: str | None
) -> None:
    """Set publish_at (and the edited title, if any). Only touches drafts; the note stays
    "draft" until the scheduled job flips it to "live"."""
    values: dict = {"publish_at": publish_at}
    if title is not None:
        values["title"] = title
    await session.execute(
        update(Note).where(Note.id == note_id, Note.status == "draft").values(**values)
    )


async def set_draft_status(session: AsyncSession, note_id: uuid.UUID, status: str) -> None:
    """Move a draft to another status (e.g. "held" after a title check). Only touches drafts."""
    await session.execute(
        update(Note).where(Note.id == note_id, Note.status == "draft").values(status=status)
    )


async def finish_processing(session: AsyncSession, note_id: uuid.UUID, status: str) -> bool:
    """Move a "processing" note to its safety verdict's status. False if it wasn't processing."""
    result = await session.execute(
        update(Note).where(Note.id == note_id, Note.status == "processing").values(status=status)
    )
    return result.rowcount > 0


async def landmark_distance_m(session: AsyncSession, a: str, b: str) -> float:
    """Meters between two landmarks. Landmark coordinates only, never a user's position."""
    first, second = Landmark.__table__.alias(), Landmark.__table__.alias()
    stmt = (
        select(func.ST_Distance(first.c.geom, second.c.geom))
        .where(first.c.id == a, second.c.id == b)
    )
    return float((await session.execute(stmt)).scalar_one())


async def release_due(
    session: AsyncSession, now: datetime, transcript_layer: str
) -> list[uuid.UUID]:
    """Flip due drafts to "live" and return their ids. A note only goes live if it is still a
    draft, its publish_at has passed, and its transcript has a clean ("draft") safety verdict."""
    passed_safety = exists().where(
        ModerationLog.note_id == Note.id,
        ModerationLog.layer == transcript_layer,
        ModerationLog.decision == "draft",
    )
    stmt = (
        update(Note)
        .where(Note.status == "draft", Note.publish_at <= now, passed_safety)
        .values(status="live")
        .returning(Note.id)
    )
    return list((await session.execute(stmt)).scalars())

import uuid
from collections.abc import Sequence

from geoalchemy2 import Geography, Geometry
from sqlalchemy import Row, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ..models import Landmark, Note, Prompt

Bbox = tuple[float, float, float, float]


async def note_summary(session: AsyncSession, note_id: uuid.UUID) -> Row | None:
    stmt = select(
        Note.status, Note.visibility, Note.landmark_id, Note.body, Note.words, Note.audio_key
    ).where(Note.id == note_id)
    return (await session.execute(stmt)).first()


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

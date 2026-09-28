import uuid
from collections.abc import Sequence
from datetime import datetime

from geoalchemy2 import Geography, Geometry
from sqlalchemy import Row, cast, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Landmark, Note

Bbox = tuple[float, float, float, float]


async def note_summary(session: AsyncSession, note_id: uuid.UUID) -> Row | None:
    stmt = select(Note.status, Note.landmark_id, Note.body, Note.words, Note.audio_key).where(
        Note.id == note_id
    )
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
) -> Sequence[tuple[Note, Landmark, float, float]]:
    """Live notes whose landmark falls inside `bbox` (w, s, e, n), flattened to (note, landmark, lat, lng)."""
    west, south, east, north = bbox
    envelope = func.ST_MakeEnvelope(
        west, south, east, north, 4326, type_=Geometry(geometry_type="POLYGON", srid=4326)
    )
    stmt = (
        select(
            Note,
            Landmark,
            func.ST_Y(cast(Landmark.geom, Geometry)).label("lat"),
            func.ST_X(cast(Landmark.geom, Geometry)).label("lng"),
        )
        .join(Landmark, Note.landmark_id == Landmark.id)
        .where(Note.status == "live")
        .where(func.ST_Intersects(Landmark.geom, envelope.cast(Geography)))
        .order_by(Note.created_at.desc())
    )
    result = await session.execute(stmt)
    return result.all()


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

from collections.abc import Sequence

from geoalchemy2 import Geography, Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Landmark, Note

Bbox = tuple[float, float, float, float]


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

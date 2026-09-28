from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from ..cache import get_or_set
from ..config import get_settings
from ..repositories import notes as notes_repo
from ..schemas import LandmarkOut, MapNoteOut

MAP_CACHE_TTL_SECONDS = 30
MAP_CACHE_PREFIX = "map:"
# /map cache keys snap to a ~200 m grid so neighbouring viewports share an entry.
BBOX_GRID_DEGREES = 0.002

Bbox = tuple[float, float, float, float]


def parse_bbox(raw: str) -> Bbox:
    """Parse "w,s,e,n" into (west, south, east, north). Raises ValueError with a client-safe message."""
    parts = raw.split(",")
    if len(parts) != 4:
        raise ValueError("bbox must be w,s,e,n")
    try:
        west, south, east, north = (float(part) for part in parts)
    except ValueError as exc:
        raise ValueError("bbox coordinates must be numbers") from exc
    if not (-180 <= west <= 180 and -180 <= east <= 180 and -90 <= south <= 90 and -90 <= north <= 90):
        raise ValueError("bbox coordinates out of range")
    if west >= east or south >= north:
        raise ValueError("bbox must satisfy w<e and s<n")
    return (west, south, east, north)


def _snap(value: float) -> float:
    return round(round(value / BBOX_GRID_DEGREES) * BBOX_GRID_DEGREES, 3) + 0.0


def map_cache_key(bbox: Bbox) -> str:
    west, south, east, north = bbox
    return f"{MAP_CACHE_PREFIX}{_snap(west):.3f}:{_snap(south):.3f}:{_snap(east):.3f}:{_snap(north):.3f}"


def _part_of_day(hour: int) -> str:
    if hour < 5:
        return "tonight"
    if hour < 12:
        return "this morning"
    if hour < 17:
        return "this afternoon"
    if hour < 22:
        return "this evening"
    return "tonight"


def day_label(created_at: datetime, now: datetime | None = None) -> str:
    """Day-level label in campus time ("this evening", "last night"), never minutes."""
    tz = ZoneInfo(get_settings().display_timezone)
    now = now or datetime.now(timezone.utc)
    local = created_at.astimezone(tz)
    days_ago = (now.astimezone(tz).date() - local.date()).days
    hour = local.hour
    if days_ago <= 0:
        return _part_of_day(hour)
    if days_ago == 1:
        return "last night" if (hour >= 22 or hour < 5) else "yesterday"
    if days_ago < 8:
        return local.strftime("%A").lower()
    return "earlier this month"


async def map_notes(session: AsyncSession, bbox: Bbox) -> list[MapNoteOut]:
    """Live notes in view, cached in Redis per rounded bbox."""

    async def load() -> list[dict]:
        rows = await notes_repo.live_notes_in_bbox(session, bbox)
        now = datetime.now(timezone.utc)
        return [
            MapNoteOut(
                id=note.id,
                title=note.title,
                landmark=LandmarkOut(id=landmark.id, name=landmark.name, lat=lat, lng=lng),
                duration_sec=note.duration_sec,
                day_label=day_label(note.created_at, now),
            ).model_dump(mode="json")
            for note, landmark, lat, lng in rows
        ]

    cached = await get_or_set(map_cache_key(bbox), MAP_CACHE_TTL_SECONDS, load)
    return [MapNoteOut.model_validate(item) for item in cached]

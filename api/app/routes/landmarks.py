from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..repositories import notes as notes_repo
from ..schemas import LandmarkOut

router = APIRouter(tags=["landmarks"])


@router.get("/landmarks/nearest", response_model=LandmarkOut)
async def nearest_landmark(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    session: AsyncSession = Depends(get_session),
) -> LandmarkOut:
    """The closest campus landmark to a position, so the record flow can offer "this spot".

    The position is used to answer this one query and is never logged or stored (hard rule 1).
    """
    row = await notes_repo.nearest_landmark(session, lat, lng)
    if row is None:
        raise HTTPException(status_code=404, detail="No landmarks seeded")
    return LandmarkOut(id=row.id, name=row.name, lat=row.lat, lng=row.lng)

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..schemas import MapResponse
from ..services import notes as notes_service

router = APIRouter(tags=["notes"])


@router.get("/map", response_model=MapResponse)
async def map_view(
    bbox: str = Query(..., description="Viewport bounds as w,s,e,n (lng,lat,lng,lat)"),
    session: AsyncSession = Depends(get_session),
) -> MapResponse:
    try:
        parsed = notes_service.parse_bbox(bbox)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MapResponse(notes=await notes_service.map_notes(session, parsed))

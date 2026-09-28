import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..schemas import MapResponse, PromptOut, UnlockRequest, UnlockResponse
from ..services import notes as notes_service
from ..services import prompts as prompts_service
from ..services import unlock as unlock_service

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


@router.post("/notes/{note_id}/unlock", response_model=UnlockResponse)
async def unlock(
    note_id: uuid.UUID,
    position: UnlockRequest,
    session: AsyncSession = Depends(get_session),
) -> UnlockResponse:
    try:
        result = await unlock_service.unlock_note(session, note_id, position.lat, position.lng)
    except unlock_service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail="Note not found") from exc
    except unlock_service.TooFar as exc:
        raise HTTPException(
            status_code=403, detail="Not close enough to unlock this note"
        ) from exc
    return UnlockResponse(**result)


@router.get("/prompts/today", response_model=PromptOut)
async def prompt_today(session: AsyncSession = Depends(get_session)) -> PromptOut:
    """Today's voice journal prompt. Answers are journal-only and never go on the map."""
    try:
        return await prompts_service.today_prompt(session)
    except prompts_service.NoPrompts as exc:
        raise HTTPException(status_code=404, detail="No prompts yet") from exc

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import CurrentUser, current_user
from ..db import get_session
from ..schemas import (
    MapResponse,
    PublishRequest,
    PublishResponse,
    UnlockRequest,
    UnlockResponse,
)
from ..services import notes as notes_service
from ..services import publish as publish_service
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


@router.post("/notes/{note_id}/publish", response_model=PublishResponse)
async def publish(
    note_id: uuid.UUID,
    body: PublishRequest,
    session: AsyncSession = Depends(get_session),
    user: CurrentUser = Depends(current_user),
) -> PublishResponse:
    try:
        result = await publish_service.publish_note(session, note_id, user.id, body.title)
    except publish_service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail="Note not found") from exc
    except publish_service.NotPublishable as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "not_draft",
                "status": exc.status,
                "message": f"Only a draft can be published; this note is {exc.status}.",
            },
        ) from exc
    except publish_service.TitleRefused as exc:
        # "title_held" means the app shows the care screen, never a bare "rejected" (hard rule 4).
        raise HTTPException(
            status_code=422,
            detail={
                "code": f"title_{exc.decision}",
                "decision": exc.decision,
                "message": "This title can't be published.",
            },
        ) from exc
    return PublishResponse(**result)

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import CurrentUser, current_user
from ..db import get_session
from ..schemas import (
    DraftOut,
    MapResponse,
    NoteCreated,
    PromptOut,
    PublishRequest,
    PublishResponse,
    SubmitResponse,
    UnlockRequest,
    UnlockResponse,
)
from ..services import notes as notes_service
from ..services import prompts as prompts_service
from ..services import publish as publish_service
from ..services import records as records_service
from ..services import unlock as unlock_service

router = APIRouter(tags=["notes"], dependencies=[Depends(current_user)])


@router.post("/notes", response_model=NoteCreated, status_code=201)
async def create_note(
    audio: UploadFile = File(..., description="The recording (m4a/AAC from the phone)."),
    duration_sec: int = Form(..., ge=1, le=records_service.MAX_DURATION_SEC),
    landmark_id: str | None = Form(None),
    visibility: str = Form("public"),
    prompt_id: int | None = Form(None),
    session: AsyncSession = Depends(get_session),
    user: CurrentUser = Depends(current_user),
) -> NoteCreated:
    """Upload the audio and create a "processing" note. Submit it next to start transcription."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty audio upload")
    try:
        note_id = await records_service.create_note(
            session,
            user.id,
            landmark_id=landmark_id,
            duration_sec=duration_sec,
            visibility=visibility,
            prompt_id=prompt_id,
            filename=audio.filename,
            content_type=audio.content_type,
            data=data,
        )
    except records_service.LandmarkNotFound as exc:
        raise HTTPException(status_code=422, detail="Unknown landmark for this note") from exc
    except records_service.InvalidVisibility as exc:
        raise HTTPException(status_code=422, detail="visibility must be public or journal") from exc
    return NoteCreated(id=note_id, status="processing")


@router.post("/notes/{parent_id}/replies", response_model=NoteCreated, status_code=201)
async def create_reply(
    parent_id: uuid.UUID,
    audio: UploadFile = File(..., description="The voice reply (m4a/AAC from the phone)."),
    duration_sec: int = Form(..., ge=1, le=records_service.MAX_DURATION_SEC),
    session: AsyncSession = Depends(get_session),
    user: CurrentUser = Depends(current_user),
) -> NoteCreated:
    """Upload a voice reply. It is always public and takes the original post's place."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty audio upload")
    try:
        note_id = await records_service.create_note(
            session,
            user.id,
            landmark_id=None,
            duration_sec=duration_sec,
            visibility="public",
            prompt_id=None,
            filename=audio.filename,
            content_type=audio.content_type,
            data=data,
            parent_id=parent_id,
        )
    except records_service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail="Original post not found") from exc
    return NoteCreated(id=note_id, status="processing")


@router.post("/notes/{note_id}/submit", response_model=SubmitResponse, status_code=202)
async def submit_note(
    note_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: CurrentUser = Depends(current_user),
) -> SubmitResponse:
    """Queue the uploaded note for the worker: transcribe, title and safety-check it."""
    try:
        status_value = await records_service.submit_note(session, note_id, user.id)
    except records_service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail="Note not found") from exc
    except records_service.NoteNotProcessing as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "not_processing", "status": exc.status},
        ) from exc
    return SubmitResponse(id=note_id, status=status_value)


@router.get("/notes/{note_id}/draft", response_model=DraftOut)
async def get_draft(
    note_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: CurrentUser = Depends(current_user),
) -> DraftOut:
    """The author's own view of a processing or finished note. Held/blocked trips the care screen."""
    try:
        result = await records_service.get_draft(session, note_id, user.id)
    except records_service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail="Note not found") from exc
    return DraftOut(**result)


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
    user: CurrentUser = Depends(current_user),
) -> UnlockResponse:
    try:
        result = await unlock_service.unlock_note(
            session, note_id, user.id, position.lat, position.lng
        )
    except unlock_service.RateLimited as exc:
        raise HTTPException(status_code=429, detail="Too many unlocks; try again later") from exc
    except unlock_service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail="Note not found") from exc
    except unlock_service.TooFar as exc:
        raise HTTPException(
            status_code=403, detail="Not close enough to unlock this note"
        ) from exc
    except unlock_service.ImpossibleTravel as exc:
        raise HTTPException(
            status_code=403, detail="Too far from your last unlock to be here yet"
        ) from exc
    return UnlockResponse(**result)


@router.get("/prompts/today", response_model=PromptOut)
async def prompt_today(session: AsyncSession = Depends(get_session)) -> PromptOut:
    """Today's voice journal prompt. Answers are journal-only and never go on the map."""
    try:
        return await prompts_service.today_prompt(session)
    except prompts_service.NoPrompts as exc:
        raise HTTPException(status_code=404, detail="No prompts yet") from exc


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

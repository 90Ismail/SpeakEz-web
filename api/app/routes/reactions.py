import uuid
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from ..auth.deps import CurrentUser, current_user
from ..db import get_session
from ..services import reactions

router = APIRouter(tags=["reactions"])


class ReactionBody(BaseModel):
    type: Literal["heard_you", "same", "strength", "helped"] | None


@router.get("/notes/{note_id}/reactions", response_model=ReactionBody)
async def get(note_id: uuid.UUID, session: AsyncSession = Depends(get_session),
              user: CurrentUser = Depends(current_user)):
    return await reactions.get(session, note_id, user.id)


@router.post("/notes/{note_id}/reactions", response_model=ReactionBody)
async def save(note_id: uuid.UUID, body: ReactionBody, session: AsyncSession = Depends(get_session),
               user: CurrentUser = Depends(current_user)):
    return await reactions.save(session, note_id, user.id, body.type)

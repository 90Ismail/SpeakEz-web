import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..cache import get_json
from ..repositories import reactions as repo


async def check(session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID):
    if not await repo.public_live(session, note_id):
        raise HTTPException(404, "Note not found")
    if not await get_json(f"unlocked:{account_id}:{note_id}"):
        raise HTTPException(403, "Open this story nearby before reacting")


async def get(session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID):
    await check(session, note_id, account_id)
    return {"type": await repo.get(session, note_id, account_id)}


async def save(session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID, kind: str | None):
    await check(session, note_id, account_id)
    await repo.save(session, note_id, account_id, kind)
    return {"type": kind}

import uuid
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Note, Reaction


async def public_live(session: AsyncSession, note_id: uuid.UUID) -> bool:
    return (await session.execute(select(Note.id).where(
        Note.id == note_id, Note.status == "live", Note.visibility == "public"
    ))).scalar_one_or_none() is not None


async def get(session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID) -> str | None:
    return (await session.execute(select(Reaction.type).where(
        Reaction.note_id == note_id, Reaction.account_id == account_id
    ))).scalar_one_or_none()


async def save(session: AsyncSession, note_id: uuid.UUID, account_id: uuid.UUID, kind: str | None):
    if kind is None:
        await session.execute(delete(Reaction).where(
            Reaction.note_id == note_id, Reaction.account_id == account_id))
    else:
        await session.execute(insert(Reaction).values(note_id=note_id, account_id=account_id, type=kind)
                              .on_conflict_do_update(index_elements=[Reaction.note_id, Reaction.account_id],
                                                     set_={"type": kind}))
    await session.commit()

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ModerationLog


async def insert_log(
    session: AsyncSession, note_id: uuid.UUID, layer: str, label: str | None, decision: str
) -> None:
    """Add one moderation_log row. Flushes but doesn't commit: the caller owns the transaction,
    so the verdict and the note's new status are saved together."""
    session.add(ModerationLog(note_id=note_id, layer=layer, label=label, decision=decision))
    await session.flush()

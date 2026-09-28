import uuid
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Account


async def get_or_create(session: AsyncSession, email_hmac: bytes) -> Account:
    await session.execute(insert(Account).values(id=uuid.uuid4(), email_hmac=email_hmac)
                          .on_conflict_do_nothing(index_elements=[Account.email_hmac]))
    account = (await session.execute(select(Account).where(Account.email_hmac == email_hmac))).scalar_one()
    await session.commit()
    return account


async def active(session: AsyncSession, account_id: uuid.UUID) -> bool:
    return (await session.execute(select(Account.id).where(
        Account.id == account_id, Account.status == "active"))).scalar_one_or_none() is not None

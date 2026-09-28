from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..auth import otp, tokens
from ..repositories import accounts


async def verify(session: AsyncSession, email: str, code: str) -> dict:
    await otp.verify(email, code)
    account = await accounts.get_or_create(session, otp.email_hash(email))
    if account.status != "active":
        raise HTTPException(403, "This account is unavailable")
    return await tokens.issue(account.id)


async def refresh(session: AsyncSession, token: str) -> dict:
    account_id = await tokens.consume_refresh(token)
    if not await accounts.active(session, account_id):
        raise HTTPException(401, "This account is unavailable")
    return await tokens.issue(account_id)

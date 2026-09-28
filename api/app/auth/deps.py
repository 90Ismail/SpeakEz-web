import uuid
from dataclasses import dataclass
from typing import Annotated
from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..config import get_settings
from ..db import get_session
from ..repositories import accounts
from .tokens import decode_access


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID


PLACEHOLDER_ACCOUNT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")


async def current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> CurrentUser:
    if authorization is None and get_settings().demo_mode:
        return CurrentUser(id=PLACEHOLDER_ACCOUNT_ID)
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to continue")
    account_id = decode_access(authorization[7:])
    if not await accounts.active(session, account_id):
        raise HTTPException(401, "This account is unavailable")
    return CurrentUser(id=account_id)

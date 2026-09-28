import uuid
from dataclasses import dataclass

from fastapi import HTTPException

from ..config import get_settings


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID


# The seeded "early tester" account from seed.py, so notes created before real sign-in exists
# point at an account row that is really there.
PLACEHOLDER_ACCOUNT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")


async def current_user() -> CurrentUser:
    # TODO: replace with real OTP/JWT auth (umn.edu sign-in). Keep the name and the CurrentUser
    # return type so routes using Depends(current_user) don't change. Until then every request
    # acts as one placeholder account, so it only works in demo mode.
    if not get_settings().demo_mode:
        raise HTTPException(status_code=401, detail="Sign-in isn't available yet")
    return CurrentUser(id=PLACEHOLDER_ACCOUNT_ID)

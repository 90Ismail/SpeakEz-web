import hashlib
import secrets
import time
import uuid
import jwt
from fastapi import HTTPException
from ..cache import get_redis
from ..config import get_settings

ACCESS_TTL = 900
REFRESH_TTL = 30 * 86400


def refresh_key(token: str) -> str:
    return "auth:refresh:" + hashlib.sha256(token.encode()).hexdigest()


async def issue(account_id: uuid.UUID) -> dict:
    now = int(time.time())
    access = jwt.encode({"sub": str(account_id), "iat": now, "exp": now + ACCESS_TTL,
                         "iss": "speakez", "aud": "speakez-app", "type": "access", "jti": secrets.token_hex(16)},
                        get_settings().jwt_secret, algorithm="HS256")
    refresh = secrets.token_urlsafe(48)
    await get_redis().set(refresh_key(refresh), str(account_id), ex=REFRESH_TTL)
    return {"access": access, "refresh": refresh}


def decode_access(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"],
                             issuer="speakez", audience="speakez-app",
                             options={"require": ["sub", "iat", "exp", "type"]})
        if payload["type"] != "access":
            raise ValueError()
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, "Your session expired. Please sign in again.") from None


async def consume_refresh(token: str) -> uuid.UUID:
    value = await get_redis().getdel(refresh_key(token))
    if value is None:
        raise HTTPException(401, "Your session expired. Please sign in again.")
    return uuid.UUID(value)


async def revoke(token: str) -> None:
    await get_redis().delete(refresh_key(token))

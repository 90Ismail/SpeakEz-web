import hashlib
import hmac
import re
import secrets
from fastapi import HTTPException
from ..cache import get_redis, incr_with_ttl
from ..config import get_settings
from .email import send_email

TTL = 600
# Verification and consumption are atomic: five guesses, and exactly one winner.
VERIFY = """
local value = redis.call('HGET', KEYS[1], 'code')
if not value then return 0 end
local tries = redis.call('HINCRBY', KEYS[1], 'tries', 1)
if tries > 5 then redis.call('DEL', KEYS[1]); return 0 end
if value == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end
if tries == 5 then redis.call('DEL', KEYS[1]) end
return 0
"""


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._+-]{0,63}@umn\.edu", email):
        raise ValueError("Use your UMN address (@umn.edu)")
    return email


def digest(value: str) -> str:
    return hmac.new(get_settings().email_pepper.encode(), value.encode(), hashlib.sha256).hexdigest()


def email_hash(email: str) -> bytes:
    return bytes.fromhex(digest(email))


async def start(email: str, ip: str) -> None:
    identity = digest(email)
    # Count every request, including provider failures; no raw email or IP in Redis keys.
    for key in (f"auth:email:{identity}", f"auth:ip:{digest('ip:' + ip)}"):
        if await incr_with_ttl(key, 3600) > 5:
            raise HTTPException(429, "Too many codes requested. Try again in an hour.")
    client = get_redis()
    key = f"auth:otp:{identity}"
    # Prevent parallel sends and accidental rapid resends from invalidating a fresh code.
    cooldown = f"auth:cooldown:{identity}"
    if not await client.set(cooldown, "1", nx=True, ex=60):
        raise HTTPException(429, "Wait a minute before requesting another code.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    async with client.pipeline(transaction=True) as pipe:
        pipe.hset(key, mapping={"code": digest(identity + ':' + code), "tries": 0})
        pipe.expire(key, TTL)
        await pipe.execute()
    try:
        await send_email(email, code)
    except Exception:
        await client.delete(key, cooldown)
        raise


async def verify(email: str, code: str) -> None:
    identity = digest(email)
    valid = await get_redis().eval(VERIFY, 1, f"auth:otp:{identity}", digest(identity + ':' + code))
    if valid != 1:
        raise HTTPException(401, "Code is incorrect or expired. Request a new code if needed.")

import json
from collections.abc import Awaitable, Callable
from typing import TypeVar

import redis.asyncio as redis

from .config import get_settings

T = TypeVar("T")

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def get_or_set(key: str, ttl: int, fn: Callable[[], Awaitable[T]]) -> T:
    """Return the cached JSON value for `key`, or compute and cache it for `ttl` seconds."""
    raw = await get_redis().get(key)
    if raw is not None:
        return json.loads(raw)
    value = await fn()
    await get_redis().set(key, json.dumps(value), ex=ttl)
    return value


async def invalidate(prefix: str) -> int:
    """Delete every key under `prefix`. Returns how many keys were removed."""
    client = get_redis()
    removed = 0
    async for key in client.scan_iter(match=f"{prefix}*"):
        removed += await client.delete(key)
    return removed


async def incr_with_ttl(key: str, ttl: int) -> int:
    """Increment a counter that expires `ttl` seconds after its first hit. Returns the new count."""
    client = get_redis()
    count = await client.incr(key)
    if count == 1:
        await client.expire(key, ttl)
    return count


async def get_json(key: str):
    raw = await get_redis().get(key)
    return None if raw is None else json.loads(raw)


async def set_json(key: str, value, ttl: int) -> None:
    await get_redis().set(key, json.dumps(value), ex=ttl)

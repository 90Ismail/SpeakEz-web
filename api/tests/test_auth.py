import asyncio
import time
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import fakeredis.aioredis
import httpx
import jwt
import pytest
from fastapi import FastAPI, HTTPException

from app import cache
from app.auth import deps, otp, tokens
from app.config import get_settings
from app.db import get_session
from app.repositories import accounts
from app.routes import auth, notes
from app.services import auth as auth_service


@pytest.fixture
async def redis(monkeypatch):
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(cache, "_client", client)
    yield client
    await client.aclose()


@pytest.fixture
async def client(monkeypatch, redis):
    app = FastAPI()
    app.include_router(auth.router)
    app.include_router(notes.router)
    async def session():
        yield None
    app.dependency_overrides[get_session] = session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.parametrize("email", ["x@gmail.com", "x@umn.edu.evil.com", "x@sub.umn.edu", "a b@umn.edu", "a@umn.edu\nBcc:x@y.com"])
async def test_domain_rejected_before_delivery(client, monkeypatch, email):
    send = AsyncMock()
    monkeypatch.setattr(otp, "send_email", send)
    response = await client.post("/auth/start", json={"email": email})
    assert response.status_code == 422
    send.assert_not_awaited()


async def start(monkeypatch):
    send = AsyncMock()
    monkeypatch.setattr(otp, "send_email", send)
    await otp.start("goldy@umn.edu", "127.0.0.1")
    return send.call_args.args[1]


async def test_normalized_email_single_use_and_no_raw_email(redis, client, monkeypatch):
    send = AsyncMock()
    monkeypatch.setattr(otp, "send_email", send)
    account = SimpleNamespace(id=uuid.uuid4(), status="active")
    create = AsyncMock(return_value=account)
    monkeypatch.setattr(accounts, "get_or_create", create)
    assert (await client.post("/auth/start", json={"email": " Goldy@UMN.EDU "})).status_code == 204
    code = send.call_args.args[1]
    assert send.call_args.args[0] == "goldy@umn.edu"
    key = f"auth:otp:{otp.digest('goldy@umn.edu')}"
    assert 0 < await redis.ttl(key) <= 600
    assert code not in str(await redis.hgetall(key))
    assert "goldy" not in str(await redis.keys("*"))
    body = {"email": "goldy@umn.edu", "code": code, "over18": True}
    response = await client.post("/auth/verify", json=body)
    assert response.status_code == 200
    assert set(response.json()) == {"access", "refresh"}
    assert tokens.decode_access(response.json()["access"]) == account.id
    assert create.call_args.args[1] == otp.email_hash("goldy@umn.edu")
    assert (await client.post("/auth/verify", json=body)).status_code == 401


async def test_five_guesses_exhaust_code(redis, monkeypatch):
    code = await start(monkeypatch)
    wrong = "111111" if code != "111111" else "222222"
    for _ in range(5):
        with pytest.raises(HTTPException):
            await otp.verify("goldy@umn.edu", wrong)
    with pytest.raises(HTTPException):
        await otp.verify("goldy@umn.edu", code)


async def test_expired_code(redis, monkeypatch):
    code = await start(monkeypatch)
    await redis.expire(f"auth:otp:{otp.digest('goldy@umn.edu')}", 0)
    with pytest.raises(HTTPException):
        await otp.verify("goldy@umn.edu", code)


async def test_parallel_verify_has_one_winner(redis, monkeypatch):
    code = await start(monkeypatch)
    result = await asyncio.gather(*(otp.verify("goldy@umn.edu", code) for _ in range(2)), return_exceptions=True)
    assert sum(value is None for value in result) == 1


async def test_resend_invalidates_old_and_cooldown(redis, monkeypatch):
    old = await start(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        await otp.start("goldy@umn.edu", "127.0.0.1")
    assert exc.value.status_code == 429
    await redis.delete(f"auth:cooldown:{otp.digest('goldy@umn.edu')}")
    monkeypatch.setattr(otp.secrets, "randbelow", lambda _: (int(old) + 1) % 1000000)
    new = await start(monkeypatch)
    with pytest.raises(HTTPException):
        await otp.verify("goldy@umn.edu", old)
    await otp.verify("goldy@umn.edu", new)


@pytest.mark.parametrize("same_email", [True, False])
async def test_request_limit_per_email_and_ip(redis, monkeypatch, same_email):
    monkeypatch.setattr(otp, "send_email", AsyncMock())
    for i in range(5):
        email = "goldy@umn.edu" if same_email else f"goldy{i}@umn.edu"
        await redis.delete(f"auth:cooldown:{otp.digest(email)}")
        await otp.start(email, str(i) if same_email else "same-ip")
    with pytest.raises(HTTPException) as exc:
        await otp.start("goldy@umn.edu" if same_email else "sixth@umn.edu", "new-ip" if same_email else "same-ip")
    assert exc.value.status_code == 429


async def test_email_failure_does_not_leave_valid_code(redis, monkeypatch):
    monkeypatch.setattr(otp, "send_email", AsyncMock(side_effect=HTTPException(503, "Unavailable")))
    with pytest.raises(HTTPException):
        await otp.start("goldy@umn.edu", "ip")
    assert not await redis.exists(f"auth:otp:{otp.digest('goldy@umn.edu')}")


async def test_over18_required(client):
    for over18 in [False, None]:
        response = await client.post("/auth/verify", json={"email": "goldy@umn.edu", "code": "123456", "over18": over18})
        assert response.status_code == 422


async def test_refresh_rotation_replay_and_logout(redis, monkeypatch):
    account_id = uuid.uuid4()
    monkeypatch.setattr(accounts, "active", AsyncMock(return_value=True))
    first = await tokens.issue(account_id)
    second = await auth_service.refresh(None, first["refresh"])
    with pytest.raises(HTTPException):
        await auth_service.refresh(None, first["refresh"])
    assert tokens.decode_access(second["access"]) == account_id
    await tokens.revoke(second["refresh"])
    with pytest.raises(HTTPException):
        await auth_service.refresh(None, second["refresh"])


async def test_expired_and_wrong_type_tokens_rejected(redis):
    for changes in [{"exp": int(time.time()) - 1}, {"type": "refresh"}, {"aud": "other"}]:
        payload = {"sub": str(uuid.uuid4()), "iat": int(time.time()) - 30,
                   "exp": int(time.time()) + 60, "iss": "speakez", "aud": "speakez-app", "type": "access"}
        payload.update(changes)
        token = jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")
        with pytest.raises(HTTPException):
            tokens.decode_access(token)


async def test_bearer_and_disabled_account(redis, monkeypatch):
    user_id = uuid.uuid4()
    pair = await tokens.issue(user_id)
    monkeypatch.setattr(accounts, "active", AsyncMock(return_value=True))
    assert (await deps.current_user("Bearer " + pair["access"], None)).id == user_id
    monkeypatch.setattr(accounts, "active", AsyncMock(return_value=False))
    with pytest.raises(HTTPException):
        await deps.current_user("Bearer " + pair["access"], None)
    with pytest.raises(HTTPException):
        await auth_service.refresh(None, pair["refresh"])


async def test_demo_does_not_accept_invalid_bearer(monkeypatch):
    monkeypatch.setattr(deps, "get_settings", lambda: SimpleNamespace(demo_mode=True))
    with pytest.raises(HTTPException):
        await deps.current_user("Bearer invalid", None)


async def test_map_requires_login_outside_demo(client):
    response = await client.get("/map", params={"bbox": "-94,44,-93,45"})
    assert response.status_code == 401

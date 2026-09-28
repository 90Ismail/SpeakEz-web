from typing import Literal
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from ..auth import otp, tokens
from ..config import get_settings
from ..db import get_session
from ..services import auth

router = APIRouter(prefix="/auth", tags=["auth"])


class StartRequest(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return otp.normalize_email(value)


class VerifyRequest(StartRequest):
    code: str = Field(pattern=r"^[0-9]{6}$")
    over18: Literal[True]


class RefreshRequest(BaseModel):
    refresh: str = Field(min_length=32, max_length=256)


class Tokens(BaseModel):
    access: str
    refresh: str


@router.get("/config")
async def config():
    return {"demo_mode": get_settings().demo_mode}


@router.post("/start", status_code=204)
async def start(body: StartRequest, request: Request):
    # Trust only ASGI's resolved client, never an arbitrary X-Forwarded-For header.
    await otp.start(body.email, request.client.host if request.client else "unknown")
    return Response(status_code=204)


@router.post("/verify", response_model=Tokens)
async def verify(body: VerifyRequest, session: AsyncSession = Depends(get_session)):
    return await auth.verify(session, body.email, body.code)


@router.post("/refresh", response_model=Tokens)
async def refresh(body: RefreshRequest, session: AsyncSession = Depends(get_session)):
    return await auth.refresh(session, body.refresh)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest):
    await tokens.revoke(body.refresh)
    return Response(status_code=204)

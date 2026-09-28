from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..cache import get_redis
from ..db import get_session
from ..schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health(session: AsyncSession = Depends(get_session)) -> HealthOut:
    try:
        await session.execute(text("select 1"))
        db_ok = True
    except Exception:
        db_ok = False

    try:
        await get_redis().ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    result = HealthOut(status="ok" if db_ok and redis_ok else "unavailable", db=db_ok, redis=redis_ok)
    if result.status != "ok":
        raise HTTPException(status_code=503, detail=result.model_dump())
    return result

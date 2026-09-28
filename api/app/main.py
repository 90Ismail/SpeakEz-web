from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cache import close_redis
from .config import get_settings
from .db import engine
from .queue import close_arq_pool
from .routes import health, landmarks, media, notes


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_arq_pool()
    await engine.dispose()
    await close_redis()


app = FastAPI(title="SpeakEz API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(notes.router)
app.include_router(landmarks.router)
app.include_router(media.router)

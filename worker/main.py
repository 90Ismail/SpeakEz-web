"""arq worker entrypoint.

CPU placeholder for now: the real image (ffmpeg + NeMo Parakeet) lands with the
record flow, and can run on a GPU box pointed at the same Redis and DB.
The pipeline and its interfaces are mapped out in worker/README.md, with the
stubs in asr.py and titles.py.

The api package (`app`) is installed in the image, so jobs call its services
instead of re-implementing them: one safety gate, one set of note rules.
"""

import os

from arq import cron
from arq.connections import RedisSettings

from app.cache import close_redis
from app.db import SessionLocal, engine
from app.services import publish as publish_service


async def process_note(ctx, note_id: str) -> None:
    raise NotImplementedError("process_note is wired up with the record flow")


async def release_due_notes(ctx) -> int:
    """Every minute: flip due drafts that passed the safety gate to live (see app.services.publish)."""
    async with SessionLocal() as session:
        return await publish_service.release_due_notes(session)


async def shutdown(ctx) -> None:
    await engine.dispose()
    await close_redis()


class WorkerSettings:
    functions = [process_note]
    cron_jobs = [cron(release_due_notes, run_at_startup=True)]
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))

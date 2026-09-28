"""arq worker entrypoint — two settings classes, two jobs.

`WorkerSettings` owns `process_note` on the **default queue** (`arq:queue`),
which the API enqueues onto (`api/app/queue.py`). Run it wherever the GPU is:
a GPU box, or Colab. Exactly one transcription worker should be on this queue,
or the fastest to poll wins and a canned demo transcript can beat the GPU.

`CronWorkerSettings` owns only the every-minute `release_due_notes` cron, on its
own queue (`speakez:cron`), so the always-on CPU worker can never steal a
`process_note` job from the GPU. One of these must always be running somewhere:
it is what flips due drafts to live.

The api package (`app`) is installed in the image, so jobs call its services
instead of re-implementing them: one safety gate, one set of note rules.
See worker/README.md and deploy/README.md.
"""

import os

from arq import cron
from arq.connections import RedisSettings

from app.cache import close_redis
from app.db import SessionLocal, engine
from app.services import publish as publish_service

from .pipeline import process_note


async def release_due_notes(ctx) -> int:
    """Every minute: flip due drafts that passed the safety gate to live (see app.services.publish)."""
    async with SessionLocal() as session:
        return await publish_service.release_due_notes(session)


async def shutdown(ctx) -> None:
    await engine.dispose()
    await close_redis()


class WorkerSettings:
    """The transcription worker: owns process_note on the default queue (arq:queue)."""

    functions = [process_note]
    cron_jobs = [cron(release_due_notes, run_at_startup=True)]
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))


class CronWorkerSettings:
    """Cron only, on its own queue, so it never steals process_note from the GPU worker.

    One of these must always run somewhere: it is what flips due drafts to live.
    Run it as `arq worker.main.CronWorkerSettings` (docker-compose.prod.yml does).
    """

    functions = []
    cron_jobs = [cron(release_due_notes, run_at_startup=True)]
    queue_name = "speakez:cron"
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))


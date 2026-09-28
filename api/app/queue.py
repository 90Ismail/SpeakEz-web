"""The API's side of the job queue: enqueue worker jobs by name.

The API never runs the pipeline itself; it drops a job on Redis and whichever
worker is pointed at the same REDIS_URL picks it up. That is what lets the NeMo
worker live on a GPU box (or Colab) behind a tunnel while the API stays on a
small host: the worker only dials outward to Redis and the database.
"""

import uuid

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from .config import get_settings

PROCESS_NOTE_JOB = "process_note"

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(get_settings().redis_url))
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


async def enqueue_process_note(note_id: uuid.UUID) -> None:
    """Queue a note for transcription, titling and the safety gate."""
    pool = await get_arq_pool()
    await pool.enqueue_job(PROCESS_NOTE_JOB, str(note_id))

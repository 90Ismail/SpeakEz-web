"""arq worker entrypoint.

CPU placeholder for now: the real image (ffmpeg + NeMo Parakeet) lands with the
record flow, and can run on a GPU box pointed at the same Redis and DB.
The pipeline and its interfaces are mapped out in worker/README.md, with the
stubs in asr.py and titles.py.
"""

import os

from arq.connections import RedisSettings


async def process_note(ctx, note_id: str) -> None:
    raise NotImplementedError("process_note is wired up with the record flow")


class WorkerSettings:
    functions = [process_note]
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))

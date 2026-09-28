# Built from the repo root (see docker-compose.yml) so the api package is available:
# jobs import app.services.* for the safety gate and note rules instead of copying them.
#
# This is the thin CPU image. It runs the arq queue and the every-minute publish
# cron, and with ASR_ENGINE=demo it can process notes end to end without a GPU.
# Real Parakeet transcription lives in Dockerfile.gpu.
FROM python:3.12-slim

# ffmpeg converts the phone's m4a/AAC to the 16 kHz mono WAV the ASR expects.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /
COPY worker/requirements.txt /worker/requirements.txt
COPY api/pyproject.toml /api/pyproject.toml
COPY api/app /api/app
RUN pip install --no-cache-dir -r /worker/requirements.txt /api

COPY worker /worker

CMD ["arq", "worker.main.WorkerSettings"]

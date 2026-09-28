# Built from the repo root (see docker-compose.yml) so the api package is available:
# jobs import app.services.* for the safety gate and note rules instead of copying them.
FROM python:3.12-slim

WORKDIR /
COPY worker/requirements.txt /worker/requirements.txt
COPY api/pyproject.toml /api/pyproject.toml
COPY api/app /api/app
RUN pip install --no-cache-dir -r /worker/requirements.txt /api

COPY worker /worker

CMD ["arq", "worker.main.WorkerSettings"]

FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir -e ".[dev]"

COPY alembic.ini ./
COPY alembic ./alembic
COPY seed.py ./
# seed.py reads api/seed_audio/ for the demo notes' mp3s and word timings. Without
# this the container seeds every note with words=NULL and audio_key=NULL, and the
# story screen opens to silence with nothing to highlight.
COPY seed_audio ./seed_audio
COPY tests ./tests

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

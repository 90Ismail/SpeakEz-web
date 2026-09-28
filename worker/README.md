# NeMo worker

The worker turns a submitted recording into a transcript, a title and a safety
verdict. It is implemented: `process_note` runs the whole pipeline, the thin CPU
image runs it with `ASR_ENGINE=demo`, and `worker/Dockerfile.gpu` runs the real
`nvidia/parakeet-tdt-0.6b-v2` on a GPU box or Colab. See `deploy/README.md` for
how the GPU worker joins a deployed API stack.

## What `process_note(note_id)` does (worker/pipeline.py)

1. Load the note; only touch it while it is `processing` and has audio.
2. Fetch the audio: from the shared `MEDIA_DIR`, or over HTTPS via
   `storage.signed_url` when the worker has no media volume (GPU box / Colab).
3. `to_wav_16k_mono()` — phones record m4a/AAC; Parakeet wants 16 kHz mono WAV.
4. `transcribe()` — Parakeet with word-level timestamps, or the demo transcript.
5. `title_for()` — first-sentence fallback today (LLM drops in behind the same
   async signature).
6. Group words into paragraphs, then the safety lexicon (`app/services/safety.py`)
   sets `processing -> draft | held | blocked` and writes `moderation_log`.
7. Write `title`, `body`, `words` back to the note in the same transaction as the
   verdict. The publish cron invalidates the map cache when a note goes live.

## ASR engines (`worker/asr.py`)

| `ASR_ENGINE` | Needs | Use |
| --- | --- | --- |
| `parakeet` (default) | GPU + `nemo_toolkit[asr]` | Real transcription, `worker/Dockerfile.gpu` or Colab |
| `demo` | ffmpeg only | Full pipeline on a laptop/CI/no-GPU demo day. Set `DEMO_TRANSCRIPT` to rehearse a held/blocked note |

Demo mode never skips the safety gate — the demo transcript still runs through
the lexicon.

## Running

Two settings classes in `worker/main.py`:

| Settings | Queue | Jobs |
| --- | --- | --- |
| `WorkerSettings` | default (`arq:queue`) | `process_note` (transcription) |
| `CronWorkerSettings` | `speakez:cron` | `release_due_notes` cron only |

Run **one** transcription worker (GPU box, or Colab) and **one** cron worker.
Keeping them on separate queues stops the always-on CPU worker from racing the
GPU for the same job — otherwise a judge's note can get the canned demo
transcript while the GPU sits idle.

```bash
# Local, no GPU (cron-only, part of docker-compose.yml):
docker compose up --build

# GPU box / cloud GPU:
docker build -f worker/Dockerfile.gpu -t speakez-worker-gpu .
docker run --gpus all -v speakez-models:/models --env-file .env speakez-worker-gpu

# Colab: see deploy/colab.ipynb

# Escape hatch — Colab dead, put the demo engine back on the real queue:
arq worker.main.WorkerSettings          # with ASR_ENGINE=demo
```

## Environment

`REDIS_URL`, `DATABASE_URL`, `API_BASE_URL`, `JWT_SECRET` (same as the API — it
signs the audio URLs the worker fetches), `ASR_ENGINE`, and on GPU `HF_HOME`
(model cache, e.g. `/models`).

The worker only makes outbound connections, so it can sit behind a tunnel or in
Colab. Any worker on the same `REDIS_URL` picks up jobs.

## Interface contracts

- `asr.WordTiming { word, start_sec, end_sec }`, `asr.Transcript { text, words }`
  — `words` powers the paragraph highlight in screen 04.
- `titles.title_for(transcript) -> str` is async so an LLM call can replace the
  fallback without callers changing.

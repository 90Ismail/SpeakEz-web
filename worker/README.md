# NeMo worker — roadmap

The worker turns a submitted recording into a transcript, a title and a safety
verdict. Today it is a CPU placeholder: `main.py` registers `process_note` on
the `arq` queue, the compose stack runs it, and nothing more. This file is the
path from here to the real pipeline on demo day.

## What `process_note(note_id)` must do

1. Load the note row; read the audio from `MEDIA_DIR` when the worker shares the
   API's media volume, otherwise fetch the signed URL the API hands out.
2. `to_wav_16k_mono()` — phones record m4a/AAC, Parakeet wants 16 kHz mono WAV.
3. `transcribe()` — `nvidia/parakeet-tdt-0.6b-v2`, word-level timestamps.
4. `title_for()` — one short LLM call when a key is configured, first-sentence
   fallback otherwise (already implemented in `titles.py`).
5. Run the safety lexicon (`api/app/services/safety.py`) → `draft` | `held` |
   `blocked`, writing `moderation_log` rows.
6. Write `title`, `body`, `words`, `status` back to `notes`, then invalidate the
   map cache (`app.cache.invalidate("map:")`).

Steps 1–3 and 5 are stubs behind documented interfaces in `asr.py`.

## Deployment decision (pick before Tuesday)

| Option | Audio reaches the worker | Notes |
| --- | --- | --- |
| Same machine | Shared `media` volume, direct file read | Simplest; CPU Parakeet is slow for 2–3 min clips |
| GPU box / Colab | `storage.signed_url` → immediate HTTPS download | Worker needs outbound network; URL expires in 60 s so fetch first, then process |
| Cloud GPU | Same signed URL | Keep model cache on a volume so weights download once (~2.5 GB) |

The API owns `/notes/{id}/submit`, which enqueues `process_note` by name:

```python
await arq_pool.enqueue_job("process_note", note_id)
```

Any worker pointed at the same `REDIS_URL` and `DATABASE_URL` picks it up —
that is how the GPU box joins the demo stack.

## Phases

- [ ] **1. Safety + titles offline (no GPU).** Move the lexicon into
      `api/app/services/safety.py` per the build order; have the worker import
      the API package (or vendor the lexicon) so there is one implementation.
      Unit-test both paths. Unblocks step 8 of the build order.
- [ ] **2. GPU image.** `worker/Dockerfile.gpu` from `nvidia/cuda` + ffmpeg +
      `nemo_toolkit[asr]` (pin at build time), model cache volume mounted at
      `/models` (`HF_HOME=/models`). Smoke test: `transcribe()` a checked-in
      WAV fixture and assert non-empty `words`.
- [ ] **3. End-to-end.** `/notes` upload → `/submit` → worker → `/draft`
      returns title, body and words; `/publish` → note appears on `/map`.
      Target: a 60 s clip processed in well under a minute on the GPU box.
- [ ] **4. Demo fallback.** If no GPU is available Tuesday: CPU Parakeet on a
      short clip, or a pre-transcribed seeded note. Demo mode (`DEMO_MODE=true`)
      skips the publish delay, never the safety check.

## Interface contracts

- `asr.WordTiming { word, start_sec, end_sec }`, `asr.Transcript { text, words }`
  — `words` powers the paragraph highlight in screen 04.
- `titles.title_for(transcript) -> str` is async so the LLM call can replace the
  fallback without callers changing.
- Worker env: `REDIS_URL`, `DATABASE_URL`, `MEDIA_DIR`, `STORAGE_BACKEND`;
  later `HF_HOME`, provider key for titles.

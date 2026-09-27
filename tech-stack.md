# SpeakEz — Tech Stack

Mobile-only app for anonymous, place-based voice notes at UMN. This file is the source of truth for what we use and why. Change it before changing the code.

## At a glance

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | Expo (latest SDK) + React Native + TypeScript | One codebase for iOS and Android; runs in Expo Go for fast demos |
| Navigation | expo-router | File-based screens: map, story, record, care |
| Map | react-native-maps (Apple Maps on iOS, Google Maps on Android) | Free native maps; custom JSON style on Google matches the wireframes. POIs stay visible but muted (businesses, schools, sports, medical, parks, attractions, Green Line); only clutter is hidden. Custom landmark layer in `src/campusLandmarks.ts` |
| Location | expo-location, foreground only | "While Using the App" permission; no background tracking |
| Audio in app | expo-audio | Record (m4a) and play back |
| Fonts | Karla, Newsreader (Google Fonts, OFL) | Calm UI sans + editorial serif titles/transcript |
| API | FastAPI (Python 3.12), Pydantic v2 | Same language as the NeMo worker; async; auto OpenAPI docs |
| Database | PostgreSQL 16 + PostGIS | Distance and "within radius" queries for unlocking notes |
| ORM / migrations | SQLAlchemy 2.0 (async) + GeoAlchemy2, Alembic | Versioned schema changes we control |
| Cache / queue | Redis + arq | Map query cache, OTP codes, rate limits, background audio jobs |
| Audio files | Local disk for the demo → S3-compatible bucket (Cloudflare R2) later | See "Storage" below |
| Auth | Own umn.edu email OTP → JWT | No third-party auth; only a hashed email is stored |
| OTP email | Resend (behind a `send_email()` wrapper) | Swappable provider |
| Speech AI | NVIDIA NeMo, Parakeet TDT 0.6B v2 | English transcription with word timestamps |
| Titles | Small LLM call on the transcript, first-sentence fallback | Substack-style auto title |
| Safety | Versioned lexicon YAML + rules in the API | Self-harm → care screen, threats → block, before anything publishes |
| Local dev | Docker Compose: postgis, redis, api, worker | One command to run everything |
| Hosting (after demo) | Any Docker host for api + db + redis; a GPU box or GPU cloud for the worker | Nothing tied to one vendor |

## How a note flows

```
phone ──record m4a──▶ API /notes (upload)
                        │ saves file, creates note (status: processing)
                        ▼
                     Redis queue ──▶ NeMo worker
                                      1. ffmpeg: m4a → 16 kHz mono WAV
                                      2. Parakeet: transcript + word timestamps
                                      3. title (LLM / fallback)
                                      4. safety lexicon → draft | held | blocked
                        ◀─────────── writes result to Postgres
phone ◀── /draft ── author edits title, cuts sentences ── /publish (delayed)
other phones ◀── /map (cached) ── walk close ── /unlock (PostGIS distance check) ── audio + transcript
```

## NeMo worker: what it actually needs

NeMo does **not** need S3. It needs an audio file it can read and a machine to run on.

| Need | Detail |
| --- | --- |
| Python + PyTorch + `nemo_toolkit[asr]` | Pin versions in `worker/requirements.txt`; install is large, so bake it into the worker Docker image |
| Model weights | `nvidia/parakeet-tdt-0.6b-v2`, downloaded from Hugging Face on first run and cached. Mount the cache as a volume so it isn't re-downloaded |
| GPU | Strongly recommended (any recent NVIDIA card, or a Colab / cloud GPU). CPU works for short clips but is slow |
| ffmpeg | Phones record m4a/AAC; convert to 16 kHz mono WAV before transcribing |
| Access to the audio file | Local path if the worker runs on the same machine as the API; otherwise a URL it can download from |
| Access to Redis + Postgres | To pick up jobs and write results |

Parakeet v2 is English-only. Non-English notes are held for review in v1.

## Storage: do we need S3?

**Not for Tuesday.** It depends only on where the worker runs:

- **API and worker on the same machine:** save audio to a local `media/` volume. The worker reads the path; the API serves playback through a short-lived signed link. No S3.
- **Worker on a separate GPU box (e.g. Colab):** it needs to fetch the file. Either the API exposes a signed download link, or both use an S3-style bucket. Either works.
- **Production:** use Cloudflare R2 (S3-compatible). Files outlive any one server, and playback links come straight from storage instead of the API.

All file access goes through one `storage.py` interface (`save`, `open`, `signed_url`, `delete`) so switching from local disk to R2 is a config change, not a rewrite.

## Privacy constraints the stack enforces

- No raw GPS stored; notes keep only a `landmark_id`. Unlock positions are never logged.
- Only `HMAC(email)` stored; no plain emails.
- Raw recordings deleted after processing (or after review for held notes).
- Notes expire after 30 days.

## Not in v1

Speaker diarization, speaker recognition, spoken intent/slot models, re-voiced TTS playback, translation, real map clustering. All are NeMo-compatible later additions (see the PRD).

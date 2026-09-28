# SpeakEz

**Hear what campus doesn't say out loud.**

Anonymous voice notes, tied to the places they were left. Walk within 150 m and a note unlocks:
someone's 2 a.m. thought on the Walter Library steps, left exactly where you're standing.

Built by students, for UMN.

---

## The problem

Campus is loud about the things that are easy to say. Class rankings, internships, weekend plans.
The things that actually weigh on people (the failing exam, the quiet loneliness, the small win
nobody saw) stay unsaid, because every tool we have is *social*: it attaches your name, your
followers, your face.

The honest things don't get posted. They get thought, at a place, alone.

## What SpeakEz is

A map of voices instead of a feed.

- Record up to 3 minutes at the spot where it happened.
- The note lives on that spot. No author, no profile. The first post owns the place; anyone standing
  there can answer with an anonymous voice reply, and replies thread underneath it.
- Nobody can play it unless they are physically there: the server checks your distance with PostGIS
  before it hands over the audio.
- Read along as it plays, word by word, and tap a paragraph to jump there.

No followers. No counts. No performance. A voice, a place, and whoever walks by next.

### Three kinds of note

Every recording ends up as one of these. You pick on the "Where should this note go?" step:

| Kind | Who hears it | Where it lives |
| --- | --- | --- |
| **Public post** | Anyone standing at the place | Pinned to a landmark on the map. Anonymous: nobody sees who posted it |
| **Voice journal** | Only you | Your Journal tab. Never goes on the map |
| **Draft** | Only you | Your Journal tab, until you post it or move it to your journal |

### Daily prompt

The top of the Journal tab asks one question a day ("What did today ask of you?"). Everyone gets
the same prompt, and it changes at midnight campus time. **Answers are private:** they save straight
to your voice journal and can never be posted on the map (the database refuses it).

### Replies and reactions

Under every unlocked story you can leave one of the four quiet reactions, or **reply with your voice**.
The original post stays first at the place and replies stack under it, oldest first, all anonymous.
Replies unlock with the post, so you have to be there to hear them or add one.

### Finding your way around

The bottom bar has five tabs, in this order:

| Tab | What's there |
| --- | --- |
| **Map** | Public posts around campus. Walk close to unlock one |
| **Journal** | Everything you've recorded: public posts, voice journal, drafts |
| **Record** | Record a new note |
| **Saved** | Other people's notes you saved from the map |
| **Profile** | Recently heard, help and resources, settings |

## Why place matters

A note about failing your first exam, recorded outside the building it happened in, hits different
than the same words in a timeline. Place is context and intent:

- **You had to be there.** The 150 m unlock radius makes listening an act, not a scroll.
- **It belongs to a moment.** Notes fade after 30 days. The map stays honest.
- **It's for the next person walking the same path**, not for an audience.

## How a note travels

```
phone --record--> API /notes (audio upload)
                    |  worker: Parakeet transcription + title + safety
                    v
              draft -> author reviews -> publish (short random delay)
                    |
map reads <-- /map (Redis-cached) <-- Postgres + PostGIS
                    |
walk closer --> /notes/{id}/unlock (distance check) --> transcript + signed audio
```

## Privacy by design

Anonymity here is architecture, not a setting:

- **No email stored.** Sign-in confirms an `@umn.edu` address, then stores only
  `HMAC-SHA256(email, pepper)`.
- **No raw GPS stored.** A note remembers a landmark, never coordinates. Positions sent to
  `/unlock` are used for the distance check and never logged or stored.
- **Server-checked unlock.** `ST_DWithin` decides if you're close enough. No client-side trust.
- **Time without fingerprints.** You'll see "this evening", never "7:42 pm".
- **Safety before publish.** Every transcript passes a versioned lexicon first. Self-harm language
  holds the note and shows care resources (988, Crisis Text Line, Boynton). Threats are blocked.
  Nothing goes live unreviewed by that gate.

## What's live in the demo

- Map of campus with live notes from the API, POI-muted Apple/Google styling, campus landmark layer.
- Five-tab bottom bar (Map, Journal, Record, Saved, Profile) and a Journal tab split into public posts, voice journal and drafts.
- Journal entries are enforced server-side: they never appear on `/map` and can never be unlocked.
- Daily prompt card in Journal (`GET /prompts/today`), answers journal-only.
- Reply threads under stories, returned by `/unlock` with the post; reply counts on the map card.
- Server-checked unlock, story screen, and real playback with word-synced transcript highlighting.
- Seeded notes ship with generated voices and word timings, so the demo plays end to end immediately.
- Dark mode, custom type system (Karla + Newsreader), and a dev theme-check screen.

In the works: umn.edu OTP sign-in, the record upload path into the GPU worker, the safety gate wired
into publish, and reactions.

## Try it

```bash
cp .env.example .env
docker compose up -d          # postgis + redis + api + worker
docker compose exec api python seed.py
```

Then run the app (`npm install`, `npm start`) in Expo Go. On a physical phone set
`EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000`.

Demo tour:

1. Open the app. Pins for the seeded notes load from the API.
2. Long-press the `speakez` wordmark to toggle demo mode, then long-press the map near a landmark.
3. Tap the unlocked pin, read the card, open the story, and play it. The transcript follows along.
4. Drag the scrubber and tap paragraphs to jump. Everything stays put.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Expo SDK 57, React Native, TypeScript | One codebase, runs in Expo Go for the demo |
| Navigation | expo-router | File-based screens; five-tab bottom bar: map, journal, record, saved, profile |
| Map | react-native-maps | Apple Maps (mutedStandard) on iOS, Google + custom JSON style on Android; landmarks drawn above provider labels |
| Location | expo-location, foreground only | Background permission is explicitly blocked in the app config |
| Audio | expo-audio | Record and play; note audio is cached locally before the signed URL expires |
| Fonts | Karla (UI) + Newsreader (editorial) | The app speaks in sans, the students speak in serif |
| API | FastAPI (Python 3.12), async, Pydantic v2 | Same language as the ASR worker; typed contracts |
| Database | PostgreSQL 16 + PostGIS | Distance checks and map queries in the database, not in JS |
| ORM / migrations | SQLAlchemy 2.0 async + GeoAlchemy2 + Alembic | Every schema change is a migration |
| Cache / queue | Redis + arq | Map cache, OTP codes, rate limits, transcription jobs |
| Speech AI | NVIDIA NeMo Parakeet TDT 0.6B v2 | English transcription with word timestamps (GPU worker) |
| Titles | Short LLM call, first-sentence fallback | Substack-style auto titles |
| Safety | Versioned lexicon YAML + rules | Deterministic gate before anything publishes |
| Storage | Local media volume behind `storage.py` | `save` / `open` / `signed_url` / `delete`; Cloudflare R2 later by config |
| Local dev | Docker Compose | `docker compose up` brings up db, redis, api, worker |

## Repo map

```
app/        Expo Router screens (map, journal, record, saved, profile, story, care)
src/        theme tokens, map style + landmarks, API client, player, components
api/        FastAPI app, Alembic migrations, seed data + seed audio
worker/     arq worker (Parakeet roadmap in worker/README.md)
```

Deeper docs: `AGENTS.md` (build plan and hard rules), `tech-stack.md` (stack decisions and
rationale), `worker/README.md` (ASR pipeline roadmap).

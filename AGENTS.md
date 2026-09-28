# SpeakEz — build handoff for a coding agent

Anonymous, place-based voice notes for UMN students. Hackathon demo is **Tuesday**. Build the smallest thing that demos end to end; do not add features beyond this file.

Designs live in `SpeakEz.pen` (Pencil). Read them through the Pencil MCP: screens 01 Map / Discovery, 02 Voice Card Preview, 03 Expanded Story, 04 Active Playback, plus any others in the file. Nothing is built yet; this repo starts with only AGENTS.md, tech-stack.md, README.md and SpeakEz.pen.

## Tech stack (do not swap without asking)

| Layer | Choice |
| --- | --- |
| App | Expo (latest SDK), TypeScript, **expo-router** for navigation |
| Map | `react-native-maps` — Apple Maps (`mapType="mutedStandard"`) on iOS in Expo Go, Google on Android with a custom JSON style in `src/mapStyle.ts` (warm grey land, white roads, pale blue water, soft green parks). **POI policy: keep businesses (food, cafés, bars, stores), schools/university, sports venues (Huntington Bank Stadium, Williams Arena), medical (Boynton), parks, attractions (Weisman), and Green Line stations — all muted grey/desaturated. Hide only clutter: bus stops, government offices, places of worship, highway shields, road-number labels.** iOS: `showsPointsOfInterest` + `mutedStandard`. A `USE_GOOGLE_ON_IOS` flag switches iOS to Google for dev builds. Custom landmark layer in `src/campusLandmarks.ts` drawn above provider labels |
| Location | `expo-location`, **foreground only**. Never call `requestBackgroundPermissionsAsync` or geofencing APIs |
| Audio (app) | `expo-audio` (record + playback). Not `expo-av` |
| Fonts | Karla (UI), **Newsreader** (serif: titles, transcript, editorial) via `@expo-google-fonts/*` |
| API | **FastAPI** (Python 3.12), async, Pydantic v2 schemas |
| Database | **PostgreSQL 16 + PostGIS**, SQLAlchemy 2.0 (async, `asyncpg`) + GeoAlchemy2 |
| Migrations | **Alembic**. Every schema change is a migration; never edit the DB by hand |
| Cache / queue | **Redis**: response cache, OTP codes, rate limits, and the job queue (`arq`) |
| Audio storage | Local `media/` volume for the demo, behind `storage.py` (`save`, `open`, `signed_url`, `delete`); Cloudflare R2 later by config. See tech-stack.md |
| Auth | Our own: umn.edu email OTP → short-lived JWT access token + refresh token |
| OTP email | Transactional email provider (e.g. Resend) behind a small `send_email()` wrapper so it can be swapped |
| Audio processing | `arq` worker process running NVIDIA NeMo `nvidia/parakeet-tdt-0.6b-v2` (GPU box or Colab tunnel for the demo) |
| Titles | Short LLM call on the transcript, or first-sentence fallback |
| Local dev | `docker compose up` brings up postgis, redis, api, worker |

## Hard rules

1. **Anonymity:** never store raw GPS for a note; store `landmark_id` only. A note is a **public post** (on the map, anonymous) or a **voice journal** entry (`visibility = 'journal'`: author only, no place required, never returned by `/map` or `/unlock`). Drafts are a status, not a visibility. Never return an author ID to clients. Display dates at day level ("this evening"), never minutes.
2. **Sign-in:** OTP only for `@umn.edu` addresses, checked in the API. Store `email_hmac = HMAC-SHA256(lowercased email, EMAIL_PEPPER)`, never the email itself. OTP codes live in Redis with a 10-minute TTL and 5-attempt limit.
3. **Unlock is server-checked:** `POST /notes/{id}/unlock` receives the client position, computes distance with PostGIS `ST_DWithin`, and only then returns body, words and a signed audio URL (60 s expiry, from `storage.signed_url`). Positions sent to `/unlock` are never logged or stored.
4. **Safety before publish:** every transcript passes `api/safety/lexicon.v1.yaml` before a note goes live. Self-harm terms (`unalive`, `sewerslide`, `kms`, …) → status `held` and the app shows the care screen (988, Crisis Text Line, Boynton). Threat patterns → `blocked`. Never show "rejected" alone for self-harm.
5. `UNLOCK_RADIUS_M` lives in one place per side (`src/config.ts`, `api/app/config.py`) and they must match.
6. Keep demo mode (long-press logo, long-press map) working at all times. The API has `DEMO_MODE=true` that skips the publish delay; it never skips the safety check.
7. No business logic in route handlers: routes → services → repositories. Keeps caching and query tuning in one layer.
8. **No raw colors:** every color in the app comes from `src/theme.ts` tokens (light + dark). Raw hex outside `theme.ts` / `mapStyle.ts` is a review failure — the dev theme-check screen flags it.
9. **Campus landmarks:** `src/campusLandmarks.ts` is the single source for the custom landmark layer. Adding one is a one-line entry `{ name, coordinate, bank, category }` — never touch map components to add a landmark.
10. **Native map attribution stays visible:** draw no extra attribution; use `MapView mapPadding` so the header, bottom nav and voice card never cover Apple's legal label or Google's logo.

## Target structure

```
app/                         Expo Router screens
  _layout.tsx                fonts, SafeAreaProvider, theme provider, auth gate
  onboarding/welcome.tsx     00a Onboarding — Welcome
  onboarding/location.tsx    00b Onboarding — Location
  (auth)/sign-in.tsx         00c Onboarding — Verify: umn.edu email → 6-digit code
  index.tsx                  MapScreen (screen 01)
  story/[id].tsx             screen 03 Expanded Story (+ 04 playback inside)
  record.tsx                 05 record → 06 choose (public post / voice journal / draft) → 07 processing → 08 review → post or save
  profile.tsx                screen 09 Profile Drawer (recently heard, help, settings, about)
  saved.tsx                  screen 11 Saved (bottom-bar tab)
  journal.tsx                screen 12 Journal (bottom-bar tab): public posts, voice journal, drafts
  care.tsx                   screen 10 Help & Resources (crisis resources)
  dev/theme-check.tsx        dev-only: every state in light + dark, raw-hex audit
src/
  theme.ts                   tokens from Pencil variables (light + dark)
  mapStyle.ts                Google map JSON style (light + dark)
  campusLandmarks.ts         one-line-per-landmark custom layer, drawn above provider labels
  zones.ts                   East Bank / West Bank zones (center + radius; polygon TODO)
  geo.ts                     haversine meters(), formatDistance() rounded to 10 m
  seedNotes.ts               seeded notes across East Bank + West Bank (until the API exists)
  components/                chips, buttons, nav pill, player controls, waveform, place eyebrow, reactions
  NotePins.tsx               dot, title chip, cluster pill, unlocked chip, user dot as Marker children
  VoiceCard.tsx              screen 02 bottom card
  config.ts                  API_URL, UNLOCK_RADIUS_M, USE_GOOGLE_ON_IOS
  api.ts                     typed fetch client, attaches JWT, refreshes on 401
  Player.tsx                 screen 04 playback bar + synced transcript
api/
  pyproject.toml
  alembic.ini
  alembic/versions/0001_init.py
  app/
    main.py                  FastAPI app, routers, CORS, lifespan (db + redis pools)
    config.py                pydantic-settings, reads env
    db.py                    async engine + session
    cache.py                 Redis helpers: get_or_set(key, ttl, fn), invalidate(prefix)
    models.py                SQLAlchemy models
    schemas.py               Pydantic request/response models
    auth/                    otp.py, jwt.py, deps.py (current_user)
    routes/                  auth.py, notes.py, reactions.py, health.py
    services/                notes.py, unlock.py, publish.py, safety.py
    storage.py               save, open, signed_url, delete (local disk now, R2 later)
    safety/lexicon.v1.yaml
  worker/
    main.py                  arq WorkerSettings: process_note(note_id)
    asr.py                   Parakeet transcribe with word timestamps
    titles.py
  seed.py                    landmarks + the same seeded notes as src/seedNotes.ts
  tests/                     pytest: auth domain check, unlock distance, safety lexicon
docker-compose.yml
.env.example
```

## Data model (Alembic 0001 + 0002 + 0003)

```sql
create extension if not exists postgis;
create table accounts (id uuid primary key, email_hmac bytea unique not null,
  status text not null default 'active', created_at timestamptz default now());
create table landmarks (id text primary key, name text not null, zone text not null,
  geom geography(Point, 4326) not null);
-- TODO(post-demo): zone_polygon geography(Polygon, 4326) for real East/West Bank
-- zones; the demo uses center + radius approximations in src/zones.ts
create index landmarks_geom_gix on landmarks using gist (geom);
create table notes (id uuid primary key, author_id uuid not null references accounts,
  landmark_id text not null references landmarks,
  title text, body text, words jsonb, audio_key text, duration_sec int,
  status text not null default 'processing',   -- processing|draft|held|blocked|live
  -- 0002: visibility text not null default 'public' check (visibility in ('public','journal')),
  --       landmark_id nullable, but required when visibility = 'public'
  -- 0003: prompt_id int references prompts (answers must be visibility = 'journal'),
  --       parent_id uuid references notes on delete cascade (replies must be visibility = 'public')
  publish_at timestamptz, created_at timestamptz default now(), seeded boolean default false);
create index notes_live_idx on notes (landmark_id)
  where status = 'live' and visibility = 'public' and parent_id is null;  -- 0002, 0003
create index notes_replies_idx on notes (parent_id, created_at) where parent_id is not null and status = 'live';  -- 0003
create table prompts (id serial primary key, text text unique not null, created_at timestamptz default now());  -- 0003
create table reactions (note_id uuid references notes on delete cascade,
  account_id uuid references accounts,
  type text check (type in ('heard_you','same','strength','helped')),
  primary key (note_id, account_id));
create table moderation_log (id bigserial primary key, note_id uuid references notes,
  layer text, label text, decision text, created_at timestamptz default now());
```

## API (v1)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/start` | `{email}` → 204. Rejects non-umn.edu with 422. Rate limit 5/hour per email hash + per IP |
| POST | `/auth/verify` | `{email, code, over18: true}` → `{access, refresh}` |
| POST | `/auth/refresh` | refresh → new access |
| GET | `/map?bbox=w,s,e,n` | Live **public original posts** in view (never journal entries or replies), each with `reply_count`: `id, title, landmark {id,name,lat,lng}, duration_sec, day_label`. **Cached in Redis 30 s per rounded bbox**; invalidated when a note goes live |
| POST | `/notes` | `{landmark_id, duration_sec}` multipart audio upload → `{note_id}`; file saved via `storage.save` |
| POST | `/notes/{id}/submit` | Audio uploaded → enqueue `process_note` |
| GET | `/notes/{id}/draft` | Author only: status, title, body, flags |
| POST | `/notes/{id}/publish` | `{title?, removed_sentence_ids?}` → schedules `publish_at` |
| POST | `/notes/{id}/unlock` | `{lat, lng}` → 403 if outside radius, else `{body, words, audio_url, replies[]}`; replies oldest first, loaded only after the distance check |
| GET | `/prompts/today` | Today's journal prompt `{id, text, date}`; same for everyone, rotates at campus midnight |
| POST | `/notes/{id}/replies` | *(not built yet)* multipart voice reply; must pass the same unlock distance check, always public, never on the map alone |
| POST | `/notes/{id}/reactions` | `{type}` |
| GET | `/landmarks/nearest?lat&lng` | Used by record flow to pick the landmark; position not stored |
| GET | `/health` | db + redis check |

Publishing: an `arq` cron job every minute flips `draft → live` where `publish_at <= now()` and invalidates the map cache.

## Caching and performance notes

- Map reads are the hot path: cache `/map` responses in Redis keyed by bbox rounded to ~200 m; 30 s TTL plus explicit invalidation on publish.
- Unlock responses are **not** cached (per-user, position-dependent). Cache the note body lookup by `note:{id}` for 5 min instead.
- Presigned GET URLs expire in 60 s; don't cache them longer than 30 s.
- Use `EXPLAIN ANALYZE` on `/map` and `/unlock` queries once seeded; both must hit the GiST / partial indexes.

## Local dev (create these files)

`docker-compose.yml` with services: `db` (postgis/postgis:16-3.4, healthcheck `pg_isready`), `redis` (redis:7-alpine), `api` (`alembic upgrade head && uvicorn app.main:app --reload` on :8000), `worker` (`arq worker.main.WorkerSettings`; CPU placeholder, run the real one on a GPU box pointed at the same Redis/DB and able to fetch audio via signed URL).

`.env.example`:
```
DATABASE_URL=postgresql+asyncpg://speakez:speakez@db:5432/speakez
REDIS_URL=redis://redis:6379/0
STORAGE_BACKEND=local
MEDIA_DIR=/app/media
JWT_SECRET=change-me
EMAIL_PEPPER=change-me-too
ALLOWED_EMAIL_DOMAIN=umn.edu
RESEND_API_KEY=
UNLOCK_RADIUS_M=150
DEMO_MODE=true
```

## Build order (stop and demo after each)

0. **Scaffold.** `npx create-expo-app@latest . --template blank-typescript`, add expo-router and the packages in tech-stack.md. Don't overwrite the markdown files or SpeakEz.pen. In `app.json`: expo-location plugin with background location disabled on iOS and Android, `android.blockedPermissions: ["android.permission.ACCESS_BACKGROUND_LOCATION"]`, and a when-in-use message: "SpeakEz uses your location only while the app is open, to unlock voice notes left where you're standing."
1. **Map screen (01) + Voice Card (02) from Pencil.** Real map (never an image of the design). Pins/chips/radius are Marker children and a Circle. Pin states: far = dot only; near = dot + white title chip; unlocked = green chip with "UNLOCKED · 90 M"; selected = dark chip. Header follows the map's centre: "NEAR DINKYTOWN" / "NEAR STADIUM VILLAGE" / "NEAR EAST BANK · UMN" / "NEAR WEST BANK · UMN" / "NEAR ST. PAUL CAMPUS · UMN" (areas in `src/zones.ts`, small neighbourhoods first) + "{N} voices nearby" for the notes in view. Tapping a pin slides up the card; locked card shows a lock and "Walk X m closer to listen". Apply the POI policy through `src/mapStyle.ts` and draw `src/campusLandmarks.ts` above provider labels. Default camera frames both banks with the river between; `src/zones.ts` labels EAST / WEST BANK ZONE. `MapView mapPadding` keeps native attribution clear of header, nav and voice card. Foreground location via `watchPositionAsync`; handle denied and "Precise off". Demo mode: long-press logo toggles, long-press map sets fake position. Constants: `UNLOCK_RADIUS_M=150`, chip radius 450 m, "short walk" 400 m. Done when it runs in Expo Go on seed data.
2. **Backend skeleton.** `docker compose up`, Alembic 0001, `seed.py`, `/health`, `/map`. Done when `curl /map?bbox=...` returns the seeded notes.
3. **App read path.** Replace the `NOTES` import with `/map`. Done when pins come from the API.
4. **Unlock + Screen 03 Expanded Story.** `/unlock`, then the story screen: small map header with the pin, place eyebrow, title, "Anonymous student · Left at {place} · {day}", player row, transcript in paragraphs (serif body 19/27, `type-reading`). Locked → title only + "Walk closer to read and listen".
5. **Screen 04 Active Playback.** `expo-audio` player; mini-map header with "Listening here" chip; waveform progress; highlight the paragraph being spoken using `words[]` timestamps with a green left rule; control pill (1x speed, back 15, play/pause, forward 15, transcript toggle).
6. **Auth.** OTP + JWT, 18+ checkbox. Done when a non-umn email gets 422 and all note routes require a token.
7. **Record flow.** Hold to record (max 3 min) → `/landmarks/nearest` scoped to the user's zone (East Bank / West Bank) → `/notes` (upload audio) → `/submit` → worker transcribes + titles + safety → draft screen (edit title, cut sentences) → `/publish` with random 5–30 min delay (demo mode: immediate).
8. **Safety + care screen.** Lexicon in `services/safety.py`, `held` status, care screen in the app. Tests for each lexicon category.
9. **Reactions.** Four fixed reactions on screen 03; show "heard by many" instead of counts.
10. **Dark mode.** After the light frames: same components, tokens only, dark values from the 7 dark frames. Follows the system setting plus a dev toggle to force light/dark. Dark Google JSON map style; iOS `userInterfaceStyle` dark.
11. **Theme-check screen.** `app/dev/theme-check.tsx` renders every component and screen state in both themes side by side and flags raw hex outside `theme.ts` / `mapStyle.ts`.

Skip until after Tuesday: diarization, speaker recognition, SLU fine-tuning, re-voiced TTS audio, real clustering (keep the static cluster pills), multi-campus.

## Definition of done for the demo

On a phone in demo mode: open app → map shows seeded pins from the API → long-press near Walter Library → pin unlocks → card → Read the story → play with synced transcript → record a new note → it appears on the map with a generated title. A note saying "I want to unalive myself" shows the care screen and never goes live. `pytest` passes.

## Decisions (2026-09-27)

Where the docs and `SpeakEz.pen` disagree on visuals, the design wins.

1. **Serif font — Newsreader** (the design's `serif` variable) replaces Instrument Serif everywhere in the docs and theme. Karla stays for UI text.
2. **Map POIs — keep and mute.** Businesses (food, cafés, bars, stores), schools/university buildings, sports venues (Huntington Bank Stadium, Williams Arena), medical (Boynton), parks, attractions (Weisman) and Green Line stations stay visible, desaturated. Hide only clutter: bus stops, government offices, places of worship, highway shields, road-number labels. Apple keeps `showsPointsOfInterest`. Custom one-line landmark layer in `src/campusLandmarks.ts`. Default view covers East Bank + West Bank with the river between.
3. **Dark mode — after the light frames.** Tokens only, follows the system setting plus a dev force toggle; dark Google JSON style and dark Apple map; dev theme-check screen audits for raw hex.
4. **Seed notes — the ~8 titles from the designs** (not 5), spread across East Bank (Walter Library, Northrop Mall, Coffman Union, Pillsbury Hall, The Knoll) and West Bank (Wilson Library, Carlson School, Rarig Center), marked seeded/early tester in `src/seedNotes.ts` and `seed.py`.
5. **Campus zones — center + radius in `src/zones.ts`** until real polygons exist (see `zone_polygon` TODO in the data model). Zone renders as a soft shape with an EAST / WEST BANK ZONE label; 06 Choose Place suggests the nearest landmark inside the user's zone.
6. **Attribution — native only.** No drawn attribution; `MapView mapPadding` keeps overlays clear of Apple's legal label and Google's logo.

## Decisions (2026-09-28)

7. **Bottom bar — five labelled tabs:** Map, Journal, Record (accent, center), Saved, Profile. Saved Audio and My Posts move out of the profile drawer; the drawer keeps only account items.
8. **Three kinds of note, one vocabulary:** Public post / Voice journal / Draft. Names, one-line summaries and icons live in `src/noteKinds.ts`; 06 Choose Place and the Journal tab both read from it. Public posts pick "this spot" or "anywhere on campus" as a sub-choice.
9. **Voice journal is a visibility, enforced by the API** (Alembic 0002), not just a UI label: journal notes are filtered out of `/map` and refused by `/unlock`.
10. **Daily prompt is journal-only.** One prompt per campus day from the `prompts` table (`GET /prompts/today`); answers are `visibility = 'journal'` with `prompt_id`, enforced by a DB check. The Journal tab shows it first; the record flow skips Choose Place and saves to the journal.
11. **Replies thread under the original post.** A reply is a public note with `parent_id`; it shares the parent's landmark, is excluded from `/map`, and comes back inside `/unlock` after the distance check. The four quiet reactions stay as they are, above the thread.

# Deploying SpeakEz (sturdy, cheap)

Two pieces, deliberately separable:

- **The API stack** — `api` + PostgreSQL/PostGIS + Redis. Small, always on, cheap.
- **The NeMo worker** — GPU, expensive, can come and go. It only dials *outward*
  to Redis, the database and the API, so it can sit behind a tunnel, on a lab
  GPU box, or in Colab. Nothing needs to reach *into* it.

```
                 enqueue process_note
 phone ──HTTPS──> api ──> Redis ──> GPU worker ──> Postgres
                   │                    │
                   └── signed audio URL ┘  (worker downloads, then transcribes)
```

The API enqueues a job by name (`process_note`) onto the **default arq queue**. Exactly one
transcription worker should be listening there (the GPU, or Colab) — a second one races it and can
answer with the demo transcript. The always-on CPU worker is therefore **cron-only, on its own
queue** (`speakez:cron`): it flips due drafts to live and never touches `process_note`.

---

## 1. API stack on a small host

### From scratch on a fresh VPS (one command)

```bash
git clone <your-repo> speakez && cd speakez
./deploy/vps-bootstrap.sh --ip <VPS_IP> --tls --cpu-worker
```

It installs Docker, writes `.env` with fresh `JWT_SECRET`/`EMAIL_PEPPER`/DB
password (never overwriting an existing `.env`), sets `API_HOST`/`API_BASE_URL`
from the IP via sslip.io, brings up the stack, seeds the data, and prints the
forwarding-only SSH key + `authorized_keys` line for the Colab worker. Re-runnable.

### Option A — one small VM (simplest, keeps PostGIS)

PostGIS is a hard requirement, and most managed Postgres add-ons don't ship it.
A single 1 GB VM running the containers is the cheapest sturdy setup.

```bash
git clone <your-repo> speakez && cd speakez
cp .env.production.example .env
# edit .env: set JWT_SECRET and EMAIL_PEPPER (openssl rand -hex 32), and
# DATABASE_URL's password to match POSTGRES_PASSWORD.
docker compose -f docker-compose.prod.yml up -d --build

# Seed landmarks + the demo notes (first boot only):
docker compose -f docker-compose.prod.yml exec api python seed.py
```

That starts `db`, `redis` and `api`. Then either:

- **Run the GPU worker elsewhere** (section 2). `db` and `redis` are published to
  **VPS loopback only** (`127.0.0.1:5432`, `127.0.0.1:6379`) so a Colab SSH tunnel
  can land on them without exposing anything to the internet.
- **Or run the always-on cron worker here**, so published drafts still go live even
  when the GPU is offline:

  ```bash
  docker compose -f docker-compose.prod.yml --profile cpu-worker up -d
  ```

  This runs `arq worker.main.CronWorkerSettings` (queue `speakez:cron`), not the
  transcription worker. Confirm it is alive:

  ```bash
  docker compose -f docker-compose.prod.yml logs -f worker   # release_due_notes every minute
  redis-cli -h 127.0.0.1 ping                                 # PONG from the VPS
  pg_isready -h 127.0.0.1                                     # accepting connections
  ```

### Option B — Railway / Fly.io / Render

Deploy the **API container** (`api/Dockerfile`) and use **managed Postgres and
Redis**:

- **Postgres must be PostGIS-enabled.** Providers that offer it: Railway's
  PostGIS template, a Supabase project (enable the `postgis` extension), or any
  `postgis/postgis` image you run yourself. If your provider's Postgres cannot
  `CREATE EXTENSION postgis`, use Option A for the database.
- **Redis**: any managed Redis works. Use the `rediss://` (TLS) URL they give
  you. Upstash / Railway Redis are fine and are reachable from the GPU worker.
- Set the env vars from `.env.production.example` in the provider's dashboard.
  `DATABASE_URL` and `REDIS_URL` point at the managed services; `API_BASE_URL`
  is the public URL the provider assigns; `PORT` is usually injected for you.

Run migrations once the container is up — the API command already does
`alembic upgrade head` on boot, so a deploy applies migrations automatically.

### CORS

Set `CORS_ORIGINS` to your Expo/web origin in production. `*` is fine for the demo.

### TLS / public API

The app and the worker want an HTTPS `API_BASE_URL`. If you do not already run a
reverse proxy on the VPS, enable the optional Caddy profile — it gets a free
Let's Encrypt certificate for a free `sslip.io` hostname (no domain needed):

```bash
# In .env: API_HOST=api.203-0-113-7.sslip.io  (dots in the IP become dashes)
#          API_BASE_URL=https://api.203-0-113-7.sslip.io
docker compose -f docker-compose.prod.yml --profile tls up -d
```

Caddy terminates TLS on 80/443 and proxies to `api:8000` (see `deploy/Caddyfile`).
If you already have your own proxy, skip the profile and just set `API_BASE_URL`.

---

## 2. GPU worker (NeMo Parakeet)

The worker needs `REDIS_URL`, `DATABASE_URL`, `API_BASE_URL`, and the **same
`JWT_SECRET`** as the API (it signs the audio URLs the worker downloads).

### Option A — GPU VM / cloud GPU with Docker

```bash
# On the GPU machine:
docker build -f worker/Dockerfile.gpu -t speakez-worker-gpu .
docker run --gpus all --restart unless-stopped \
  -v speakez-models:/models \
  -e REDIS_URL="redis://localhost:6379/0" \
  -e DATABASE_URL="postgresql+asyncpg://speakez:<password>@localhost:5432/speakez" \
  -e API_BASE_URL="https://api.<dashed-ip>.sslip.io" \
  -e JWT_SECRET="same-as-api" -e EMAIL_PEPPER="same-as-api" \
  -e ASR_ENGINE=parakeet -e HF_HOME=/models \
  speakez-worker-gpu
```

Reach Redis/Postgres over the same SSH tunnel described below (or run the worker
on the VPS next to the compose network). Weights (~2.5 GB) cache in the `/models`
volume, so they download once. This image is the right place for the pinned
`torch` in `worker/requirements-gpu.txt`; Colab deliberately diverges.

### Option B — Colab over an SSH tunnel (recommended for the demo)

Colab has no inbound ports, so it cannot be reached — but it only needs to dial
**outward**. Rather than exposing Postgres/Redis to the internet, open an SSH
tunnel from Colab to the VPS. Port 22 is already open; nothing new faces the
internet, and no domain or extra accounts are needed.

**Why not the obvious alternatives**

- *Publish `6379`/`5432` with passwords.* The `postgis` image ships SSL off, so
  `?ssl=require` fails and the DB password crosses the internet in clear; Redis
  `redis://` is plaintext too. With `DEMO_MODE=true` there is no auth in front.
- *Tailscale.* Colab has no `/dev/net/tun`, so it needs userspace networking and a
  SOCKS5 proxy, which `asyncpg`/`redis-py` won't use without extra shims.
- *Cloudflare Tunnel.* Needs a Cloudflare account and a domain.

**1. A forwarding-only key.** Generate a dedicated keypair and add the public
half to the VPS `~/.ssh/authorized_keys` with restrictions, so a leaked key
cannot get a shell or reach anything but those two ports:

```
command="/bin/false",no-agent-forwarding,no-x11-forwarding,no-pty,permitopen="127.0.0.1:6379",permitopen="127.0.0.1:5432" ssh-ed25519 AAAA... colab-worker
```

Put the **private** key in **Colab Secrets**, never in a cell. Delete the
`authorized_keys` line after the demo.

**2. The notebook.** Open `deploy/colab.ipynb` in a Colab GPU runtime. It writes
the key from Secrets, opens the tunnel, installs NeMo without touching Colab's
torch, points the worker at `localhost`, pre-warms the model, and runs
`deploy/colab_worker.py`. Test the exact tunnel command **from your laptop
first** with the same key — if it works there, it works in Colab.

The tunnel command it runs:

```bash
ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
    -i ~/.ssh/id_ed25519 \
    -L 6379:127.0.0.1:6379 -L 5432:127.0.0.1:5432 root@<VPS_IP>
```

`ServerAliveInterval=30` matters: an idle tunnel gets dropped and arq's reconnect
then fails against a dead forward. Worker env (pointing at the tunnel):

```
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql+asyncpg://speakez:<POSTGRES_PASSWORD>@localhost:5432/speakez
API_BASE_URL=https://api.<dashed-ip>.sslip.io
JWT_SECRET=<same as the API>   EMAIL_PEPPER=<same as the API>
ASR_ENGINE=parakeet            HF_HOME=/content/models
```

Colab constraints: free tier gives a T4 (plenty for Parakeet 0.6B), disconnects
after ~90 min idle, caps at ~12 h, and every reconnect redoes the install and the
~2.5 GB weight download — **a ~15 minute operation, not a refresh.** Keep the tab
open and visible; pre-warm before judging.

**3. If Colab dies, put the always-on worker back on the real queue.** This is the
whole rollback — one command on the VPS:

```bash
docker compose -f docker-compose.prod.yml --profile cpu-worker run -d --rm \
  -e ASR_ENGINE=demo worker arq worker.main.WorkerSettings
```

Notes sit at `processing` until then. That is the honest failure (no wrong
transcript) and better than a coin-flip while the GPU is idle.

---

## 3. Verify

```bash
curl https://api.<dashed-ip>.sslip.io/health          # {"status":"ok","db":true,"redis":true}
curl "https://api.<dashed-ip>.sslip.io/map?bbox=-93.25,44.97,-93.23,44.98"
```

Then, the only test that counts: record a note **in the app** saying something
specific and unusual ("the seventeenth of November, raining"), watch
`docker compose -f docker-compose.prod.yml logs -f api` show `POST /notes` then
`POST /notes/{id}/submit`, and confirm in order:

- [ ] `GET /notes/{id}/draft` returns **your actual sentence**, not the demo string
- [ ] `words` carry real start/end timings (not empty, not uniform)
- [ ] the story screen highlights word-by-word in time with the audio
- [ ] publishing makes the pin appear on the map within ~60 s (the cron worker is alive)
- [ ] **safety**: under `parakeet`, `DEMO_TRANSCRIPT` is ignored, so *say* something that trips
      the lexicon and confirm it routes to `/care` and never reaches the map

If notes stay at `processing`, either no transcription worker is on the default
queue (check Colab/GPU logs, and that its `REDIS_URL`/`DATABASE_URL` match), or the
cron worker is down. Use the rollback in §2B as an escape hatch.

## 4. Point the app at it (and the QR)

The Expo app reads its API URL from `EXPO_PUBLIC_API_URL` (`src/config.ts`):

```bash
EXPO_PUBLIC_API_URL=https://api.<dashed-ip>.sslip.io \
EXPO_PUBLIC_DEMO_URL=https://go.<dashed-ip>.sslip.io \
EXPO_PUBLIC_DEMO_LAT=44.97510 EXPO_PUBLIC_DEMO_LNG=-93.23580 \
npx expo start
```

`DEMO_MODE=true` keeps the shared demo account. For real email OTP sign-in, set
`DEMO_MODE=false`, `RESEND_API_KEY`, and `RESEND_FROM` (a verified sender); see the root README.

`EXPO_PUBLIC_DEMO_LAT` / `EXPO_PUBLIC_DEMO_LNG` are what make the demo work away
from campus, and they are **required for the judge path**. The server always runs
the `ST_DWithin` distance check (`DEMO_MODE` does not bypass it), and the app gates
on 150 m too, so without a seeded position every card reads "Walk 1.2 km closer to
listen". The coordinates above sit inside the unlock radius of Walter Library,
Northrop Mall and Scholars Walk; the first two carry seeded notes, so the map opens
with two pins already unlocked and no gesture required.

Set them and the hint chip stays hidden (nothing to explain). Leave them unset and
`src/demo.ts` turns the "long-press to move" chip on instead, as the manual
fallback — a long-press snaps to the nearest landmark.

### QR for judges

`EXPO_PUBLIC_DEMO_URL` is what the in-app QR encodes. Point it at the **landing
page** (`https://go.<dashed-ip>.sslip.io`), then show **Profile → Open on another
phone** and judges scan it off your screen — no printing needed.

**Do not host a web build for this.** Six screens import `react-native-maps`
(`MapScreen`, `NotePins`, `story/[id]`, `RecordPlaceStage`, both onboarding
screens), which has no web support and has no `.web.tsx` stubs here — a web export
loses the map, recording, playback and onboarding. The landing page is plain HTML
that links judges to Expo Go and then hands off to `exp://`.

Always set the variable. The `Linking.createURL("/")` fallback emits an `exp://`
URL, and iOS Camera will not hand a custom scheme to Expo Go cleanly — an HTTPS
landing page opens in Safari, and the tap there does the handoff.

## What still isn't built

`DEMO_MODE=true` uses the seeded "early tester" account without email setup.
Real OTP/JWT sign-in is available with Resend configured and `DEMO_MODE=false`.
Reactions persist per account (the demo account is shared between phones).
Replies now persist (they upload through `POST /notes/{id}/replies`) but the
Journal/Saved tabs still read seeded data. None of these block the Tuesday demo.


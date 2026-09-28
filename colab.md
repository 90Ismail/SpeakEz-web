# Plan: real Parakeet transcription from a Colab GPU

**Goal.** A judge records a note at the demo table and gets back *their own words*, transcribed by
Parakeet with word timings, instead of the fixed `ASR_ENGINE=demo` string.

**Deadline posture.** This is optional polish on top of a working demo. Do not start it until the
VPS is up, the QR works, and the geofence fix (`src/demo.ts`) is in. If it isn't working two hours
before judging, fall back to the CPU worker and steer judges to listening — that path is already
green.

---

## What already exists — do not rebuild it

The worker is genuinely portable already. Read these before writing anything:

| File | What it already does |
| --- | --- |
| `worker/pipeline.py` | `process_note`: fetch audio → ffmpeg → ASR → title → safety → write back. Fetches over the API's signed URL when it has no media volume (`_fetch_audio`). |
| `worker/asr.py` | Real `to_wav_16k_mono` + NeMo Parakeet TDT 0.6B v2, lazy-loaded. `ASR_ENGINE=parakeet` switches it on. |
| `worker/main.py` | `WorkerSettings`: `functions=[process_note]`, `cron_jobs=[cron(release_due_notes, run_at_startup=True)]`. |
| `deploy/colab_worker.py` | Bootstrap: validates env, checks ffmpeg, fixes `sys.path`, execs `arq worker.main.WorkerSettings`. |
| `worker/requirements-gpu.txt` | `arq`, `httpx`, `torch`, `nemo_toolkit[asr]`. |
| `deploy/README.md` §2B | The Colab sketch this plan makes concrete. |

**The handshake is already correct:** the API enqueues `process_note` by name onto the default arq
queue (`api/app/queue.py`). Any worker on the same `REDIS_URL` picks it up. Nothing needs to reach
*into* Colab.

So the work is not "build a GPU worker". It is **connectivity, queue isolation, and Colab's
environment quirks.** Three problems, in that order.

---

## Problem 1 — Colab cannot reach Redis or Postgres

`docker-compose.prod.yml` puts `db` and `redis` on the compose network only. Nothing is published to
the host, let alone the internet. Colab needs both:

- `REDIS_URL` — arq polls it for jobs
- `DATABASE_URL` — `SessionLocal`, `notes_repo`, `safety.apply_transcript_verdict`
- `API_BASE_URL` — HTTPS audio download (already public via Caddy, nothing to do)

### Decision: SSH tunnel from Colab, not public exposure

**Use an SSH tunnel.** Colab has outbound internet and can run `ssh`. It opens local forwards to the
VPS, and the worker connects to `localhost`. Port 22 is already open; **nothing new is exposed to the
internet.**

Rejected alternatives, so nobody re-litigates them:

- *Publish 6379/5432 publicly with passwords.* The `postgres`/`postgis` image ships with SSL off, so
  `?ssl=require` fails and the DB password crosses the internet in clear. Redis `redis://` is
  plaintext too. With `DEMO_MODE=true` there is no auth in front of any of it.
- *Managed Redis + Supabase.* Means moving the database off the box mid-demo-prep. PostGIS is a hard
  requirement and this is a migration, not a config change.
- *Tailscale.* Colab has no `/dev/net/tun`, so it needs userspace networking and a SOCKS5 proxy.
  `asyncpg` and `redis-py` will not route through SOCKS5 without extra shims.
- *Cloudflare Tunnel.* Needs a Cloudflare account and a domain. We have neither.

### 1a. Publish the two services to VPS loopback

`docker-compose.prod.yml`, so the tunnel has something to land on. **Loopback only** — this must not
become a public bind:

```yaml
  db:
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    ports:
      - "127.0.0.1:6379:6379"
```

### 1b. A forwarding-only SSH key

Generate a **dedicated** keypair. On the VPS, add the public key to `~/.ssh/authorized_keys` with
restrictions so a leaked key cannot get a shell or reach anything but these two ports:

```
command="/bin/false",no-agent-forwarding,no-x11-forwarding,no-pty,permitopen="127.0.0.1:6379",permitopen="127.0.0.1:5432" ssh-ed25519 AAAA... colab-worker
```

(`command="/bin/false"` does not block forwarding — with `ssh -N` no command is requested.)

Put the **private** key in Colab via **Colab Secrets** (`google.colab.userdata`), not pasted into a
cell — notebooks get shared and screen-recorded. Delete the `authorized_keys` line after the demo.

### 1c. The tunnel cell

```python
!mkdir -p ~/.ssh && chmod 700 ~/.ssh
from google.colab import userdata
open('/root/.ssh/id_ed25519','w').write(userdata.get('SPEAKEZ_SSH_KEY'))
!chmod 600 /root/.ssh/id_ed25519
!ssh-keyscan -H <VPS_IP> >> ~/.ssh/known_hosts

# -f backgrounds it, -N runs no command
!ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
    -i /root/.ssh/id_ed25519 \
    -L 6379:127.0.0.1:6379 -L 5432:127.0.0.1:5432 root@<VPS_IP>
```

Then the worker's URLs point at `localhost`:

```
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql+asyncpg://speakez:<POSTGRES_PASSWORD>@localhost:5432/speakez
API_BASE_URL=https://api.<dashed-ip>.sslip.io
JWT_SECRET=<same as the API — it signs the audio URL the worker downloads>
EMAIL_PEPPER=<same as the API>
```

`ServerAliveInterval=30` matters: an idle tunnel gets dropped and arq's reconnect will fail against a
dead forward.

---

## Problem 2 — two workers will race for the same job

This is the bug that will bite silently. `deploy/README.md` currently says to keep the `cpu-worker`
profile running on the API host so the `draft → live` cron always fires. But that worker registers
`functions=[process_note]` on the **same default queue** as Colab. Whichever polls first wins — so a
judge's note has a coin-flip chance of getting the canned `ASR_ENGINE=demo` transcript while a GPU
sits idle.

### Fix: split the cron onto its own queue

Add a cron-only settings class in `worker/main.py`:

```python
class CronWorkerSettings:
    """Cron only, on its own queue, so it never steals process_note from the GPU worker.

    One of these must always run somewhere: it is what flips due drafts to live.
    """

    functions = []
    cron_jobs = [cron(release_due_notes, run_at_startup=True)]
    queue_name = "speakez:cron"
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
```

Then in `docker-compose.prod.yml` the `cpu-worker` service runs
`arq worker.main.CronWorkerSettings` instead of `worker.main.WorkerSettings`.

Colab keeps running the full `WorkerSettings` on the default queue and owns all transcription.

**Verify `functions = []` is accepted by the installed arq version.** If it refuses an empty
function list, give it a trivial no-op job instead — the queue isolation is what matters, not the
empty list.

### Keep a deliberate fallback switch

With the split, if Colab dies, notes sit at `processing` forever. That is the *honest* failure and
better than a wrong transcript — but you want a one-command escape hatch for demo day:

```bash
# Colab is dead, judges are queueing: put the demo worker back on the real queue
dc run -d --rm -e ASR_ENGINE=demo worker arq worker.main.WorkerSettings
```

Document that line in `deploy/README.md`. It is the whole rollback.

---

## Problem 3 — Colab's Python environment

Three things will cost an hour if you don't know them.

1. **Do not `pip install torch` in Colab.** `worker/requirements-gpu.txt` lists bare `torch`. Colab
   ships a torch already matched to its CUDA driver; letting pip resolve a different build is the
   classic way to end up with `torch.cuda.is_available() == False`. In Colab install NeMo *without*
   touching torch:

   ```python
   !apt-get -qq install -y ffmpeg
   !pip -q install "nemo_toolkit[asr]" arq httpx
   !pip -q install ./api
   ```

   Leave `requirements-gpu.txt` as-is for the Docker/GPU-box path, where pinning torch is correct.
   Note the divergence in a comment in that file.

2. **`nemo_toolkit[asr]` is a slow, noisy install** (5–10 min, dependency-resolver warnings are
   normal). Budget for it, and **restart the runtime afterwards** if pip reports it upgraded
   anything already imported.

3. **First transcription downloads ~2.5 GB of weights.** Set `HF_HOME=/content/models`
   (`colab_worker.py` already defaults to this) and **pre-warm before judging** — transcribe one
   throwaway note so a judge never waits on the download.

Colab constraints to plan around: free tier gives a T4 (plenty for Parakeet 0.6B), disconnects after
~90 min idle, and caps at ~12 h. Keep the tab open and visible. Every reconnect re-does the install
and the weight download, so **reconnecting is a ~15 minute operation, not instant.**

---

## Execution order

1. Land the `docker-compose.prod.yml` loopback ports (1a) and redeploy. Confirm from the VPS:
   `redis-cli -h 127.0.0.1 ping` and `pg_isready -h 127.0.0.1`.
2. Land `CronWorkerSettings` (Problem 2) and switch the `cpu-worker` command. Confirm
   `dc logs worker` still shows `release_due_notes` firing every minute.
3. Create the restricted SSH key (1b) and test the tunnel **from your laptop first** — same command,
   same key. If it works there it will work in Colab.
4. Build the Colab notebook: secrets → tunnel → installs → env → `%run deploy/colab_worker.py`.
5. Pre-warm the model, then run the end-to-end check below.

## Verification — the only test that counts

Record a note **in the app** saying something specific and unusual ("the seventeenth of November,
raining"), then:

```bash
# on the VPS
dc logs -f api        # POST /notes, POST /notes/{id}/submit
```

```
# in Colab: arq picks up process_note, Parakeet runs
```

Then confirm, in order:

- [ ] `GET /notes/{id}/draft` returns **your actual sentence**, not the demo string
- [ ] The returned `words` carry real start/end timings (not empty, not uniform)
- [ ] The story screen highlights word-by-word in time with the audio
- [ ] Publishing it makes the pin appear on the map within ~60 s (the cron worker is alive)
- [ ] Rehearse the safety path: `DEMO_TRANSCRIPT` is ignored under `parakeet`, so **say** something
      that trips the lexicon and confirm it routes to `/care` and never reaches the map

The last one matters most. The safety gate is the claim the project makes about itself, and it now
runs against real ASR output rather than a fixed string — that is a genuinely different code path.

## Out of scope

Do not, for this: move the database off the VPS, add real auth, persist reactions, wire Journal/Saved
to the API, or build a second GPU fallback. If the tunnel or NeMo fights back for more than an hour,
stop and ship the CPU worker.

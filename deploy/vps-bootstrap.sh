#!/usr/bin/env bash
# Bring a fresh VPS up as the SpeakEz stack.
#
#   curl -fsSL https://get.docker.com | sh        # (or let this script do it)
#   git clone <repo> speakez && cd speakez
#   ./deploy/vps-bootstrap.sh --ip 203.0.113.7 --tls --cpu-worker
#
# It installs Docker if missing, writes .env with fresh secrets, brings up the
# compose stack, seeds the database, and generates the forwarding-only SSH key
# the Colab worker will use. Safe to re-run: it never overwrites an existing .env.
#
# It also makes the box judge-ready end to end: Node 22, swap, npm install, the
# landing page at https://go.<dashed-ip>.sslip.io, and Metro running under
# systemd so Expo Go can load the app from exp://go.<dashed-ip>.sslip.io:8081.
# (EAS Update does not work in Expo Go, so a live Metro server is the only path.)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
IP=""
DOMAIN=""
PROFILES=(cpu-worker)
SEED=1

# Where the landing page (deploy/landing/) is installed on the host. Caddy
# bind-mounts this path read-only; see docker-compose.prod.yml + deploy/Caddyfile.
GO_ROOT="/srv/speakez-go"
METRO_UNIT="/etc/systemd/system/speakez-metro.service"
METRO_PORT=8081

usage() {
  cat <<'EOF'
Usage: deploy/vps-bootstrap.sh [--ip <vps-ip> | --domain <host>] [--tls] [--no-cpu-worker] [--no-seed]

  --ip <vps-ip>        derive API_HOST=api.<dashed-ip>.sslip.io and an HTTPS API_BASE_URL
  --domain <host>      use your own hostname instead of sslip.io
  --tls                start the optional Caddy TLS profile (needs 80/443 open)
  --no-cpu-worker      do not start the cron worker here
  --no-seed            skip seeding landmarks + demo notes
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) IP="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --tls) PROFILES+=("tls"); shift ;;
    --no-cpu-worker) PROFILES=("${PROFILES[@]/cpu-worker/}"); shift ;;
    --no-seed) SEED=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

# shellcheck disable=SC2207
PROFILES=($(printf '%s\n' "${PROFILES[@]}" | grep -v '^$' | sort -u))

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { echo "Warning: $*" >&2; }

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi

if [[ -z "$IP" && -z "$DOMAIN" ]]; then
  warn "no --ip/--domain given; API_HOST stays api.localhost (no public HTTPS)."
fi

# Derive both public hostnames once, up front: the .env block, the landing page,
# the Metro unit and the closing summary all need them.
#   --ip 203.0.113.7 -> api.203-0-113-7.sslip.io and go.203-0-113-7.sslip.io
# sslip.io resolves either name straight back to the IP, so no DNS is needed.
API_HOST=""
GO_HOST=""
if [[ -n "$DOMAIN" ]]; then
  API_HOST="$DOMAIN"
  # With your own hostname, the landing page gets the go.* sibling of it:
  # api.example.com -> go.example.com, example.com -> go.example.com.
  GO_HOST="go.${DOMAIN#api.}"
fi
if [[ -n "$IP" ]]; then
  API_HOST="api.${IP//./-}.sslip.io"
  GO_HOST="go.${IP//./-}.sslip.io"
fi

# Node 22 for Metro. Expo/react-native need >= 20; Debian/Ubuntu ship older.
node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }
if ! command -v node >/dev/null 2>&1 || [[ "$(node_major)" -lt 20 ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    say "Installing Node 22 (nodesource)"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  else
    warn "node >= 20 is missing and this is not an apt box; install Node 22 yourself or Metro will not start."
  fi
else
  say "Reusing Node $(node -v)"
fi

# Metro is memory-hungry (a cold bundle peaks well over 1 GB) and this box also
# runs Postgres, Redis and two Python services. Without swap the first bundle
# build gets OOM-killed on a 2 GB VPS. Idempotent: skipped if any swap is active
# or /swapfile already exists, and /etc/fstab gains at most one line ever.
if [[ -z "$(swapon --show=NAME --noheadings 2>/dev/null)" && ! -e /swapfile ]]; then
  say "Creating a 2 GB swapfile"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile[[:space:]]' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  2 GB swap on, and in /etc/fstab so it survives reboot."
else
  say "Swap already present, leaving it alone"
fi

if [[ ! -f .env ]]; then
  say "Writing .env with fresh secrets"
  cp .env.production.example .env
  db_password="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 32)"
  email_pepper="$(openssl rand -hex 32)"

  # POSTGRES_PASSWORD and the DATABASE_URL embed the same value.
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${db_password}/" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql+asyncpg://speakez:${db_password}@db:5432/speakez|" .env
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/" .env
  sed -i "s/^EMAIL_PEPPER=.*/EMAIL_PEPPER=${email_pepper}/" .env

  if [[ -n "$API_HOST" ]]; then
    sed -i "s/^API_HOST=.*/API_HOST=${API_HOST}/" .env
    sed -i "s|^API_BASE_URL=.*|API_BASE_URL=https://${API_HOST}|" .env
  fi
  echo "  .env written. Keep it off git."
else
  say "Reusing existing .env"
fi

# GO_HOST is not a secret and .env.production.example predates it, so upsert it
# separately: that keeps "never overwrite an existing .env" true while still
# giving the caddy service the landing-page host on a re-run of an older box.
if [[ -n "$GO_HOST" ]]; then
  if grep -q '^GO_HOST=' .env; then
    sed -i "s/^GO_HOST=.*/GO_HOST=${GO_HOST}/" .env
  else
    printf '\n# Landing-page host for the Caddy "tls" profile (deploy/Caddyfile).\nGO_HOST=%s\n' "$GO_HOST" >> .env
  fi
fi

# Install the judge-facing landing page onto the host filesystem. Caddy serves it
# from here over the read-only bind mount declared in docker-compose.prod.yml,
# so this has to happen before the stack comes up.
mkdir -p "$GO_ROOT"
if [[ -d deploy/landing ]]; then
  say "Installing the landing page to ${GO_ROOT}"
  cp -R deploy/landing/. "$GO_ROOT"/
  # The page hard-codes nothing: __GO_HOST__ becomes the real host so the QR
  # code and the exp:// link point at this box.
  if [[ -n "$GO_HOST" ]]; then
    # `|| true`: grep exits 1 when nothing matches, and `set -o pipefail` would
    # turn that into an aborted bootstrap.
    pages="$(grep -rl '__GO_HOST__' "$GO_ROOT" 2>/dev/null || true)"
    if [[ -n "$pages" ]]; then
      printf '%s\n' "$pages" | while read -r page; do
        sed -i "s/__GO_HOST__/${GO_HOST}/g" "$page"
      done
    fi
  else
    warn "no --ip/--domain, so __GO_HOST__ is left unsubstituted in ${GO_ROOT}."
  fi
  chmod -R a+rX "$GO_ROOT"
else
  warn "deploy/landing/ not found; skipping the landing page (${GO_ROOT} stays empty)."
fi

say "Starting the stack (profiles: ${PROFILES[*]:-none})"
profile_args=()
for profile in "${PROFILES[@]}"; do profile_args+=(--profile "$profile"); done
docker compose -f "$COMPOSE_FILE" "${profile_args[@]}" up -d --build

say "Waiting for the API to report healthy"
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T api python -c \
      "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)" \
      >/dev/null 2>&1; then
    echo "  api healthy"
    break
  fi
  sleep 3
done

if [[ "$SEED" -eq 1 ]]; then
  say "Seeding landmarks + demo notes"
  docker compose -f "$COMPOSE_FILE" exec -T api python seed.py
fi

say "Installing JS dependencies for Metro"
if command -v npm >/dev/null 2>&1; then
  npm install --no-audit --no-fund
else
  warn "npm not found; skipping npm install. Metro cannot start without node_modules."
fi

# Metro under systemd is how judges get the app: Expo Go cannot take an EAS
# Update, so it has to pull the JS bundle from a live dev server on this box.
if command -v systemctl >/dev/null 2>&1; then
  say "Installing the Metro systemd unit"
  sed -e "s/__GO_HOST__/${GO_HOST:-localhost}/g" \
      -e "s/__API_HOST__/${API_HOST:-api.localhost}/g" \
      -e "s|^WorkingDirectory=.*|WorkingDirectory=${REPO_DIR}|" \
      deploy/speakez-metro.service > "$METRO_UNIT"
  systemctl daemon-reload
  systemctl enable --now speakez-metro.service
  # On a re-run --now is a no-op for an already-running unit, so restart it
  # explicitly: a changed host or fresh node_modules must actually take effect.
  systemctl restart speakez-metro.service
  echo "  speakez-metro: $(systemctl is-active speakez-metro.service || true) (logs: journalctl -u speakez-metro -f)"
else
  warn "systemctl not found; start Metro yourself: CI=1 REACT_NATIVE_PACKAGER_HOSTNAME=${GO_HOST:-localhost} npx expo start --port ${METRO_PORT}"
fi

# Metro's port has to be reachable from the judges' phones.
if command -v ufw >/dev/null 2>&1 && [[ "$(ufw status 2>/dev/null || true)" == *"Status: active"* ]]; then
  say "Opening port ${METRO_PORT} for Metro"
  ufw allow "${METRO_PORT}/tcp" >/dev/null
fi

say "Generating the forwarding-only SSH key for the Colab worker"
KEY="$HOME/.ssh/speakez-colab"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [[ ! -f "$KEY" ]]; then
  ssh-keygen -t ed25519 -N '' -C colab-worker -f "$KEY" >/dev/null
fi
AUTH_LINE="command=\"/bin/false\",no-agent-forwarding,no-x11-forwarding,no-pty,permitopen=\"127.0.0.1:6379\",permitopen=\"127.0.0.1:5432\" $(cat "$KEY.pub")"

cat <<EOF

────────────────────────────────────────────────────────────────────────
Next steps

1. Restrict the key on this VPS (paste as one line into ~/.ssh/authorized_keys):

   ${AUTH_LINE}

2. Copy the PRIVATE key into Colab Secrets as SPEAKEZ_SSH_KEY:

   cat ${KEY}

3. Test the tunnel from your laptop before trusting Colab:

   ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \\
       -i ${KEY} -L 6379:127.0.0.1:6379 -L 5432:127.0.0.1:5432 root@<VPS_IP>
   redis-cli -h 127.0.0.1 ping && pg_isready -h 127.0.0.1

4. Open deploy/colab.ipynb in a Colab GPU runtime and run it top to bottom.

Delete the authorized_keys line after the demo.
────────────────────────────────────────────────────────────────────────
EOF

api_host_display="${API_HOST:-api.localhost}"
go_host_display="${GO_HOST:-go.localhost}"

cat <<EOF

────────────────────────────────────────────────────────────────────────
This box is judge-ready

  API            https://${api_host_display}/health
  Landing page   https://${go_host_display}
  Expo Go        exp://${go_host_display}:${METRO_PORT}

Hand judges the landing page; its QR code opens the Expo Go URL above.

SCAN IT ONCE YOURSELF NOW. The first request makes Metro build the bundle
from cold, which takes 20-60 s; after that it is cached and a judge's phone
loads in a second or two. An unwarmed server looks broken.

  systemctl status speakez-metro      # is Metro up?
  journalctl -u speakez-metro -f      # why isn't it?

Ports 80/443 (Caddy, needs --tls) and ${METRO_PORT} (Metro) must be open.
────────────────────────────────────────────────────────────────────────
EOF

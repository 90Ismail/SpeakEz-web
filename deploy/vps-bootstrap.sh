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
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
IP=""
DOMAIN=""
PROFILES=(cpu-worker)
SEED=1

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

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi

if [[ -z "$IP" && -z "$DOMAIN" ]]; then
  echo "Warning: no --ip/--domain given; API_HOST stays api.localhost (no public HTTPS)." >&2
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

  host=""
  if [[ -n "$DOMAIN" ]]; then host="$DOMAIN"; fi
  if [[ -n "$IP" ]]; then host="api.${IP//./-}.sslip.io"; fi
  if [[ -n "$host" ]]; then
    sed -i "s/^API_HOST=.*/API_HOST=${host}/" .env
    sed -i "s|^API_BASE_URL=.*|API_BASE_URL=https://${host}|" .env
  fi
  echo "  .env written. Keep it off git."
else
  say "Reusing existing .env"
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

#!/usr/bin/env bash
# SpeakEz end-to-end deploy verification — run this on the VPS after deploying.
#
# It walks the exact path a judge walks: health -> map -> unlock at the demo
# standing position -> play the signed audio -> cron worker -> Expo Go / landing
# page. Every check prints PASS/FAIL/WARN with what broke and what to do next.
#
#   ./deploy/verify.sh --host api.203-0-113-10.sslip.io --go-host go.203-0-113-10.sslip.io
#   API_HOST=... GO_HOST=... ./deploy/verify.sh
#   ./deploy/verify.sh                      # reads API_HOST / GO_HOST from ./.env
#
# Needs only curl, python3 and grep (all present on a fresh Ubuntu 24.04 box).
# Exits non-zero if any check fails.

set -uo pipefail

# ---------------------------------------------------------------- constants ---

# The position src/demo.ts seeds into the app (EXPO_PUBLIC_DEMO_LAT/LNG snapped
# to a landmark): ~23 m from Walter Library, ~103 m from Northrop Mall. Both
# carry seeded live notes, so the unlock below MUST succeed.
DEMO_LAT="44.97552"
DEMO_LNG="-93.23612"

# UMN campus viewport as w,s,e,n (lng,lat,lng,lat) — the format /map wants.
CAMPUS_BBOX="-93.25,44.96,-93.22,44.99"

# api/app/config.py default; .env.production.example ships the same value.
UNLOCK_RADIUS_M="${UNLOCK_RADIUS_M:-150}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_DIR}/docker-compose.prod.yml"
ENV_FILE="${REPO_DIR}/.env"

CURL_OPTS=(-sS --max-time 20)

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
FAILED_CHECKS=""

# ------------------------------------------------------------------- output ---

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; CYAN=""; RESET=""
fi

say()  { printf '%s\n' "$*"; }
info() { printf '%s\n' "${DIM}    $*${RESET}"; }
hint() { printf '%s\n' "${YELLOW}    -> $*${RESET}"; }

ok() {   # ok <check> <detail>
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '%s %s %s\n' "${GREEN}PASS${RESET}" "${BOLD}$1${RESET}" "${2:-}"
}

bad() {  # bad <check> <detail>
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_CHECKS="${FAILED_CHECKS}${FAILED_CHECKS:+, }$1"
  printf '%s %s %s\n' "${RED}FAIL${RESET}" "${BOLD}$1${RESET}" "${2:-}"
}

warn() { # warn <check> <detail>
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '%s %s %s\n' "${YELLOW}WARN${RESET}" "${BOLD}$1${RESET}" "${2:-}"
}

banner() {
  printf '%s\n' "${CYAN}============================================================${RESET}"
  printf '%s\n' "${CYAN}${BOLD}  $*${RESET}"
  printf '%s\n' "${CYAN}============================================================${RESET}"
}

usage() {
  cat <<'USAGE'
Usage: deploy/verify.sh [--host API_HOST] [--go-host GO_HOST] [--insecure]

  --host      Public API host, e.g. api.203-0-113-10.sslip.io
              (falls back to $API_HOST, then API_HOST= in ./.env)
  --go-host   Public Expo/landing host, e.g. go.203-0-113-10.sslip.io
              (falls back to $GO_HOST, then GO_HOST= in ./.env)
  --insecure  Skip TLS certificate verification (only while a cert is pending)
  -h, --help  This message

Exits non-zero if any check fails.
USAGE
}

# --------------------------------------------------------------- arg parsing ---

ARG_API_HOST=""
ARG_GO_HOST=""
INSECURE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --host|--api-host)
      [ $# -ge 2 ] || { say "${RED}--host needs a value${RESET}"; exit 2; }
      ARG_API_HOST="$2"; shift 2 ;;
    --host=*|--api-host=*) ARG_API_HOST="${1#*=}"; shift ;;
    --go-host)
      [ $# -ge 2 ] || { say "${RED}--go-host needs a value${RESET}"; exit 2; }
      ARG_GO_HOST="$2"; shift 2 ;;
    --go-host=*) ARG_GO_HOST="${1#*=}"; shift ;;
    --insecure|-k) INSECURE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) say "${RED}Unknown argument: $1${RESET}"; usage; exit 2 ;;
  esac
done

# Read KEY=value out of .env without sourcing it (that file holds secrets and
# shell-hostile characters).
env_value() {
  [ -f "$ENV_FILE" ] || return 0
  local line
  line="$(grep -E "^[[:space:]]*$1=" "$ENV_FILE" 2>/dev/null | tail -n 1)" || true
  [ -n "$line" ] || return 0
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line" | tr -d '[:space:]'
}

API_HOST_RAW="${ARG_API_HOST:-${API_HOST:-}}"
[ -n "$API_HOST_RAW" ] || API_HOST_RAW="$(env_value API_HOST)"
GO_HOST_RAW="${ARG_GO_HOST:-${GO_HOST:-}}"
[ -n "$GO_HOST_RAW" ] || GO_HOST_RAW="$(env_value GO_HOST)"

if [ -z "$API_HOST_RAW" ]; then
  say "${RED}${BOLD}No API host given.${RESET}"
  hint "pass --host api.<dashed-ip>.sslip.io, or set API_HOST in ${ENV_FILE}"
  say ""
  usage
  exit 2
fi

# Accept "https://host/", "host" or "host:8000"; derive scheme + bare host.
strip_scheme() {
  local value="$1"
  value="${value#http://}"; value="${value#https://}"; value="${value%%/*}"
  printf '%s' "$value"
}

pick_scheme() { # explicit scheme wins, else http for local/ported hosts
  case "$1" in
    https://*) printf 'https'; return ;;
    http://*)  printf 'http';  return ;;
  esac
  case "$(strip_scheme "$1")" in
    localhost|localhost:*|127.*|0.0.0.0*|*.localhost|*.localhost:*|*:[0-9]*) printf 'http' ;;
    *) printf 'https' ;;
  esac
}

API_HOST_BARE="$(strip_scheme "$API_HOST_RAW")"
API_SCHEME="$(pick_scheme "$API_HOST_RAW")"
API_BASE="${API_SCHEME}://${API_HOST_BARE}"

GO_HOST_BARE=""
GO_SCHEME=""
GO_HOST_NOPORT=""
if [ -n "$GO_HOST_RAW" ]; then
  GO_HOST_BARE="$(strip_scheme "$GO_HOST_RAW")"
  GO_SCHEME="$(pick_scheme "$GO_HOST_RAW")"
  # Metro and the exp:// deep link always use :8081, whatever port the page is on.
  GO_HOST_NOPORT="${GO_HOST_BARE%%:*}"
fi

[ "$INSECURE" = "1" ] && CURL_OPTS+=(--insecure)

command -v curl >/dev/null 2>&1 || { say "${RED}curl is not installed.${RESET}"; exit 2; }
command -v python3 >/dev/null 2>&1 || { say "${RED}python3 is not installed.${RESET}"; exit 2; }

WORK_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t speakez-verify)" || {
  say "${RED}Could not create a temp directory.${RESET}"; exit 2; }
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

# ------------------------------------------------- python parsers (no jq) -----
# Each one catches every exception and prints a sentinel line instead, so a
# surprising payload can only ever produce a clear FAIL, never a traceback.

cat >"${WORK_DIR}/parse_health.py" <<'PY'
import json
import sys


def flag(value):
    return "true" if value is True else ("false" if value is False else "unknown")


try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as handle:
        data = json.loads(handle.read())
    if not isinstance(data, dict):
        raise ValueError("not an object")
    # A 503 wraps the same payload in "detail" (api/app/routes/health.py).
    if isinstance(data.get("detail"), dict):
        data = data["detail"]
    raw_status = str(data.get("status", "missing"))[:32]
    status = "".join(ch if (ch.isalnum() or ch in "-_") else "_" for ch in raw_status)
    print("%s %s %s" % (status or "missing", flag(data.get("db")), flag(data.get("redis"))))
except Exception:
    print("parse_error unknown unknown")
PY

cat >"${WORK_DIR}/parse_map.py" <<'PY'
import json
import math
import sys


def sanitize(text, limit=48):
    chars = [ch if (ch.isalnum() or ch in " -_.") else " " for ch in str(text)[:limit]]
    return "".join(chars).strip() or "?"


def bail(reason, count=0):
    print("%s|%d||||" % (reason, count))
    raise SystemExit(0)


def meters(lat1, lng1, lat2, lng2):
    radius = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(a)))


try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as handle:
        data = json.loads(handle.read())
    lat0 = float(sys.argv[2])
    lng0 = float(sys.argv[3])
except Exception:
    bail("parse_error")

if not isinstance(data, dict) or not isinstance(data.get("notes"), list):
    bail("parse_error")

notes = data["notes"]
best = None
for note in notes:
    if not isinstance(note, dict):
        continue
    note_id = note.get("id")
    landmark = note.get("landmark")
    if not isinstance(note_id, str) or not note_id or not isinstance(landmark, dict):
        continue
    try:
        distance = meters(lat0, lng0, float(landmark["lat"]), float(landmark["lng"]))
    except Exception:
        continue
    # Nearest note to the demo standing position: the one a judge actually opens.
    if best is None or distance < best[1]:
        best = (note_id, distance, landmark.get("name", "?"), note.get("title"))

if best is None:
    bail("no_usable_note", len(notes))

note_id, distance, landmark_name, title = best
safe_id = "".join(ch for ch in note_id if ch.isalnum() or ch == "-")[:36]
if not safe_id:
    bail("no_usable_note", len(notes))

print(
    "ok|%d|%s|%d|%s|%s"
    % (
        len(notes),
        safe_id,
        int(round(distance)),
        sanitize(landmark_name),
        sanitize(title if title else "(untitled)"),
    )
)
PY

cat >"${WORK_DIR}/parse_unlock.py" <<'PY'
import json
import sys


def bail(reason):
    print("%s|-1|-1|0|" % reason)
    raise SystemExit(0)


try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as handle:
        data = json.loads(handle.read())
except Exception:
    bail("parse_error")

if not isinstance(data, dict):
    bail("parse_error")

body = data.get("body")
body_len = len(body.strip()) if isinstance(body, str) else -1

words = data.get("words")
word_count = len(words) if isinstance(words, list) else -1

replies = data.get("replies")
reply_count = len(replies) if isinstance(replies, list) else 0

audio = data.get("audio_url")
if not isinstance(audio, str):
    audio = ""
# Keep it printable and pipe-free; the shell splits this line on "|".
audio = "".join(ch for ch in audio if 32 < ord(ch) < 127 and ch != "|")[:600]

print("ok|%d|%d|%d|%s" % (body_len, word_count, reply_count, audio))
PY

cat >"${WORK_DIR}/error_detail.py" <<'PY'
import json
import re
import sys


def clean(text):
    text = re.sub(r"\s+", " ", str(text)).strip()
    return text[:200] if text else "(empty)"


try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as handle:
        raw = handle.read()
except Exception:
    print("(no response body)")
    raise SystemExit(0)

try:
    parsed = json.loads(raw)
except Exception:
    print(clean(raw) if raw.strip() else "(empty response body)")
    raise SystemExit(0)

detail = parsed.get("detail", parsed) if isinstance(parsed, dict) else parsed
if isinstance(detail, dict):
    message = detail.get("message") or detail.get("detail") or json.dumps(detail)
    print(clean(message))
elif isinstance(detail, list):
    print(clean(json.dumps(detail)))
else:
    print(clean(detail))
PY

# ------------------------------------------------------------------ helpers ---

# http_get <url> <out-file> — echoes the status code ("000" if nothing answered).
http_get() {
  local url="$1" out="$2" code
  code="$(curl "${CURL_OPTS[@]}" -o "$out" -w '%{http_code}' "$url" 2>"${out}.err")" || true
  [ -n "$code" ] || code="000"
  printf '%s' "$code"
}

# http_post_json <url> <json> <out-file>
http_post_json() {
  local url="$1" payload="$2" out="$3" code
  code="$(curl "${CURL_OPTS[@]}" -X POST -H 'Content-Type: application/json' \
    --data "$payload" -o "$out" -w '%{http_code}' "$url" 2>"${out}.err")" || true
  [ -n "$code" ] || code="000"
  printf '%s' "$code"
}

curl_error() { # first line of curl's stderr for <out-file>
  local err="${1}.err"
  if [ -s "$err" ]; then head -n 1 "$err" | tr -d '\r'; fi
}

api_error_detail() { # best-effort human message from a FastAPI error body
  local out
  out="$(python3 "${WORK_DIR}/error_detail.py" "$1" 2>/dev/null)" || out=""
  printf '%s' "${out:-(unreadable response body)}"
}

# --------------------------------------------------------------------- start ---

say ""
say "${BOLD}SpeakEz deploy verification${RESET}  ${DIM}$(date '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || true)${RESET}"
say "${DIM}  API      ${API_BASE}${RESET}"
if [ -n "$GO_HOST_BARE" ]; then
  say "${DIM}  Expo/Go  ${GO_SCHEME}://${GO_HOST_BARE}   (metro on :8081)${RESET}"
else
  say "${DIM}  Expo/Go  not checked (pass --go-host or set GO_HOST)${RESET}"
fi
say "${DIM}  Position ${DEMO_LAT}, ${DEMO_LNG}  (the demo standing position from src/demo.ts)${RESET}"
say ""

# --------------------------------------------------------- 1. health ---------

HEALTH_OK=0
HEALTH_BODY="${WORK_DIR}/health.json"
HEALTH_CODE="000"

for attempt in 1 2 3 4 5; do
  HEALTH_CODE="$(http_get "${API_BASE}/health" "$HEALTH_BODY")"
  case "$HEALTH_CODE" in
    200|503) break ;;
  esac
  [ "$attempt" -lt 5 ] || break
  info "health returned ${HEALTH_CODE}; retrying (${attempt}/5) — the stack may still be warming up"
  sleep 3
done

if [ "$HEALTH_CODE" = "000" ]; then
  bad "1 health" "nothing answered ${API_BASE}/health"
  CURL_MSG="$(curl_error "$HEALTH_BODY")"
  [ -n "$CURL_MSG" ] && info "curl: ${CURL_MSG}"
  if [ "$INSECURE" != "1" ] && [ "$API_SCHEME" = "https" ]; then
    INSECURE_CODE="$(curl -sS --max-time 15 --insecure -o /dev/null -w '%{http_code}' "${API_BASE}/health" 2>/dev/null)" || INSECURE_CODE="000"
    [ -n "$INSECURE_CODE" ] || INSECURE_CODE="000"
    if [ "$INSECURE_CODE" != "000" ]; then
      hint "the host IS answering but its TLS certificate is not valid yet (Let's Encrypt still issuing, or the wrong API_HOST)"
      hint "wait ~60s, read 'docker compose -f docker-compose.prod.yml --profile tls logs caddy', or re-run with --insecure"
    else
      hint "check, in order: the sslip.io name resolves to this VPS; 'docker compose -f docker-compose.prod.yml ps' shows api healthy; Caddy is up (--profile tls); ports 80/443 are open"
    fi
  else
    hint "check 'docker compose -f docker-compose.prod.yml ps' and that the api container is listening on ${API_BASE}"
  fi
else
  HEALTH_LINE="$(python3 "${WORK_DIR}/parse_health.py" "$HEALTH_BODY" 2>/dev/null)" || HEALTH_LINE=""
  [ -n "$HEALTH_LINE" ] || HEALTH_LINE="parse_error unknown unknown"
  read -r H_STATUS H_DB H_REDIS <<<"$HEALTH_LINE"
  H_STATUS="${H_STATUS:-parse_error}"; H_DB="${H_DB:-unknown}"; H_REDIS="${H_REDIS:-unknown}"

  if [ "$HEALTH_CODE" = "200" ] && [ "$H_STATUS" = "ok" ] && [ "$H_DB" = "true" ] && [ "$H_REDIS" = "true" ]; then
    ok "1 health" "200 {\"status\":\"ok\",\"db\":true,\"redis\":true}"
    HEALTH_OK=1
  elif [ "$H_STATUS" = "parse_error" ]; then
    bad "1 health" "HTTP ${HEALTH_CODE}, but the body is not the expected health JSON"
    info "body: $(api_error_detail "$HEALTH_BODY")"
    hint "something other than the SpeakEz API is answering ${API_BASE}/health (wrong host, or Caddy proxying elsewhere)"
  else
    bad "1 health" "HTTP ${HEALTH_CODE} status=${H_STATUS} db=${H_DB} redis=${H_REDIS}"
    if [ "$H_DB" != "true" ]; then
      hint "POSTGRES is the problem: 'docker compose -f docker-compose.prod.yml logs db', check DATABASE_URL in .env, and that 'alembic upgrade head' ran on api start"
    fi
    if [ "$H_REDIS" != "true" ]; then
      hint "REDIS is the problem: 'docker compose -f docker-compose.prod.yml logs redis', check REDIS_URL in .env"
    fi
    if [ "$H_DB" = "true" ] && [ "$H_REDIS" = "true" ]; then
      hint "both dependencies report healthy but status is '${H_STATUS}' — read 'docker compose -f docker-compose.prod.yml logs api'"
    fi
  fi
fi

# --------------------------------------------------------- 2. map -----------

MAP_OK=0
MAP_CODE=""
MAP_COUNT="0"
NOTE_ID=""
NOTE_DIST=""
NOTE_LANDMARK=""
NOTE_TITLE=""
MAP_BODY="${WORK_DIR}/map.json"

if [ "$HEALTH_OK" != "1" ]; then
  warn "2 map" "skipped — /health is not healthy, fix check 1 first"
else
  MAP_CODE="$(http_get "${API_BASE}/map?bbox=${CAMPUS_BBOX}" "$MAP_BODY")"
  if [ "$MAP_CODE" != "200" ]; then
    bad "2 map" "GET /map?bbox=${CAMPUS_BBOX} returned HTTP ${MAP_CODE}"
    info "detail: $(api_error_detail "$MAP_BODY")"
    if [ "$MAP_CODE" = "422" ]; then
      hint "the bbox was rejected — it must be w,s,e,n (lng,lat,lng,lat) with w<e and s<n"
    else
      hint "read: docker compose -f docker-compose.prod.yml logs --tail 50 api"
    fi
  else
    MAP_LINE="$(python3 "${WORK_DIR}/parse_map.py" "$MAP_BODY" "$DEMO_LAT" "$DEMO_LNG" 2>/dev/null)" || MAP_LINE=""
    [ -n "$MAP_LINE" ] || MAP_LINE="parse_error|0||||"
    IFS='|' read -r MAP_STATE MAP_COUNT NOTE_ID NOTE_DIST NOTE_LANDMARK NOTE_TITLE <<<"$MAP_LINE"
    MAP_STATE="${MAP_STATE:-parse_error}"; MAP_COUNT="${MAP_COUNT:-0}"

    case "$MAP_STATE" in
      ok)
        ok "2 map" "${MAP_COUNT} note(s) in the campus bbox; nearest sits ${NOTE_DIST} m from the demo position at ${NOTE_LANDMARK}"
        info "will try to unlock: \"${NOTE_TITLE}\" (${NOTE_ID})"
        MAP_OK=1
        if [ "${NOTE_DIST:-999999}" -gt "${UNLOCK_RADIUS_M}" ] 2>/dev/null; then
          warn "2 map" "the nearest note is ${NOTE_DIST} m away, outside UNLOCK_RADIUS_M=${UNLOCK_RADIUS_M} — check 3 will fail"
          hint "the seeded landmark coordinates look wrong: api/seed.py puts walter-library ~23 m from the demo position"
        fi
        ;;
      no_usable_note)
        if [ "${MAP_COUNT}" = "0" ]; then
          bad "2 map" "the map is EMPTY — /map returned zero notes for the campus bbox"
          hint "the likely cause: seed.py was never run on this box."
          hint "run: docker compose -f docker-compose.prod.yml exec api python seed.py"
          hint "then re-run this script. (Other possibility: the notes exist but are still scheduled — see check 5, the release cron.)"
        else
          bad "2 map" "/map returned ${MAP_COUNT} note(s) but none had a usable id + landmark"
          hint "the rows are malformed or landmarks are missing — re-seed: docker compose -f docker-compose.prod.yml exec api python seed.py"
        fi
        ;;
      parse_error)
        bad "2 map" "could not read the /map response as {\"notes\": [...]}"
        info "body: $(api_error_detail "$MAP_BODY")"
        hint "something other than the SpeakEz API may be answering, or the response was truncated"
        ;;
      *)
        bad "2 map" "unexpected /map response"
        info "body: $(api_error_detail "$MAP_BODY")"
        ;;
    esac
  fi
fi

# --------------------------------------------------------- 3. unlock --------

UNLOCK_OK=0
AUDIO_URL=""
UNLOCK_BODY="${WORK_DIR}/unlock.json"
UNLOCK_PAYLOAD="{\"lat\": ${DEMO_LAT}, \"lng\": ${DEMO_LNG}}"

say ""
banner "CHECK 3 — THE JUDGE PATH: unlock a note from the demo standing position"

if [ "$MAP_OK" != "1" ] || [ -z "$NOTE_ID" ]; then
  warn "3 unlock" "skipped — no note id came back from /map, so there is nothing to unlock"
  say "${RED}${BOLD}  ==> THE JUDGE DEMO CANNOT BE VERIFIED: fix check 2 and run this again.${RESET}"
else
  UNLOCK_CODE="$(http_post_json "${API_BASE}/notes/${NOTE_ID}/unlock" "$UNLOCK_PAYLOAD" "$UNLOCK_BODY")"
  if [ "$UNLOCK_CODE" = "200" ]; then
    UNLOCK_LINE="$(python3 "${WORK_DIR}/parse_unlock.py" "$UNLOCK_BODY" 2>/dev/null)" || UNLOCK_LINE=""
    [ -n "$UNLOCK_LINE" ] || UNLOCK_LINE="parse_error|-1|-1|0|"
    IFS='|' read -r U_STATE U_BODY_LEN U_WORDS U_REPLIES AUDIO_URL <<<"$UNLOCK_LINE"
    U_STATE="${U_STATE:-parse_error}"; U_BODY_LEN="${U_BODY_LEN:--1}"
    U_WORDS="${U_WORDS:--1}"; U_REPLIES="${U_REPLIES:-0}"

    PROBLEMS=""
    [ "$U_STATE" = "ok" ] || PROBLEMS="${PROBLEMS} unreadable-response"
    [ "${U_BODY_LEN}" -gt 0 ] 2>/dev/null || PROBLEMS="${PROBLEMS} empty-body"
    [ "${U_WORDS}" -gt 0 ] 2>/dev/null || PROBLEMS="${PROBLEMS} empty-words"
    [ -n "$AUDIO_URL" ] || PROBLEMS="${PROBLEMS} null-audio_url"

    if [ -z "$PROBLEMS" ]; then
      ok "3 unlock" "200 — ${U_BODY_LEN} chars of body, ${U_WORDS} word timings, ${U_REPLIES} repl(ies), audio_url present"
      say "${GREEN}${BOLD}  ==> A judge standing at the demo position CAN open this note.${RESET}"
      UNLOCK_OK=1
    else
      bad "3 unlock" "200 but the payload is incomplete:${PROBLEMS}"
      say "${RED}${BOLD}  ==> THE JUDGE DEMO WILL NOT WORK: the note opens with nothing to read or play.${RESET}"
      case "$PROBLEMS" in
        *empty-body*|*empty-words*)
          hint "this note has no transcript. Seeded notes carry their own transcript and word timings, so re-seed:"
          hint "  docker compose -f docker-compose.prod.yml exec api python seed.py"
          hint "for notes recorded on the day, the ASR worker must also be running (see check 5)" ;;
      esac
      case "$PROBLEMS" in
        *null-audio_url*)
          hint "the note row has no audio_key: api/seed_audio/*.mp3 was missing when seed.py ran"
          hint "get the seed audio into the image/volume, then re-seed" ;;
      esac
      [ "$U_STATE" = "parse_error" ] && hint "the response was not the expected JSON object — read the api logs"
    fi
  else
    bad "3 unlock" "POST /notes/${NOTE_ID}/unlock returned HTTP ${UNLOCK_CODE}"
    info "sent ${UNLOCK_PAYLOAD} for a note ${NOTE_DIST:-?} m away at ${NOTE_LANDMARK:-?}"
    info "detail: $(api_error_detail "$UNLOCK_BODY")"
    say "${RED}${BOLD}  ==> THE JUDGE DEMO WILL NOT WORK. This is the check that matters most: it is literally what a judge does.${RESET}"
    case "$UNLOCK_CODE" in
      403)
        say "${RED}${BOLD}  ==> The server called the demo standing position TOO FAR from the note.${RESET}"
        hint "that position is ~23 m from Walter Library and ~103 m from Northrop Mall, so a correct server accepts it"
        hint "1) UNLOCK_RADIUS_M in .env must be 150 — a smaller value breaks the demo"
        hint "2) the seeded landmark coordinates must match api/seed.py (walter-library = 44.97536, -93.2363)"
        hint "3) if the detail mentions your last unlock, DEMO_MODE=false is enforcing impossible-travel — set DEMO_MODE=true"
        hint "after editing .env: docker compose -f docker-compose.prod.yml up -d api, then re-run this script" ;;
      401)
        hint "DEMO_MODE is not on: the placeholder demo account only works with DEMO_MODE=true in .env"
        hint "fix .env, then docker compose -f docker-compose.prod.yml up -d api" ;;
      404)
        hint "the note is not unlockable: it is not 'live' yet (check 5 — the release cron flips scheduled notes live) or it is a journal entry"
        hint "a stale Redis note cache also does this: docker compose -f docker-compose.prod.yml restart redis api" ;;
      429)
        hint "rate-limited (20 unlocks/hour/account). That only applies with DEMO_MODE=false — set DEMO_MODE=true in .env" ;;
      422)
        hint "the request body was rejected; the route expects exactly {\"lat\": <float>, \"lng\": <float>}" ;;
      000)
        hint "no response at all — the api probably died mid-request: docker compose -f docker-compose.prod.yml logs --tail 50 api" ;;
      *)
        hint "read: docker compose -f docker-compose.prod.yml logs --tail 50 api" ;;
    esac
  fi
fi
say ""

# --------------------------------------------------------- 4. audio ---------

if [ "$UNLOCK_OK" != "1" ] || [ -z "$AUDIO_URL" ]; then
  warn "4 audio" "skipped — the unlock gave no audio_url, fix check 3 first"
else
  # Same resolution the app does (absoluteMediaUrl in src/api.ts): a relative
  # path hangs off the API base, an absolute URL (R2 presign) is used as-is.
  case "$AUDIO_URL" in
    http://*|https://*) AUDIO_FULL="$AUDIO_URL" ;;
    /*)                 AUDIO_FULL="${API_BASE}${AUDIO_URL}" ;;
    *)                  AUDIO_FULL="${API_BASE}/${AUDIO_URL}" ;;
  esac

  AUDIO_FILE="${WORK_DIR}/audio.bin"
  AUDIO_META="$(curl "${CURL_OPTS[@]}" -o "$AUDIO_FILE" \
    -w '%{http_code} %{content_type} %{size_download}' "$AUDIO_FULL" 2>"${AUDIO_FILE}.err")" || AUDIO_META=""
  [ -n "$AUDIO_META" ] || AUDIO_META="000 - 0"
  read -r A_CODE A_TYPE A_SIZE <<<"$AUDIO_META"
  A_CODE="${A_CODE:-000}"; A_TYPE="${A_TYPE:--}"; A_SIZE="${A_SIZE:-0}"
  AUDIO_SHOWN="${AUDIO_FULL%%\?*}"

  if [ "$A_CODE" != "200" ]; then
    bad "4 audio" "GET ${AUDIO_SHOWN} returned HTTP ${A_CODE}"
    if [ "$A_CODE" = "000" ]; then
      CURL_MSG="$(curl_error "$AUDIO_FILE")"
      [ -n "$CURL_MSG" ] && info "curl: ${CURL_MSG}"
      hint "the media host did not answer — make sure Caddy passes /media straight through to the api"
    else
      info "detail: $(api_error_detail "$AUDIO_FILE")"
    fi
    if [ "$A_CODE" = "404" ]; then
      hint "a 404 here is one of three things:"
      hint "1) the signature did not verify: JWT_SECRET differs between the process that signed the URL and the one serving /media (e.g. the api was restarted with a new .env)"
      hint "2) the signed URL expired — the TTL is 60 s, so a clock skew on the VPS breaks it: check 'timedatectl'"
      hint "3) the media volume has no such file — re-seed: docker compose -f docker-compose.prod.yml exec api python seed.py"
    fi
  elif ! printf '%s' "$A_TYPE" | grep -qi '^audio/'; then
    bad "4 audio" "200 but the content-type is '${A_TYPE}', not audio/*"
    hint "something is intercepting /media (an error page or the landing page) instead of serving the file"
  elif ! [ "${A_SIZE}" -gt 1024 ] 2>/dev/null; then
    bad "4 audio" "200 ${A_TYPE} but only ${A_SIZE} bytes — that is not a playable recording"
    hint "the file in the media volume is truncated or a placeholder; check the volume and re-seed"
  else
    ok "4 audio" "200 ${A_TYPE} ${A_SIZE} bytes — signed URL verified, media volume has the file"
  fi
fi

# --------------------------------------------------------- 5. cron worker ---

CRON_CONSEQUENCE="published notes never reach the map: publishing only schedules publish_at, and the every-minute release_due_notes cron is what flips them live"

if ! command -v docker >/dev/null 2>&1; then
  warn "5 cron worker" "docker is not on this machine, so the worker cannot be checked from here"
  hint "on the VPS run: docker compose -f docker-compose.prod.yml --profile cpu-worker ps"
elif ! docker info >/dev/null 2>&1; then
  warn "5 cron worker" "docker is installed but unreachable (daemon down, or this user is not in the docker group)"
  hint "try: sudo docker compose -f docker-compose.prod.yml --profile cpu-worker ps"
elif [ ! -f "$COMPOSE_FILE" ]; then
  warn "5 cron worker" "no docker-compose.prod.yml at ${COMPOSE_FILE}"
  hint "run this from the deployed checkout, or check by hand: docker ps | grep CronWorkerSettings"
else
  PS_OUT="${WORK_DIR}/worker-ps.txt"
  docker compose -f "$COMPOSE_FILE" --profile cpu-worker ps >"$PS_OUT" 2>&1
  PS_RC=$?

  WORKER_UP=0
  if grep -qi 'worker' "$PS_OUT" 2>/dev/null && grep -Eqi '(^|[[:space:]])(Up|running)' "$PS_OUT" 2>/dev/null; then
    WORKER_UP=1
  fi
  # Belt and braces: the cron worker may have been started outside this compose
  # project. --no-trunc because docker ps truncates .Command by default.
  DOCKER_PS="${WORK_DIR}/docker-ps.txt"
  docker ps --no-trunc --format '{{.Names}} {{.Command}} {{.Status}}' >"$DOCKER_PS" 2>&1 || true
  if grep -q 'CronWorkerSettings' "$DOCKER_PS" 2>/dev/null; then
    WORKER_UP=1
  fi

  if [ "$WORKER_UP" != "1" ] && [ "$PS_RC" != "0" ]; then
    warn "5 cron worker" "'docker compose ... ps' failed, so the worker could not be checked from here"
    info "$(head -n 2 "$PS_OUT" 2>/dev/null | tr -d '\r' | tr '\n' ' ')"
    hint "check by hand: docker ps --no-trunc | grep CronWorkerSettings"
    hint "if it is not running, ${CRON_CONSEQUENCE}"
  elif [ "$WORKER_UP" != "1" ]; then
    bad "5 cron worker" "no container running 'arq worker.main.CronWorkerSettings' is up"
    WORKER_LINE="$(grep -i 'worker' "$PS_OUT" 2>/dev/null | head -n 2 | tr -d '\r' | tr '\n' ' ')" || WORKER_LINE=""
    [ -n "$WORKER_LINE" ] && info "compose ps: ${WORKER_LINE}"
    hint "without it, ${CRON_CONSEQUENCE}"
    hint "start it: docker compose -f docker-compose.prod.yml --profile cpu-worker up -d worker"
  else
    LOG_OUT="${WORK_DIR}/worker-logs.txt"
    docker compose -f "$COMPOSE_FILE" --profile cpu-worker logs --tail 200 worker >"$LOG_OUT" 2>&1 || true
    if [ ! -s "$LOG_OUT" ]; then
      CRON_CONTAINER="$(grep 'CronWorkerSettings' "$DOCKER_PS" 2>/dev/null | head -n 1 | cut -d' ' -f1)" || CRON_CONTAINER=""
      if [ -n "$CRON_CONTAINER" ]; then
        docker logs --tail 200 "$CRON_CONTAINER" >"$LOG_OUT" 2>&1 || true
      fi
    fi
    if grep -q 'release_due_notes' "$LOG_OUT" 2>/dev/null; then
      ok "5 cron worker" "worker is up and 'release_due_notes' appears in its recent logs"
    else
      warn "5 cron worker" "the worker container is up, but 'release_due_notes' is not in the last 200 log lines"
      hint "the cron runs at startup and every minute, so it should show up — watch it: docker compose -f docker-compose.prod.yml logs -f worker"
      hint "if it truly never runs, ${CRON_CONSEQUENCE}"
    fi
  fi
fi

# --------------------------------------------------------- 6. metro/landing --

if [ -z "$GO_HOST_BARE" ]; then
  info "6 metro/landing: skipped (no --go-host / GO_HOST) — that host serves the QR judges scan."
else
  METRO_BODY="${WORK_DIR}/metro.txt"
  METRO_URL="http://${GO_HOST_NOPORT}:8081/status"
  METRO_CODE="$(http_get "$METRO_URL" "$METRO_BODY")"
  if [ "$METRO_CODE" = "200" ] && grep -q 'packager-status:running' "$METRO_BODY" 2>/dev/null; then
    ok "6 metro" "${METRO_URL} -> packager-status:running"
  elif [ "$METRO_CODE" = "200" ]; then
    bad "6 metro" "${METRO_URL} answered 200 but not 'packager-status:running'"
    info "body: $(head -c 120 "$METRO_BODY" 2>/dev/null | tr -d '\r\n' || true)"
    hint "something other than Expo Metro is on :8081 — check: systemctl status speakez-metro"
  else
    bad "6 metro" "${METRO_URL} returned HTTP ${METRO_CODE} — Expo Metro is not serving the bundle"
    hint "judges scanning the QR get nothing. Restart it: sudo systemctl restart speakez-metro"
    hint "then: systemctl status speakez-metro; journalctl -u speakez-metro -n 50"
    hint "port 8081 must also be open to the internet (ufw allow 8081/tcp)"
  fi

  LANDING_BODY="${WORK_DIR}/landing.html"
  LANDING_URL="${GO_SCHEME}://${GO_HOST_BARE}/"
  LANDING_CODE="$(http_get "$LANDING_URL" "$LANDING_BODY")"
  if [ "$LANDING_CODE" = "200" ]; then
    LANDING_BYTES="$(wc -c <"$LANDING_BODY" 2>/dev/null | tr -d ' ')" || LANDING_BYTES="?"
    ok "6 landing" "${LANDING_URL} -> 200 (${LANDING_BYTES:-?} bytes)"
    if grep -q '__GO_HOST__' "$LANDING_BODY" 2>/dev/null; then
      warn "6 landing" "the served page still contains the literal __GO_HOST__ placeholder"
      hint "the QR and the exp:// button will not work — re-run deploy/vps-bootstrap.sh so it substitutes GO_HOST into /srv/speakez-go/index.html"
    fi
  else
    bad "6 landing" "${LANDING_URL} returned HTTP ${LANDING_CODE} — judges have no page to scan"
    hint "check GO_HOST is set in .env and the Caddy 'tls' profile is up:"
    hint "  grep GO_HOST .env; docker compose -f docker-compose.prod.yml --profile tls up -d caddy"
    hint "  and that /srv/speakez-go/index.html exists on the host (deploy/vps-bootstrap.sh installs it)"
  fi
fi

# ------------------------------------------------------------- summary -------

say ""
say "${BOLD}------------------------------- summary -------------------------------${RESET}"
printf '  %s %d   %s %d   %s %d\n' \
  "${GREEN}passed${RESET}" "$PASS_COUNT" "${RED}failed${RESET}" "$FAIL_COUNT" "${YELLOW}warnings${RESET}" "$WARN_COUNT"
[ -n "$FAILED_CHECKS" ] && say "  ${RED}failed: ${FAILED_CHECKS}${RESET}"
say ""
say "  API            ${API_BASE}"
if [ -n "$GO_HOST_BARE" ]; then
  say "  Landing page   ${GO_SCHEME}://${GO_HOST_BARE}/   ${DIM}(the page with the QR code)${RESET}"
  say "  ${BOLD}Judge URL      exp://${GO_HOST_NOPORT}:8081${RESET}   ${DIM}(what the QR opens in Expo Go)${RESET}"
else
  say "  ${DIM}Judge URL      unknown — re-run with --go-host to print exp://<GO_HOST>:8081${RESET}"
fi
say ""

if [ "$FAIL_COUNT" -eq 0 ] && [ "$UNLOCK_OK" = "1" ]; then
  if [ -n "$GO_HOST_BARE" ]; then
    say "${GREEN}${BOLD}  DEMO IS READY — map, unlock and audio verified end to end, and the QR path answers.${RESET}"
  else
    say "${GREEN}${BOLD}  DEMO IS READY (API side) — map, unlock and audio verified end to end.${RESET}"
    say "${YELLOW}  Metro and the landing page were NOT checked: re-run with --go-host to confirm the QR path.${RESET}"
  fi
  [ "$WARN_COUNT" -gt 0 ] && say "${YELLOW}  ${WARN_COUNT} warning(s) above — read them, but none is fatal on its own.${RESET}"
  say ""
  exit 0
fi

if [ "$UNLOCK_OK" != "1" ]; then
  say "${RED}${BOLD}  DEMO IS NOT READY — check 3 (unlock) did not pass, and that is exactly what a judge does.${RESET}"
  say "${RED}  Fix check 3 first; everything a judge sees depends on it.${RESET}"
else
  say "${RED}${BOLD}  DEMO IS NOT READY — ${FAIL_COUNT} check(s) failed (${FAILED_CHECKS}).${RESET}"
  say "${RED}  The unlock itself works, so the core demo is alive — clear the failures above before judging.${RESET}"
fi
say ""
exit 1

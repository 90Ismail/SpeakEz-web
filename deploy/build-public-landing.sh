#!/usr/bin/env bash
# Build a host-substituted copy of deploy/landing/ for publishing to a static host.
#
# deploy/landing/index.html is the single source of truth. It keeps the literal
# placeholder __GO_HOST__ because the VPS bootstrap (deploy/vps-bootstrap.sh) seds
# it at install time. This script produces the same substitution locally so the
# page can also be mirrored on a static host with a nicer public URL.
#
# The mirror is only a launcher. The exp:// deep link and the Expo Go JS bundle
# still come from Metro on the VPS, so a mirrored page does NOT make the demo
# independent of that box.
#
# Usage:
#   deploy/build-public-landing.sh [--go-host HOST] [--out DIR]
set -euo pipefail

GO_HOST="go.165-22-180-184.sslip.io"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/landing"
OUT_DIR="$SCRIPT_DIR/.public-landing"

while [ $# -gt 0 ]; do
  case "$1" in
    --go-host)
      [ $# -ge 2 ] || { echo "error: --go-host needs a value" >&2; exit 2; }
      GO_HOST="$2"; shift 2 ;;
    --go-host=*)
      GO_HOST="${1#*=}"; shift ;;
    --out)
      [ $# -ge 2 ] || { echo "error: --out needs a value" >&2; exit 2; }
      OUT_DIR="$2"; shift 2 ;;
    --out=*)
      OUT_DIR="${1#*=}"; shift ;;
    -h|--help)
      sed -n '2,15p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)
      echo "error: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$GO_HOST" ] || { echo "error: --go-host must not be empty" >&2; exit 2; }
[ -d "$SRC_DIR" ] || { echo "error: source dir not found: $SRC_DIR" >&2; exit 1; }
[ -f "$SRC_DIR/index.html" ] || { echo "error: missing $SRC_DIR/index.html" >&2; exit 1; }

# The page must not depend on a CDN for its QR renderer.
[ -f "$SRC_DIR/qrcode.min.js" ] || {
  echo "error: missing vendored $SRC_DIR/qrcode.min.js" >&2; exit 1; }

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
# Copy contents (not the directory itself) so OUT_DIR is the web root.
cp -R "$SRC_DIR"/. "$OUT_DIR"/

# Substitute the placeholder in every text file that carries it.
substituted=0
while IFS= read -r f; do
  tmp="$f.tmp.$$"
  sed "s|__GO_HOST__|$GO_HOST|g" "$f" > "$tmp"
  mv "$tmp" "$f"
  substituted=$((substituted + 1))
done < <(grep -rl '__GO_HOST__' "$OUT_DIR" 2>/dev/null || true)

# Verify no placeholder survived anywhere in the build.
if grep -rn '__GO_HOST__' "$OUT_DIR" >/dev/null 2>&1; then
  echo "error: __GO_HOST__ still present in build output:" >&2
  grep -rn '__GO_HOST__' "$OUT_DIR" >&2
  exit 1
fi

# Verify the deep link the judge button needs is actually present.
expected="exp://$GO_HOST:8081"
if ! grep -qF "$expected" "$OUT_DIR/index.html"; then
  echo "error: expected deep link not found in build: $expected" >&2
  exit 1
fi

echo "built:      $OUT_DIR"
echo "go host:    $GO_HOST"
echo "deep link:  $expected"
echo "files:      $(cd "$OUT_DIR" && ls -1 | tr '\n' ' ')"
echo "patched:    $substituted file(s)"

#!/bin/bash
# Build the speakEz web app into dist/ (run from the repo root after `npm i --no-save react-native-web react-dom@19.2.3 maplibre-gl@4.7.1`).
set -e
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://api.165-22-180-184.sslip.io}" EXPO_PUBLIC_DEMO_LAT=44.97510 EXPO_PUBLIC_DEMO_LNG=-93.23580 EXPO_OFFLINE=1 CI=1
# Web-only patches are applied for the build and reverted after, so the shared app source is never changed.
# Web-only fixes, each explained in its header: light theme, 3-minute cap, record button presses, map refresh.
PATCHES=(web-patches/light-theme.patch web-patches/web-record-cap.patch web-patches/web-record-press.patch web-patches/web-map-refresh.patch)
git apply "${PATCHES[@]}"
trap 'git apply -R "${PATCHES[@]}"' EXIT
rm -rf dist
npx expo export -p web -c
python3 - <<'PY'
import glob, os, re
d = "dist"
# Vercel drops any folder named node_modules, so rename the asset folder and the references to it.
if os.path.isdir(d + "/assets/node_modules"): os.rename(d + "/assets/node_modules", d + "/assets/nm")
for f in glob.glob(d + "/_expo/static/js/web/*.js") + glob.glob(d + "/_expo/static/css/*.css"):
    s = open(f, encoding="utf-8").read()
    t = s.replace("assets/node_modules", "assets/nm")
    if t != s: open(f, "w", encoding="utf-8").write(t)
# Page shell: viewport, PWA tags, styles, loading splash, desktop phone frame.
p = d + "/index.html"; s = open(p, encoding="utf-8").read()
s = re.sub(r'<meta name="viewport"[^>]*/>', "", s)
s = s.replace("<title>SpeakEz</title>", "<title>speakEz</title>")
s = s.replace("</head>", open("web-head.html").read() + "</head>")
s = s.replace('<div id="root"></div>', '<div id="root"></div>\n' + open("web-body.html").read())
open(p, "w", encoding="utf-8").write(s)
PY
cp -r public/. dist/ 2>/dev/null || true
echo '{ "rewrites": [ { "source": "/((?!_expo|assets|.*\\..*).*)", "destination": "/index.html" } ] }' > dist/vercel.json
echo built

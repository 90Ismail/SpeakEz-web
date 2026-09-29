# speakEz web (fork of the phone app)

This fork adds a browser build of speakEz on top of the phone app. The phone app is Abdullahi Abdi's repo (`Mulla759/SpeakEz`, `main`). This fork (`90Ismail/SpeakEz-web`, branch `web-demo`) only adds the web layer.

## Rules for Claude

- **Take the API structure from the phone app.** The backend lives in `api/` (FastAPI, routes in `api/app/routes`, schemas in `api/app/schemas.py`, models in `api/app/models.py`). Do not redesign endpoints or payloads for the web. The web client uses the same calls as the phone app through `src/api` and `src/config.ts`.
- **The database is still on the VPS.** PostgreSQL + PostGIS and Redis run on the DigitalOcean droplet (204.48.19.46), not locally and not in this repo. The live API is https://api.204-48-19-46.sslip.io (`DEMO_MODE=true`, seeded demo data). Never point the web build at a local database, never edit the DB by hand, and put every schema change in an Alembic migration.
- Keep phone-app behavior unchanged. Web-only code lives in `web-stubs/`, `web-patches/`, `web-head.html`, `web-body.html`, `public/`, `metro.config.js` and `build-web.sh`.
- Do not edit the phone app's files (`app/`, `src/`, `api/`, `app.json`). The web build reuses all of them as-is. The only tweak, forcing light mode, is `web-patches/light-theme.patch`, which `build-web.sh` applies for the build and reverts afterward.

## Build and deploy the web app

```
npm install --no-save react-native-web react-dom@19.2.3 maplibre-gl@4.7.1   # install all three together
./build-web.sh                                                                # writes dist/
cd dist && npx vercel --prod --yes                                            # https://speakez-wakehaven.vercel.app
```

`build-web.sh` sets `EXPO_PUBLIC_API_URL=https://api.204-48-19-46.sslip.io` and a demo location near Coffman Union so notes unlock.

## Gotchas

- Vercel drops any folder named `node_modules`, so the script renames `dist/assets/node_modules` to `dist/assets/nm`.
- Vercel Authentication (Deployment Protection) must stay off or judges see a login page.
- The map is MapLibre GL 4.7.1 (v6 is ESM-only) with OpenFreeMap tiles, wrapped to look like `react-native-maps` in `web-stubs/react-native-maps.js`.

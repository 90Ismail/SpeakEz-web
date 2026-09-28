# Public URL for the judge landing page

## The URL to print / read aloud

**https://speakez-chi.vercel.app**

This is a **mirror**, hosted on Vercel (project `speakez`, scope `mulla759s-projects`).

## The origin

**https://go.165-22-180-184.sslip.io/** — served by Caddy on the VPS, and it already
works. The mirror exists only to give the page a shorter, more legible address for a
printed QR card. Either URL is a valid thing to point a judge at.

## What the mirror does and does not buy you

The landing page is **only a launcher**. Its primary button is a deep link:

```
exp://go.165-22-180-184.sslip.io:8081
```

That link, and the Expo Go JS bundle it pulls, still come from **Metro on the VPS**.
So hosting the page on Vercel does **not** make the demo independent of that box. What
it buys you is exactly two things:

1. A cleaner address for the printed card (no raw IP to read aloud).
2. The page itself stays reachable if the VPS's TLS misbehaves — though the demo it
   launches would still be down in that case.

The API at `https://api.165-22-180-184.sslip.io` is unchanged; the landing page does
not call it.

## Source of truth

`deploy/landing/index.html` is the single source. It deliberately keeps the literal
placeholder `__GO_HOST__` (3 occurrences) because `deploy/vps-bootstrap.sh` seds it at
install time. **Do not hardcode the host into that file** — it would break the VPS path.

`deploy/build-public-landing.sh` does the same substitution locally to produce the
publishable copy:

```bash
./deploy/build-public-landing.sh                      # -> deploy/.public-landing/
./deploy/build-public-landing.sh --go-host other.host --out /tmp/x
```

It fails loudly if any `__GO_HOST__` survives, if the vendored `qrcode.min.js` is
missing, or if the expected `exp://<host>:8081` link is absent from the output.
`deploy/.public-landing/` is gitignored.

## Redeploying the mirror

The build directory is wiped on each build, which also removes its Vercel link, so
link then deploy:

```bash
./deploy/build-public-landing.sh
npx vercel link --yes --project speakez --cwd deploy/.public-landing
npx vercel deploy --prod --cwd deploy/.public-landing
```

Every `--prod` deploy re-aliases **https://speakez-chi.vercel.app** to the new build,
so the printed URL does not change. (This exact sequence was run and verified.)

If the machine is not logged in to Vercel, `npx vercel login` first.

## Verification performed (2026-09-28)

Against `https://speakez-chi.vercel.app`:

- `GET /` -> **HTTP 200**, `text/html; charset=utf-8`, 8591 bytes.
- Served HTML contains `exp://go.165-22-180-184.sslip.io:8081` **3 times**.
- Served HTML contains `__GO_HOST__` **0 times**.
- `GET /qrcode.min.js` -> **HTTP 200**, 19927 bytes, SHA-256 **byte-identical** to the
  vendored `deploy/landing/qrcode.min.js`. The QR renderer is not from a CDN.
- Served HTML is byte-identical to the local build output.
- Origin `https://go.165-22-180-184.sslip.io/` -> HTTP 200 at time of checking.

### Known caveat

The page's `<head>` loads **Google Fonts** (`fonts.googleapis.com` /
`fonts.gstatic.com`) via a stylesheet `<link>`. This is pre-existing in
`deploy/landing/index.html` and applies to the VPS-hosted copy too. If that network is
blocked or slow, the page still renders and every button still works — the CSS falls
back through `--sans` / `--serif` to system fonts. Only the typeface changes.

### Not verified

- The deep link was not opened on a physical device from the mirrored page; only the
  presence and exact spelling of the `exp://` string in the served HTML was checked.
- On-device QR scanning of the printed card was not tested.

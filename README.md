# Scan The Plan

QR-driven policy hub for Atiku Abubakar's plan — a public product page, a
secure admin panel, and a secure client insights dashboard reading QR scan
analytics. Same architecture pattern as the Tinubu Delivers build: static
HTML + Cloudflare Pages Functions, no build step, deployed via Cloudflare's
native Git integration (push to `main` → auto-deploy).

## What's in this repo

```
/                          → public landing page
/delivers/                 → the product page — this is what the master QR code points to
/admin/                    → admin panel (QR code, stats, reset client password) — password protected
/client-insights/          → read-only scan-stats dashboard for the client — password protected, installable as a PWA
/functions/                → Cloudflare Pages Functions (the backend)
  track-qr.js                 → logs a scan + redirects to /delivers/
  qr-stats.js                 → read-only JSON, powers both dashboards
  client-login.js             → client dashboard login
  client-change-password.js   → client rotates their own password
  admin-login.js              → admin login (server-side, secure)
  admin/reset-client-password.js → admin force-resets the client's password
  admin/_middleware.js        → gates everything under /admin/
  client-insights/_middleware.js → gates everything under /client-insights/
  _shared/password.js         → PBKDF2 password hashing helper
seed.js                    → generates password hashes to seed into KV
wrangler.toml               → local dev config (KV binding)
```

## 1. Push this to GitHub

```bash
cd atiku-delivers
git init
git add .
git commit -m "Initial commit — Atiku Delivers"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 2. Create a Cloudflare KV namespace

In the Cloudflare dashboard: **Workers & Pages → KV → Create namespace**.
Name it something like `atiku-delivers-cache`. Copy its **Namespace ID**.

(Optional local dev: `npx wrangler kv namespace create AD_CACHE` does this
from the CLI instead, and prints the ID for you.)

## 3. Create the Cloudflare Pages project

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
to Git** → select this repo.

Build settings:
- **Framework preset:** None
- **Build command:** *(leave blank — no build step)*
- **Build output directory:** `/`

Cloudflare auto-detects the `/functions` folder — no extra config needed.

## 4. Bind the KV namespace to the Pages project

In the Pages project → **Settings → Functions → KV namespace bindings**:
- Variable name: `AD_CACHE`
- KV namespace: the one you created in step 2

(You can optionally add a second binding named `AD_QR_STATS` pointing to a
separate namespace if you want QR analytics physically separate from
auth/session data — everything falls back to `AD_CACHE` automatically if
you skip this.)

## 5. Set environment variables

In the Pages project → **Settings → Environment variables**, add for
**both** Production and Preview:

| Variable | Value |
|---|---|
| `ADMIN_DASHBOARD_PASSWORD` | A password for first-time admin login |
| `CLIENT_DASHBOARD_PASSWORD` | A password for first-time client login |

These are **first-login-only fallbacks**. The moment someone logs in and
the system stores a hash in KV (or you seed one directly, see below), the
env var stops being read for that role. Rotate/remove them once you've
confirmed both dashboards work, if you'd rather not leave them sitting in
plaintext in the Cloudflare dashboard indefinitely.

**Alternative — seed password hashes directly instead of using the env
var fallback:**
```bash
node seed.js admin "your-admin-password"
node seed.js client "your-client-password"
```
Each prints a `npx wrangler kv key put ...` command — run it against your
namespace ID to store the hash directly, skipping the plaintext env var
entirely.

## 6. Trigger the first deploy

Cloudflare deploys automatically once the Pages project is connected — it
will build from whatever's already on `main`. Every future `git push` to
`main` redeploys automatically. No GitHub Actions, no manual CLI deploy
step.

You'll get a `*.pages.dev` URL immediately — that's fully live and testable
before any custom domain work.

## 7. Attach a custom domain (later, when ready)

Pages project → **Custom domains** tab → add your domain. This only works
for domains already on Cloudflare DNS.

## 8. Get the QR code

Log into `/admin/` with your admin password → the master QR code is
generated and downloadable there. It encodes `https://<your-domain>/track-qr`,
which logs the scan and redirects to `/delivers/`.

## Local development (optional)

```bash
npm install -g wrangler
npx wrangler pages dev .
```

This serves the static files and runs the Functions locally. For full KV
binding support locally, fill in the real namespace ID in `wrangler.toml`
first (or let Wrangler use its local KV emulation, which works out of the
box for testing without touching production data).

## Security notes

- Both `/admin/` and `/client-insights/` use **server-side** password
  checks with `HttpOnly, Secure, SameSite=Strict` session cookies — neither
  panel's credentials are ever exposed in client-side JavaScript.
- No personal data is collected from QR scans — only a timestamp and
  coarse country (from Cloudflare's own edge request metadata, not a
  third-party geo-IP service).
- Passwords are stored as PBKDF2-SHA256 hashes (100,000 iterations,
  per-password random salt), never in plaintext, once set via login or
  `seed.js`.

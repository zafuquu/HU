# HAVOC Website — Vercel Deploy (upload-ready folder)

Upload **this whole folder** to Vercel (the website + Discord login
serverless functions). It is self-contained — no bridge, no desktop.

**The game-data bridge stays on your PC** (it needs WebRTC + a persistent
socket); it pushes live game data + desktop-presence into Supabase, and this
website reads them via Supabase Realtime. That's the glue.

---

## 1) Deploy to Vercel

- Go to https://vercel.com/new → **Import Project** → upload **this folder**
  (or push it to a GitHub repo and import that).
- Framework preset: **Vite** (auto-detected via `vercel.json`).
- Build command: `npm run build` · Output directory: `dist` (auto).

## 2) Environment variables (Vercel Dashboard → Project → Settings → Env)

| Name                         | Value                                                                 |
| ---------------------------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`          | `https://dnffbstczjntprzbrxds.supabase.co`                             |
| `VITE_SUPABASE_ANON_KEY`     | your anon key (from `.env.local`)                                      |
| `SUPABASE_URL`               | same as above (functions use it)                                       |
| `SUPABASE_SERVICE_ROLE_KEY`  | your service_role key (server-side only — never in client code)        |
| `DISCORD_CLIENT_ID`          | `1504288305657680013` (from `.env.local`)                              |
| `DISCORD_CLIENT_SECRET`      | from `.env.local`                                                      |
| `SESSION_SECRET`             | a long random string                                                   |

> ⚠️ Same Discord app as the local one is fine, but the **redirect URI** must be
> registered: add `https://<your-vercel-domain>/api/auth/callback` **and**
> `https://<your-vercel-domain>/api/auth/login-callback` to your Discord app's
> Redirect URIs (discord.com/developers → OAuth2). Local dev keeps using
> `http://localhost:5173/api/auth/discord/callback`.

## 3) After deploy

- Open `https://<your-vercel-domain>/` → `/app` login page → **Sign in with
  Discord** → redirected to the dashboard.
- Overlay popout routes work via SPA rewrite: `/<roomCode>/<overlayId>?screen=default&isPopout=true`.
- The overlay + dashboard show a green **"Desktop Connected — Valorant"** badge
  when the desktop bridge is live.

---

## What's inside

```
this folder/
├── src/            # the React website (react-router, tailwind, supabase)
├── public/         # fonts, huds-overlay assets, icons
├── api/            # Vercel serverless functions = the auth + room API
│   ├── _lib.mjs                    # shared session/Discord/supabase helpers
│   ├── auth/discord.mjs            # GET  → Discord OAuth authorize (browser)
│   ├── auth/callback.mjs           # GET  → code exchange → cookie → /app (browser)
│   ├── auth/login.mjs              # GET  → desktop PKCE OAuth start        (/auth/login)
│   ├── auth/login-callback.mjs     # GET  → Discord returns → havoc-desktop://auth/callback#token=
│   ├── auth/me.mjs                 # GET  → current profile (session cookie)
│   ├── auth/logout.mjs             # GET  → clear session
│   └── room/[tournamentId]/{invite,remove}.mjs  # admin room membership
├── vercel.json     # SPA rewrites (off bypassed for /api/*) 
└── package.json   # site deps only
└── index.html, vite.config.ts, tsconfig*.json
```

## Local dev (unchanged)
Run the whole stack on your PC as before:
    `server/discord-auth.mjs` (:8787) + `npm run dev` (:5173).
The Vite proxy forwards `/api/*` to :8787 in dev.

## Testing desktop ↔ deployed website
- Start `server/game-bridge.mjs` (port 7180) — it writes scores + presence to Supabase.
- Point the desktop at the deployed URL:
  HAVOC_DESKTOP_OVERLAY_ORIGIN / HAVOC_DESKTOP_LOGIN_ORIGIN =
  https://your-ve.domain
  HAVOC_DESKTOP_API_ORIGIN / REALTIME = http://127.0.0.1:7180
- Open the deployed overlay page → badge turns green; scoreline updates from Valorant.
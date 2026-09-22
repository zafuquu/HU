# GEP PackageManager (PM) path — investigation findings

## Status
Live app intentionally stays on **blob hybrid** (config `captureExe`) with the
verified `6f10e03` projection code. This branch isolates the PM-path work.

## Root cause: PM never loads packages (pm.gep undefined) — PROVEN

`%LOCALAPPDATA%\Havoc\game-data-runtime\ow-electron\odebnnigmnmahlgkdgmjmhkhknbkncnfpdlofhpm\logs\owpm*.log`
(Sep 1, every attempt identical):

```
[INFO]  starting ow-electron package manager '5.0.14' (dev:true)
[WARN]  [SECURITY] Dev mode missing credentials
[WARN]  [SECURITY] Dev credentials invalid
[WARN]  [SECURITY] Package cache cleared for blocked app
[INFO]  closing package manager: 'invalid verification'
```

owpm initializes, then **rejects the app for missing/invalid Overwolf dev
credentials and shuts down before loading any package**. `app.overwolf.packages`
therefore only ever exposes `controller` — `gep` never appears. Not a code bug:
an account/registration gate.

## Reference implementation (ValoSpectra Spectra-Client)
- `package.json` has `"overwolf": { "packages": ["gep"] }` (same as ours)
- Runs via `ow-electron . --development`
- `@overwolf/ow-electron` 37.10.3 (we have 42.7.1 — version is NOT the issue)
- No in-repo credential files — they run as a **registered Overwolf developer
  app** (they ship through `ow-electron-builder` to Overwolf's ecosystem), so
  dev-mode verification passes for them and fails for our auto-generated uid.

## What is required to unlock the PM path
1. An Overwolf **developer account** (developer.overwolf.com) and a registered
   app/extension so dev-mode verification succeeds; then the PM downloads and
   exposes `pm.gep` with `setRequiredFeatures` — the full fact stream
   (complete 10-player scoreboard, roster, round events, abilities).
2. Node-mode bare addon can never substitute: its surface is only
   `{init, connect}` — no `setRequiredFeatures`/`getInfo` (proven via addon
   surface dump in gep-provider-debug.log).

## Environment facts recorded this session
- GEP team numbering (`match_score` team_0/team_1, `round_outcome` won/lost)
  is FIXED per match; which slot is the viewer's varies per game (roster
  `team` fact reveals it). Verified across 30+ rounds.
- GEP attaches only within seconds of ShooterGame spawn (Vanguard race).
- Mid-match GEP attach sends empty `roster_N`/`scoreboard_N` (`{}`) slots.
- Blob hybrid streams session/score/roster (Riot API) but no round facts.

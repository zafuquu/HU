# Camera Feed / Discord Voice Capture — How It Works & Setup Guide

## How the original HAVOC works (from the recovered source)

The desktop app does **NOT** screen-record Discord. It has a built-in Discord
voice-capture engine (`src/main/discord-voice-capture/`) that works like this:

1. **Provisioning** — when you first open the voice-capture onboarding in the
   desktop app, it uses YOUR logged-in Discord session to **automatically
   create its own private Discord Application/Bot** (`discord/provisioning/
   application-creator.ts`). You may see a captcha prompt once — complete it.
2. **Voice ingress** — that bot **joins your Discord voice channel** as a
   silent member (`voice/discord-voice-ingress.adapter.ts` → `joinVoiceChannel`).
3. **Capture** — the bot receives every member's voice audio in real time,
   decodes it Opus → raw PCM (`voice/media/opus-decoder.adapter.ts`).
4. **Fan-out** — the desktop streams that audio **over WebRTC directly into
   your OBS browser source** (`voice/webrtc/web-rtc-fanout.service.ts`), so
   the overlay page can show who is talking / play comms with near-zero delay.
5. The website's **Camera Feed page** only *assigns* which player's feed
   occupies the webcam slot in the overlay — the actual media flows
   desktop → OBS, never through the website.

> Note: the capture is **voice audio** (that's what the original HAVOC did).
> Player webcams in Discord video are a separate Discord feature the original
> app did not ingest; the "camera" slot in the overlay shows the assigned
> player's avatar/photo plus their live comms audio.

## Setup steps (once Valorant + the desktop app are running)

1. Open the **HAVOC UNLEASH desktop app** → find the **Voice Capture /
   Discord** section (onboarding wizard).
2. Log in with your Discord account inside the app when prompted
   (a hidden Discord window opens; complete any captcha).
3. Let the app **provision its bot** — it creates a private Discord app and
   invites it to your server automatically. If it asks for permission,
   approve it (the bot only needs voice-channel access).
4. In Discord, create/join a **voice channel** with your players
   (e.g. "Casters" or "Team Comms"). The bot joins the same channel.
5. In the desktop app, **select that voice channel** as the capture source.
6. In the website dashboard → **Camera Feed** → assign a player to the
   camera slot (their name/photo shows in the overlay's webcam box).
7. In OBS, the overlay browser source now receives the comms audio +
   camera card automatically — no extra OBS plugin needed.

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot doesn't join the channel | Re-run the onboarding; check the bot appears offline/online in the member list |
| No audio in overlay | Make sure the selected channel is a **voice** channel (not stage/text) and people are unmuted |
| Captcha keeps appearing | Log into Discord in your normal browser first, then retry in the app |
| Wrong player shown | Change the assignment on the Camera Feed page |

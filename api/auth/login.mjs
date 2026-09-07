// api/auth/login.mjs — DESKTOP SIGN-IN: starts the OAuth PKCE flow.
//
// The desktop (better-auth electron client) opens:
//   {dashboard}/auth/login?client_id=electron&code_challenge=<S256>&state=<s>
// We perform Discord OAuth in this same request, then issue a one-time
// token and redirect to havoc-desktop://auth/callback#token=<base64url JSON>
import crypto from 'node:crypto'
import { randomUUID } from 'node:crypto'
import {
  baseUrl,
  isAdminPayload,
  supabaseAdmin,
  discordToken,
  discordMe,
  upsertProfile,
  json,
  redirect,
} from '../_lib.mjs'

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, baseUrl(req))
    const clientId = url.searchParams.get('client_id')
    const codeChallenge = url.searchParams.get('code_challenge')
    const state = url.searchParams.get('state')
    if (clientId !== 'electron' || !codeChallenge || !state) {
      return json(res, 400, { error: 'missing PKCE params; expecting client_id=electron&code_challenge&state' })
    }

    // Discord OAuth — use the state server-side session key to keep PKCE state
    const discordRedirectUri = `${baseUrl(req)}/api/auth/login-callback`
    const discordState = 'pkce-' + state + '-' + crypto.randomBytes(4).toString('hex')
    // Store the PKCE state + code challenge in cookies so the callback maps back
    res.setHeader('Set-Cookie', [
      `havoc_pkce_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      `havoc_pkce_challenge=${codeChallenge}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    ])
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: discordRedirectUri,
      response_type: 'code',
      scope: 'identify',
      state: discordState,
    })
    return redirect(res, `https://discord.com/api/oauth2/authorize?${params}`)
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) })
  }
}
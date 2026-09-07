// api/auth/login-callback.mjs — Discord returns here after the desktop PKCE flow.
// Exchanges the code, then redirects to the desktop deep link with a one-time token.
import crypto from 'node:crypto'
import {
  baseUrl,
  parseCookies,
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
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const pkceState = parseCookies(req).havoc_pkce_state
    if (!code || !state || !pkceState) return json(res, 400, { error: 'missing params' })
    if (!supabaseAdmin) return json(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })

    const redirectUri = `${baseUrl(req)}/api/auth/login-callback`
    const token = await discordToken(code, redirectUri)
    const me = await discordMe(token.access_token)
    const profile = await upsertProfile(me)

    // Generate a one-time OAuth identifier for this PKCE flow
    const identifier = crypto.randomBytes(24).toString('base64url')
    // codeChallenge was stored in a cookie by /auth/login — recover it.
    const codeChallenge = parseCookies(req).havoc_pkce_challenge || null
    const tokenRecord = {
      userId: profile.id,
      state: pkceState,
      codeChallenge,
    }
    await supabaseAdmin.from('site_settings').upsert(
      {
        id: `electron-pkce:${identifier}`,
        value: tokenRecord,
      },
      { onConflict: 'id' },
    )

    // Deep-link back to the desktop
    const payload = { identifier, state: pkceState }
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    res.setHeader('Set-Cookie', 'havoc_pkce_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    return redirect(res, `/auth/desktop-complete#token=${encodeURIComponent(b64)}`)
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) })
  }
}
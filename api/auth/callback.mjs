// api/auth/callback.mjs — Discord OAuth callback (redirect_uri target)
import {
  baseUrl,
  parseCookies,
  supabaseAdmin,
  discordToken,
  discordMe,
  upsertProfile,
  sessionFromProfile,
  setCookie,
  clearCookie,
  redirect,
  json,
} from '../_lib.mjs'

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, baseUrl(req))
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const cookieState = parseCookies(req).havoc_oauth_state

    if (!cookieState || cookieState !== state) {
      return json(res, 400, { error: 'state mismatch' })
    }
    if (!supabaseAdmin) {
      return json(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
    }

    const redirectUri = `${baseUrl(req)}/api/auth/callback`
    const token = await discordToken(code, redirectUri)
    const me = await discordMe(token.access_token)
    const profile = await upsertProfile(me)

    clearCookie(res, 'havoc_oauth_state')
    setCookie(res, 'havoc_session', sessionFromProfile(profile, me), 60 * 60 * 24 * 14)
    return redirect(res, `${baseUrl(req)}/app`)
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) })
  }
}
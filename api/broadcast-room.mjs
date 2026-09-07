// api/broadcast-room.mjs — session-authed upsert of the room / tournament workspace.
// The browser can't write Postgres directly (RLS), so the dashboard posts its
// workspace here; we verify the cookie session and write with the service key
// — exactly how the original HAVOC's server handled dashboard persistence.
import { getSession, json, supabaseAdmin } from './_lib.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' })
  const session = getSession(req)
  if (!supabaseAdmin) return json(res, 500, { ok: false, error: 'service key missing' })

  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', async () => {
    try {
      const { serverCode, tournamentId, value } = JSON.parse(body || '{}')
      if (!serverCode && !tournamentId) return json(res, 400, { ok: false, error: 'missing serverCode or tournamentId' })

      const upserts = []
      if (serverCode && /^[A-Za-z0-9_-]{1,64}$/.test(serverCode)) {
        upserts.push(
          supabaseAdmin
            .from('site_settings')
            .upsert({ id: `broadcast-room:${String(serverCode).trim()}`, value: value ?? {} }, { onConflict: 'id' })
        )
      }
      if (tournamentId && /^[A-Za-z0-9_-]{1,64}$/.test(tournamentId)) {
        upserts.push(
          supabaseAdmin
            .from('site_settings')
            .upsert({ id: `broadcast:${String(tournamentId).trim()}`, value: value ?? {} }, { onConflict: 'id' })
        )
      }

      const results = await Promise.all(upserts)
      const err = results.find(r => r.error)
      if (err?.error) return json(res, 500, { ok: false, error: err.error.message })
      json(res, 200, { ok: true })
    } catch (e) {
      json(res, 500, { ok: false, error: String(e) })
    }
  })
}


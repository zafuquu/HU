// api/room/[tournamentId]/remove.mjs — remove a user from a tournament (admin-only)
import { getSession, isAdminPayload, supabaseAdmin, json } from '../../_lib.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
  const session = getSession(req)
  if (!session || !isAdminPayload(session)) return json(res, 403, { error: 'admin only' })
  if (!supabaseAdmin) return json(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })

  let body = {}
  try {
    body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
  } catch {
    return json(res, 400, { error: 'invalid json body' })
  }
  const tournamentId = decodeURIComponent((req.query.tournamentId || '').toString())
  const userId = String(body.userId || '').trim()
  if (!tournamentId || !userId) return json(res, 400, { error: 'tournamentId and userId required' })
  try {
    await supabaseAdmin
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
    return json(res, 200, { ok: true })
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) })
  }
}
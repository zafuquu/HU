// api/auth/logout.mjs — clear the session cookie
import { clearCookie, json } from '../_lib.mjs'

export default function handler(req, res) {
  clearCookie(res, 'havoc_session')
  return json(res, 200, { ok: true })
}
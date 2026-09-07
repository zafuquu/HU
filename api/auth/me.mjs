// api/auth/me.mjs — return the signed-in profile from the session cookie
import { getSession, json } from '../_lib.mjs'

export default function handler(req, res) {
  const payload = getSession(req)
  if (!payload) return json(res, 401, { error: 'unauthorized' })
  const badges = payload.badges || []
  return json(res, 200, {
    profile: {
      id: payload.profileId,
      discord_id: payload.discordId,
      player_id: payload.playerId,
      role: payload.role,
      badges,
      display_name: payload.name,
      avatar_url: payload.avatar,
    },
    isAdmin: payload.role === 'admin' || badges.includes('Admin'),
    isOwner: badges.includes('Owner'),
  })
}
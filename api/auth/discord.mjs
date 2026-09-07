// api/auth/discord.mjs — start Discord OAuth
import crypto from 'node:crypto'
import { baseUrl, setCookie, clearCookie, redirect } from '../_lib.mjs'

export default function handler(req, res) {
  if (!process.env.DISCORD_CLIENT_ID) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'DISCORD_CLIENT_ID not configured' }))
    return
  }
  const state = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: `${baseUrl(req)}/api/auth/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
  })
  clearCookie(res, 'havoc_oauth_state')
  setCookie(res, 'havoc_oauth_state', state, 600)
  redirect(res, `https://discord.com/api/oauth2/authorize?${params}`)
}
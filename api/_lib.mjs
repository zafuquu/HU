// api/_lib.mjs — shared helpers for all Vercel serverless functions
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret'
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || ''
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || ''

// Admin client (server-side only — bypasses RLS)
export const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

// ===== request helpers =====
export function baseUrl(req) {
  if (process.env.APP_BASE) return process.env.APP_BASE
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'
  return `${proto}://${host}`
}

export function parseCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

export function json(res, code, obj) {
  const data = JSON.stringify(obj)
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(data)
}

export function redirect(res, url) {
  res.statusCode = 302
  res.setHeader('Location', url)
  res.end()
}

export function setCookie(res, name, value, maxAge) {
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`)
}

export function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

// ===== signed session tokens (HMAC-SHA256, same format as server/discord-auth.mjs) =====
export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  return body + '.' + sig
}

export function verify(token) {
  if (!token) return null
  const [body, sig] = String(token).split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function getSession(req) {
  const cookies = parseCookies(req)
  return verify(cookies['havoc_session'] || null)
}

export function isAdminPayload(payload) {
  if (!payload) return false
  const badges = payload.badges || []
  return payload.role === 'admin' || badges.includes('Admin') || badges.includes('Owner')
}

// ===== Discord OAuth =====
export async function discordToken(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || data.error || 'token exchange failed')
  return data
}

export async function discordMe(accessToken) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || 'discord /me failed')
  return data
}

function discordAvatar(user) {
  if (!user.avatar) return null
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
}

// ===== upsert profile by discord_id =====
export async function upsertProfile(discordUser) {
  const discordId = String(discordUser.id)
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle()

  let profile
  if (existing) {
    await supabaseAdmin.from('profiles').update({
      display_name: discordUser.global_name || discordUser.username,
      avatar_url: discordAvatar(discordUser),
    }).eq('id', existing.id)
    profile = { ...existing, display_name: discordUser.global_name || discordUser.username, avatar_url: discordAvatar(discordUser) }
  } else {
    const newId = crypto.randomUUID()
    const playerId = `HAVOC-${newId.substring(0, 6).toUpperCase()}`
    const { data: created } = await supabaseAdmin.from('profiles').insert({
      id: newId,
      discord_id: discordId,
      player_id: playerId,
      display_name: discordUser.global_name || discordUser.username,
      avatar_url: discordAvatar(discordUser),
    }).select().single()
    profile = created
  }
  return profile
}

export function sessionFromProfile(profile, me) {
  return sign({
    profileId: profile.id,
    discordId: String(me.id),
    playerId: profile.player_id || null,
    role: profile.role || 'user',
    badges: profile.badges || [],
    name: profile.display_name || me.username || null,
    avatar: profile.avatar_url || null,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  })
}
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type DesktopPresence = {
  connected: boolean
  game?: string
  roomName?: string
  lastSeen?: number
}

/**
 * Subscribes to the desktop bridge's presence heartbeat in
 * `site_settings` (id `desktop:<roomCode>`). The bridge upserts it every
 * 5s while a desktop producer is connected and marks it disconnected
 * when the session stops.
 */
export function useDesktopPresence(roomCode?: string | null) {
  const [presence, setPresence] = useState<DesktopPresence | null>(null)
  // Room code the FRESH presence actually belongs to (may differ from the
  // tournament's code when the desktop is joined to a different room).
  const [presenceRoom, setPresenceRoom] = useState<string | null>(null)

  /** Latest fresh (heartbeat < 30s) desktop presence across ALL rooms. */
  const fetchAnyFresh = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('id,value')
      .like('id', 'desktop:%')
    let best: { code: string; value: DesktopPresence } | null = null
    for (const row of data ?? []) {
      if (!row.id.startsWith('desktop:')) continue
      const v = row.value as DesktopPresence
      if (v?.connected && v.lastSeen != null && Date.now() - v.lastSeen < 30000) {
        if (!best || (v.lastSeen ?? 0) > (best.value.lastSeen ?? 0)) {
          best = { code: row.id.slice('desktop:'.length), value: v }
        }
      }
    }
    return best
  }

  useEffect(() => {
    if (!roomCode) return
    const key = `desktop:${roomCode}`
    let cancelled = false
    const applyRow = (id: string, value: DesktopPresence | null | undefined) => {
      if (!value || cancelled) return
      setPresence(value)
      setPresenceRoom(id.startsWith('desktop:') ? id.slice('desktop:'.length) : null)
    }
    const channel = supabase
      .channel(`desktop-presence-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: `id=eq.${key}` },
        (payload) => {
          applyRow(key, (payload.new as any)?.value)
        },
      )
      .subscribe()
    // Room-specific presence first; if stale/missing, fall back to ANY fresh
    // desktop heartbeat so the site still shows "desktop online" (with the
    // room code the desktop is actually joined to) instead of a false
    // "offline" when the codes differ.
    const fetchRoom = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', key)
        .maybeSingle()
      const v = data?.value as DesktopPresence | null | undefined
      if (v?.connected && v.lastSeen != null && Date.now() - v.lastSeen < 30000) {
        if (!cancelled) {
          setPresence(v)
          setPresenceRoom(roomCode ?? null)
        }
        return true
      }
      const any = await fetchAnyFresh()
      if (!cancelled && any) {
        setPresence(any.value)
        setPresenceRoom(any.code)
        return true
      }
      return false
    }
    void fetchRoom()
    // Polling fallback: Supabase Realtime may not be enabled for this table
    // (or the websocket may drop silently in OBS browsers). Poll every 5s so
    // the presence pill stays accurate regardless of realtime delivery.
    const poll = setInterval(() => {
      if (cancelled) return
      void fetchRoom()
    }, 5000)
    return () => {
      cancelled = true
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [roomCode])

  // Stale detection: if no heartbeat for 30s, treat as disconnected.
  // (30s tolerates Render/network latency spikes without flapping.)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])
  const live = presence?.connected && presence.lastSeen != null && now - presence.lastSeen < 30000

  return { presence, live, presenceRoom }
}

export const GAME_NAMES: Record<string, string> = {
  VAL: 'Valorant',
  CS: 'Counter-Strike 2',
  RL: 'Rocket League',
  MR: 'Marvel Rivals',
}

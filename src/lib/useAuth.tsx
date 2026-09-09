import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { supabase } from './supabase'

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

type AuthProfile = {
  id: string
  discord_id?: string | null
  player_id?: string | null
  role?: string | null
  badges?: string[] | null
  display_name?: string | null
  avatar_url?: string | null
}

type AuthContextValue = {
  status: AuthStatus
  profile: AuthProfile | null
  isAdmin: boolean
  isOwner: boolean
  signInWithDiscord: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [profile, setProfile] = useState<AuthProfile | null>(null)

  useEffect(() => {
    let active = true
    // Purge a stale/expired Supabase session: supabase-js attaches the saved
    // JWT to EVERY query, and an expired token makes even public-read tables
    // answer 401 (blank dashboard). After signOut the anon key is used and
    // public data renders again.
    supabase.auth.getUser().catch(() => {
      if (active) void supabase.auth.signOut()
    })
    fetch('/api/auth/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('no session')
        const data = await r.json()
        if (!active) return
        setProfile(data.profile)
        setStatus('signedIn')
      })
      .catch(() => {
        if (!active) return
        setProfile(null)
        setStatus('signedOut')
      })
    return () => { active = false }
  }, [])

  const signInWithDiscord = () => {
    window.location.href = '/api/auth/discord'
  }

  const signOut = async () => {
    try { await fetch('/api/auth/logout') } catch {}
    setProfile(null)
    setStatus('signedOut')
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        profile,
        isAdmin: !!profile && (profile.role === 'admin' || (Array.isArray(profile.badges) && profile.badges.includes('Admin'))),
        isOwner: !!profile && (Array.isArray(profile.badges) && profile.badges.includes('Owner')),
        signInWithDiscord,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

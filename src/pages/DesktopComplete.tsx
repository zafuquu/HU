import { useEffect, useState } from 'react'

/**
 * Landing page the desktop login flow redirects through (parity with the
 * original's /auth/desktop-complete). Fires the havoc-desktop:// deep link and
 * shows a manual fallback button if the browser blocks the protocol handler.
 */
export default function DesktopComplete() {
  const [fired, setFired] = useState(false)
  const [hasToken] = useState(() => window.location.hash.startsWith('#token='))

  useEffect(() => {
    if (!hasToken) return
    const t = window.location.hash.slice(7)
    const timer = setTimeout(() => {
      window.location.href = `havoc-desktop://auth/callback#token=${encodeURIComponent(t)}`
      setFired(true)
    }, 600)
    return () => clearTimeout(timer)
  }, [hasToken])

  const retry = () => {
    const t = window.location.hash.slice(7)
    window.location.href = `havoc-desktop://auth/callback#token=${encodeURIComponent(t)}`
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111214', color: '#e7e7e7', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 32 }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>HAVOC UNLEASH</h1>
        {!hasToken ? (
          <p style={{ color: '#9ca3af' }}>Missing login token. Please start the sign-in again from the desktop app.</p>
        ) : (
          <>
            <p style={{ color: '#9ca3af', marginBottom: 20 }}>
              {fired ? 'Returning to the HAVOC UNLEASH Desktop App…' : 'Opening the desktop app…'}
            </p>
            <button
              onClick={retry}
              style={{ background: '#5865F2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, cursor: 'pointer' }}
            >
              Open Desktop App again
            </button>
            <p style={{ marginTop: 18, fontSize: 12, color: '#6b7280' }}>You can close this tab once the app is signed in.</p>
          </>
        )}
      </div>
    </div>
  )
}

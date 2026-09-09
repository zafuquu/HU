import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../lib/useAuth'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  useEffect(() => {
    // Discord login required: signed-out visitors are sent to /app/login.
    if (status === 'signedOut') window.location.href = '/app/login'
  }, [status])

  if (status !== 'signedIn') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0d0e10] text-white/50">
        <div className="flex items-center gap-2 text-sm">
          <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          {status === 'signedOut' ? 'Redirecting to login…' : 'Loading...'}
        </div>
      </div>
    )
  }

  return <>{children}</>
}

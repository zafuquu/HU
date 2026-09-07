import { useEffect, useState } from 'react'

export interface ToastPayload {
  id?: string
  title?: string
  message: string
  type?: 'info' | 'warning' | 'alert' | 'success'
  durationMs?: number
}

interface OverlayToastProps {
  toast?: ToastPayload | null
}

export function OverlayToast({ toast }: OverlayToastProps) {
  const [visible, setVisible] = useState(false)
  const [currentToast, setCurrentToast] = useState<ToastPayload | null>(null)

  useEffect(() => {
    if (!toast || !toast.message) {
      setVisible(false)
      return
    }

    setCurrentToast(toast)
    setVisible(true)

    const timer = setTimeout(() => {
      setVisible(false)
    }, toast.durationMs || 4500)

    return () => clearTimeout(timer)
  }, [toast?.id, toast?.message])

  if (!visible || !currentToast) return null

  const typeStyles = {
    info: {
      border: 'rgba(59, 130, 246, 0.6)',
      glow: 'rgba(59, 130, 246, 0.25)',
      badgeBg: 'rgba(59, 130, 246, 0.2)',
      badgeColor: '#60A5FA',
      badgeText: 'BROADCAST ALERT',
    },
    warning: {
      border: 'rgba(245, 158, 11, 0.7)',
      glow: 'rgba(245, 158, 11, 0.3)',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      badgeColor: '#FBBF24',
      badgeText: 'TECH NOTICE',
    },
    alert: {
      border: 'rgba(239, 68, 68, 0.7)',
      glow: 'rgba(239, 68, 68, 0.35)',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      badgeColor: '#F87171',
      badgeText: 'MATCH EVENT',
    },
    success: {
      border: 'rgba(34, 197, 94, 0.7)',
      glow: 'rgba(34, 197, 94, 0.25)',
      badgeBg: 'rgba(34, 197, 94, 0.2)',
      badgeColor: '#4ADE80',
      badgeText: 'SYSTEM OK',
    },
  }[currentToast.type || 'info']

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
        animation: 'overlayToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <style>{`
        @keyframes overlayToastIn {
          0% { opacity: 0; transform: translate(-50%, -20px) scale(0.96); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 22px',
          background: 'rgba(10, 14, 23, 0.94)',
          backdropFilter: 'blur(16px)',
          borderRadius: 8,
          border: `1px solid ${typeStyles.border}`,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px ${typeStyles.glow}`,
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#fff',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 4,
            background: typeStyles.badgeBg,
            color: typeStyles.badgeColor,
            border: `1px solid ${typeStyles.border}`,
          }}
        >
          {currentToast.title || typeStyles.badgeText}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: '#F3F4F6' }}>
          {currentToast.message}
        </div>
      </div>
    </div>
  )
}

import { X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, destructive }: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
          borderRadius: 12, padding: 24, maxWidth: 400, width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
          <button
            onClick={() => { onConfirm(); onCancel() }}
            className="btn"
            style={{
              background: destructive ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
              color: destructive ? 'white' : 'hsl(var(--background))',
              border: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

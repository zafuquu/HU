import { LayoutGrid } from 'lucide-react'

export default function Widgets() {
  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Widgets</h2>
      <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', marginBottom: 24 }}>
        Manage your broadcast widgets
      </p>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px', textAlign: 'center',
        border: '1px dashed hsl(var(--border))', borderRadius: 12,
        background: 'hsla(0, 0%, 91%, 0.02)',
      }}>
        <LayoutGrid size={40} style={{ color: 'hsla(var(--muted-foreground))', marginBottom: 16, opacity: 0.5 }} />
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>No widgets available</div>
        <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', maxWidth: 300 }}>
          Widgets will appear here when they are available for your broadcast kit.
        </p>
      </div>
    </div>
  )
}

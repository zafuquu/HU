import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface DropdownProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
  width?: number | string
  prefix?: ReactNode
  disabled?: boolean
}

export default function Dropdown({ value, options, onChange, placeholder, width, prefix, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', width: width || '100%' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px',
          background: 'hsla(var(--input))', border: '1px solid hsl(var(--border))',
          borderRadius: 'calc(var(--radius) - 2px)',
          color: value ? 'hsl(var(--foreground))' : 'hsla(var(--muted-foreground))',
          fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left', opacity: disabled ? 0.5 : 1,
        }}
      >
        {prefix}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder || 'Select...'}
        </span>
        <ChevronDown size={14} style={{
          color: 'hsla(var(--muted-foreground))', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
          borderRadius: 8, padding: 4, zIndex: 10005,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '6px 10px',
                background: opt === value ? 'hsla(0, 0%, 91%, 0.08)' : 'transparent',
                color: 'hsl(var(--foreground))', border: 'none', borderRadius: 4,
                fontSize: 13, cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = 'hsla(0, 0%, 91%, 0.05)' }}
              onMouseLeave={e => { if (opt !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

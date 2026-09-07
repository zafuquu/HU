import { useRef, useState, type DragEvent } from 'react'
import { Upload, X } from 'lucide-react'

interface FileUploadProps {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  compact?: boolean
}

export default function FileUpload({ label, value, onChange, compact }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    onChange(url)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = () => {
    const file = inputRef.current?.files?.[0]
    if (file) handleFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) handleFile(file)
        break
      }
    }
  }

  if (value) {
    return (
      <div style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden',
        border: '1px solid hsl(var(--border))',
        minHeight: compact ? 60 : 120,
      }}>
        <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <button
          onClick={() => onChange(null)}
          style={{
            position: 'absolute', top: 6, right: 6,
            background: 'hsla(0, 0%, 0%, 0.7)', border: 'none', borderRadius: 4,
            color: 'white', cursor: 'pointer', padding: 4,
          }}
        >
          <X size={12} />
        </button>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, hsla(0, 0%, 0%, 0.7))',
          padding: '12px 8px 6px', fontSize: 11, fontWeight: 500,
        }}>
          {label}
        </div>
      </div>
    )
  }

  return (
    <div
      className="dropzone"
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      style={{
        borderColor: dragging ? 'hsl(var(--havoc-blue))' : undefined,
        background: dragging ? 'hsla(211, 99%, 65%, 0.05)' : undefined,
        minHeight: compact ? 60 : 120,
        padding: compact ? '8px' : undefined,
      }}
    >
      <Upload size={compact ? 16 : 20} />
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      {!compact && <div style={{ fontSize: 11 }}>Click to browse, paste, or drop</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
// @ts-ignore
import { io } from 'socket.io-client'

const BRIDGE = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'

/**
 * Webcam publisher — the page players open from an invite link to put their
 * camera on the broadcast (parity with the original /webcams/invite flow).
 * Publishes the browser webcam via WebRTC; the bridge relays signaling only.
 */
export default function WebcamPublisher() {
  const { roomId, teamId, slotId } = useParams<{ roomId: string; teamId: string; slotId: string }>()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [error, setError] = useState('')
  const [viewers, setViewers] = useState(0)
  const stateRef = useRef<{ socket: any; peerId: string; stream: MediaStream | null; pcs: Map<string, RTCPeerConnection> } | null>(null)

  const stop = () => {
    const st = stateRef.current
    if (!st) return
    st.pcs.forEach(pc => pc.close())
    st.stream?.getTracks().forEach(t => t.stop())
    st.socket?.disconnect()
    stateRef.current = null
    setStatus('idle')
    setViewers(0)
  }

  const start = async () => {
    if (stateRef.current) return
    setStatus('starting')
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      const peerId = 'pub_' + Math.random().toString(36).slice(2, 10)
      const st = { socket: null as any, peerId, stream, pcs: new Map<string, RTCPeerConnection>() }
      stateRef.current = st

      const socket = io(BRIDGE, { transports: ['websocket', 'polling'] })
      st.socket = socket

      const makePC = (viewerPeer: string) => {
        const pc = new RTCPeerConnection()
        st.pcs.set(viewerPeer, pc)
        stream.getTracks().forEach(t => pc.addTrack(t, stream))
        pc.onicecandidate = e => {
          if (e.candidate && socket) socket.emit('webcam:signal', { to: viewerPeer, from: peerId, data: { candidate: e.candidate.toJSON() } })
        }
        pc.onconnectionstatechange = () => {
          if (['failed', 'closed'].includes(pc.connectionState)) st.pcs.delete(viewerPeer)
          setViewers(st.pcs.size)
        }
        return pc
      }

      socket.on('connect', () => {
        socket.emit('webcam:join', { roomId, peerId, role: 'publisher', slotId, teamId })
        socket.emit('webcam:state', { roomId, slotId, status: 'live' })
        setStatus('live')
      })

      // A viewer appeared → publisher is the offerer
      socket.on('webcam:peer-joined', async (msg: { peerId: string; role: string }) => {
        if (!msg || msg.role !== 'viewer' || !stateRef.current) return
        const pc = makePC(msg.peerId)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webcam:signal', { to: msg.peerId, from: peerId, data: { description: offer } })
      })

      socket.on('webcam:signal', async (msg: { from: string; to: string; data: any }) => {
        if (!msg || msg.to !== peerId || !stateRef.current) return
        const pc = st.pcs.get(msg.from)
        const d = msg.data || {}
        if (d.description && d.description.type === 'answer' && pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(d.description))
        } else if (d.candidate && pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(d.candidate)) } catch { /* late candidate */ }
        }
      })

      socket.on('webcam:peer-left', (msg: { peerId: string }) => {
        const pc = st.pcs.get(msg?.peerId)
        if (pc) { pc.close(); st.pcs.delete(msg.peerId) }
        setViewers(st.pcs.size)
      })
    } catch (e: any) {
      setStatus('error')
      setError(e?.message || 'Could not access the camera')
    }
  }

  useEffect(() => () => { stop() }, [])

  return buildUi(status, error, viewers, videoRef, start, stop, roomId, slotId, teamId)
}

function buildUi(
  status: string,
  error: string,
  viewers: number,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  start: () => void,
  stop: () => void,
  roomId?: string,
  slotId?: string,
  teamId?: string,
) {
  return (
    <div style={{ minHeight: '100vh', background: '#111214', color: '#e7e7e7', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>HAVOC UNLEASH — Camera</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 18 }}>
          Room {roomId?.slice(0, 8)}… · slot {slotId?.slice(0, 12)}…
        </p>
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0b0c0e', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2d33' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {status !== 'live' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 14 }}>
              {status === 'starting' ? 'Starting camera…' : status === 'error' ? error : 'Camera preview appears here'}
            </div>
          )}
          {status === 'live' && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#34d399' }}>● LIVE</span>
              <span style={{ marginLeft: 8, color: '#9ca3af' }}>{viewers} viewer{viewers === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          {status !== 'live' ? (
            <button onClick={start} disabled={status === 'starting'} style={{ background: '#22c55e', color: '#052e16', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', opacity: status === 'starting' ? 0.6 : 1 }}>
              {status === 'starting' ? 'Starting…' : 'Start Camera'}
            </button>
          ) : (
            <button onClick={stop} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>
              Stop Camera
            </button>
          )}
        </div>
        {teamId && <p style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>Team: {teamId}</p>}
      </div>
    </div>
  )
}


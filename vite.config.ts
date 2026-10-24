import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In-memory room broadcast store for local Vite dev server.
// Prevents ECONNREFUSED when http://localhost:8787 is not running.
const devRoomStore = new Map<string, any>()

function devBroadcastRoomPlugin(): Plugin {
  return {
    name: 'dev-broadcast-room-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url.startsWith('/api/broadcast-room')) {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => {
              body += chunk
            })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}')
                const key = parsed.serverCode || parsed.tournamentId
                if (key) {
                  devRoomStore.set(String(key).trim(), parsed.value)
                }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
              } catch (err: any) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: false, error: err?.message || 'Invalid JSON' }))
              }
            })
            return
          }

          if (req.method === 'GET') {
            try {
              const parsedUrl = new URL(url, 'http://localhost')
              const roomCode =
                parsedUrl.searchParams.get('roomCode') ||
                parsedUrl.searchParams.get('serverCode') ||
                ''
              const value = devRoomStore.get(roomCode.trim()) || null
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, value }))
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: err?.message || 'Server error' }))
            }
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), devBroadcastRoomPlugin()],
  server: {
    // Proxy auth/API calls to the HAVOC auth+static server (node server/discord-auth.mjs)
    proxy: {
      '/api/auth': 'http://localhost:8787',
      '/api/health': 'http://localhost:8787',
      // Note: /api/broadcast-room is intercepted and handled by devBroadcastRoomPlugin()
    },
  },
})

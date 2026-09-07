import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    // Proxy auth/API calls to the HAVOC auth+static server (node server/discord-auth.mjs)
    proxy: {
      '/api/auth': 'http://localhost:8787',
      '/api/health': 'http://localhost:8787',
      '/api': 'http://localhost:8787',

    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Development: /api calls go to the Express server, so no CORS setup is needed
    proxy: {
      '/api': 'http://localhost:5000',
      // Socket.io (U-10 live seat map): same server, websockets too
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5174',
      '/webhook': 'http://localhost:5174'
    },
    port: 5173,
    allowedHosts: ['stirrupless-hypertense-memphis.ngrok-free.dev']
  }
})

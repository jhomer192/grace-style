import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow Cloudflare quick-tunnel hostnames so the dev server doesn't
    // reject requests with unknown Host headers (DNS-rebind protection).
    // The leading dot is Vite's wildcard syntax. Add custom domains here too
    // if you ever switch from a quick tunnel to a named one.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import process from 'node:process'

const apiTarget = process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:4000'

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: { '/api': apiTarget, '/audio': apiTarget } },
  plugins: [
    react(),
    tailwindcss(),
  ],
})

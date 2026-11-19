import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { isPublicReviewKey } from './src/services/publicReviewConfig.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'public-review-key-check',
    configResolved(config) {
      const key = loadEnv(config.mode, config.envDir, 'VITE_').VITE_SUPABASE_PUBLISHABLE_KEY
      if (key && !isPublicReviewKey(key)) {
        throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key. Secret/service-role keys must never enter a browser build.')
      }
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Two pages: v2 at / and the old OS site at /os/, so their CSS never mixes.
  build: { rollupOptions: { input: { main: 'index.html', os: 'os/index.html' } } },
})

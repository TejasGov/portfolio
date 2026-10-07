import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { isPublicReviewKey } from './src/services/publicReviewConfig.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'public-review-key-check',
    configResolved(config) {
      const key = loadEnv(config.mode, config.envDir, 'VITE_').VITE_SUPABASE_PUBLISHABLE_KEY
      if (key && !isPublicReviewKey(key)) {
        throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key. Secret/service-role keys must never enter a browser build.')
      }
    },
  }],
})

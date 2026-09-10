import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/predict':   'http://localhost:8000',
      '/path':      'http://localhost:8000',
      '/alerts':    'http://localhost:8000',
      '/satellite': 'http://localhost:8000',
      '/health':    'http://localhost:8000',
    },
  },
})

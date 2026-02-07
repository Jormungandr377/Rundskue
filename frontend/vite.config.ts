/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    // Split vendors into separate cached chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime - rarely changes, cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data layer - React Query + Axios
          'vendor-data': ['@tanstack/react-query', 'axios'],
          // Charts - heavy library, only needed on Dashboard/Reports/TSP
          'vendor-charts': ['recharts'],
          // Utilities
          'vendor-utils': ['date-fns', 'clsx', 'lucide-react'],
        }
      }
    },
    // Target modern browsers for smaller output
    target: 'es2020',
    // Source maps for debugging (but don't ship them)
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})

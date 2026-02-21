import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Output into the sibling web/ dir so `go run .` serves it unchanged
    outDir: '../web',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    // Proxy API calls to the Go server during local development
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})

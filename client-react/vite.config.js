import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    }
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:4517',
      '/socket.io': {
        target: 'http://localhost:4517',
        ws: true
      }
    }
  }
})
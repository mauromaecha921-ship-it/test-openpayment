/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La web y la API quedan en el mismo origen: /api va por el proxy y no hace falta CORS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // API_PROXY=http://localhost:3100 para apuntar a otra instancia de la API sin tocar el código.
      '/api': { target: process.env.API_PROXY ?? 'http://localhost:3000', changeOrigin: false },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

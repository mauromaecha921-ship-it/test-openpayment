import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/entorno.ts'],
    include: ['src/**/*.test.ts'],
    // Cada archivo usa su propia BD en memoria (PGlite: PostgreSQL dentro del proceso)
    pool: 'forks',
    // Levantar PostgreSQL y correr las migraciones tarda unos segundos la primera vez por archivo
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})

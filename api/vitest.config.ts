import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/entorno.ts'],
    include: ['src/**/*.test.ts'],
    // Cada archivo usa su propia BD en memoria
    pool: 'forks',
  },
})

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as cargarEnv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Config de Drizzle Kit (doc Drizzle · Supabase).
//
// El .env del monorepo vive en la raíz; se resuelve desde este archivo para que
// funcione sin importar desde dónde se invoque drizzle-kit.
cargarEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  // Misma carpeta que documenta «Estructura del proyecto § 3» para migraciones.
  out: './src/db/migraciones',
  // Solo el esquema de la app: evita traer auth/storage/realtime de Supabase.
  schemaFilter: ['public'],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})

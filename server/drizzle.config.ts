import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit con «primero la base», como en la rama de Pablo: la fuente de verdad son los SQL de
 * src/db/migraciones/ y `pnpm --filter api db:pull` genera src/db/schema.ts leyendo una base.
 *
 * - Por defecto (ESQUEMA_ORIGEN=local) lee una base PGlite nueva que scripts/esquema.ts arma con
 *   las migraciones: no necesita internet ni toca la base de nadie.
 * - Con ESQUEMA_ORIGEN=postgres lee la DATABASE_URL de PostgreSQL del .env (Supabase), para
 *   comprobar que la base real es igual a las migraciones.
 *
 * `casing: 'preserve'` deja los nombres de las columnas tal cual (`creado_en`, no `creadoEn`): así
 * los repositorios devuelven las mismas filas que con SQLite.
 */
const raizApi = dirname(fileURLToPath(import.meta.url))
for (const archivo of [resolve(raizApi, '../.env'), resolve(raizApi, '.env')]) {
  if (existsSync(archivo)) process.loadEnvFile(archivo)
}

const comun = {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './data/introspeccion',
  schemaFilter: ['piloto', 'piloto_gobierno', 'piloto_puente'],
  tablesFilter: ['!migracion'],
  introspect: { casing: 'preserve' },
} as const

const url = process.env.DATABASE_URL ?? ''

export default process.env.ESQUEMA_ORIGEN === 'postgres'
  ? defineConfig({ ...comun, dbCredentials: { url } })
  : defineConfig({ ...comun, driver: 'pglite', dbCredentials: { url: './data/pglite-esquema' } })

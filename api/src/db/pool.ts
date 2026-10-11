// Conexión a PostgreSQL (Supabase o Neon) con Drizzle ORM sobre postgres-js.
//
// Doc Drizzle · Supabase: si se usa el connection pooler de Supabase en modo
// «Transaction», los prepared statements no están soportados, por eso
// `prepare: false`. Con el pooler en modo «Session» o una conexión directa
// también funciona (solo se pierde el cache de prepared statements).
//
// Importar siempre `db` desde aquí; `config` es la única lectura de
// process.env de la API (Estructura del proyecto § 2).
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { config } from '../config'

export const client = postgres(config.DATABASE_URL, { prepare: false })

export const db = drizzle({ client })

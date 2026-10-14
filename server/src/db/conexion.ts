import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdirSync } from 'node:fs'
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { BaseDeDatos } from '../config.js'

/**
 * La conexión a PostgreSQL: Supabase con postgres-js (como la rama de Pablo) o PGlite, el mismo
 * PostgreSQL corriendo dentro de Node (pruebas y trabajo sin internet). Todo el SQL de la API
 * vive en `db/repositorios/` y pasa por Drizzle.
 */
export type Ejecutor = PgAsyncDatabase<PgQueryResultHKT>

/**
 * El piloto vive en sus propios esquemas, nunca en `public`: la base de Supabase es la del equipo
 * (la usa Pablo) y sus tablas tienen los mismos nombres. Drizzle escribe siempre el esquema en
 * cada consulta, y las migraciones corren con este `search_path`.
 */
export const ESQUEMA = 'piloto'
export const ESQUEMA_GOBIERNO = 'piloto_gobierno'
const RUTA = `${ESQUEMA}, ${ESQUEMA_GOBIERNO}`

interface Conexion {
  bd: Ejecutor
  tipo: BaseDeDatos['tipo']
  descripcion: string
  /**
   * Un script con varias sentencias y sin parámetros (migraciones y semillas). Corre con el
   * `search_path` del piloto: los nombres sin esquema caen en `piloto`, nunca en `public`.
   */
  script(sql: string): Promise<void>
  /** Una consulta suelta con parámetros $1, $2…; devuelve las filas. */
  filas<T>(sql: string, parametros?: unknown[]): Promise<T[]>
  /**
   * Corre `fn` solo si nadie más tiene el candado `clave` (pg_try_advisory_lock). En Vercel hay
   * varias instancias de la API a la vez: así una sola renueva los tokens en cada vuelta.
   * Devuelve `undefined` si el candado estaba tomado.
   */
  conCandado<T>(clave: number, fn: () => Promise<T>): Promise<T | undefined>
  cerrar(): Promise<void>
}

let actual: Conexion | undefined

async function abrirPglite(base: Extract<BaseDeDatos, { tipo: 'pglite' }>): Promise<Conexion> {
  // Import dinámico: PGlite solo existe en desarrollo y pruebas; el paquete de Vercel no lo lleva
  const [{ PGlite }, { drizzle: drizzlePglite }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ])
  if (base.ruta) mkdirSync(base.ruta, { recursive: true })
  const cliente = base.ruta ? new PGlite(base.ruta) : new PGlite()
  await cliente.waitReady
  // PGlite tiene una sola conexión: con esto el SQL suelto de las pruebas encuentra las tablas
  await cliente.exec(`SET search_path TO ${RUTA}`)
  return {
    bd: drizzlePglite({ client: cliente }) as unknown as Ejecutor,
    tipo: 'pglite',
    descripcion: base.descripcion,
    script: async (sql) => {
      await cliente.exec(`SET search_path TO ${RUTA};
${sql}`)
    },
    filas: async <T>(sql: string, parametros: unknown[] = []) => (await cliente.query<T>(sql, parametros)).rows,
    // Un solo proceso con una sola conexión: no hay con quién competir
    conCandado: (_clave, fn) => fn(),
    cerrar: () => cliente.close(),
  }
}

function abrirPostgres(base: Extract<BaseDeDatos, { tipo: 'postgres' }>): Conexion {
  const url = new URL(base.url)
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  const cliente = postgres(base.url, {
    // Cifrada siempre que la base no esté en este PC: postgres-js no usa TLS si no se le pide.
    // «require» cifra sin exigir el certificado de Supabase, que firma su propia autoridad.
    ssl: local ? false : 'require',
    // Sin sentencias preparadas, cada consulta con parámetros cuesta dos idas y vueltas (D-43). El
    // pooler de Supabase las admite en modo «Session» (5432); en modo «Transaction» (6543) no, y
    // ahí se apagan, como hace la rama de Pablo.
    prepare: url.port !== '6543',
    // Pocas conexiones: el pooler gratuito tiene un límite (§ 12). En Vercel cada instancia abre las
    // suyas, así que se usan menos (y conviene el pooler en modo «Transaction», puerto 6543).
    // 8 en Vercel: la renovación y la recuperación retienen una conexión cada una en segundo plano
    max: process.env.VERCEL ? 8 : 5,
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
    connection: { application_name: 'tatu-piloto' },
  })
  return {
    bd: drizzlePostgres({ client: cliente }) as unknown as Ejecutor,
    tipo: 'postgres',
    descripcion: base.descripcion,
    script: async (sql) => {
      // Los scripts traen BEGIN … COMMIT: postgres-js exige una conexión reservada para eso
      const reservada = await cliente.reserve()
      try {
        await reservada.unsafe(`SET search_path TO ${RUTA};
${sql}`).simple()
      } finally {
        reservada.release()
      }
    },
    filas: async <T>(sql: string, parametros: unknown[] = []) =>
      (await cliente.unsafe(sql, parametros as postgres.ParameterOrJSON<never>[])) as unknown as T[],
    conCandado: async (clave, fn) => {
      // El candado vive en la sesión: hay que tomarlo y soltarlo en la misma conexión
      const reservada = await cliente.reserve()
      try {
        const [f] = await reservada<{ ok: boolean }[]>`SELECT pg_try_advisory_lock(${clave}) AS ok`
        if (!f?.ok) return undefined
        try {
          return await fn()
        } finally {
          await reservada`SELECT pg_advisory_unlock(${clave})`
        }
      } finally {
        reservada.release()
      }
    },
    cerrar: () => cliente.end({ timeout: 5 }),
  }
}

/** Abre la base (una sola por proceso). Si ya había una abierta, la cierra antes. */
export async function abrirBd(base: BaseDeDatos): Promise<Conexion> {
  await cerrarBd()
  actual = base.tipo === 'pglite' ? await abrirPglite(base) : abrirPostgres(base)
  return actual
}

export function conexion(): Conexion {
  if (!actual) throw new Error('La base de datos no está abierta (llama a abrirBd primero)')
  return actual
}

export async function cerrarBd() {
  const c = actual
  actual = undefined
  await c?.cerrar()
}

// ---------------------------------------------------------------------------------------------
// Transacciones
// ---------------------------------------------------------------------------------------------

/**
 * La transacción en curso viaja con el contexto asíncrono: los repositorios la toman de aquí, así
 * que no hay que pasarla de función en función (con SQLite bastaba con que todo fuera síncrono).
 */
const enTransaccion = new AsyncLocalStorage<Ejecutor>()

/** Lo que usan los repositorios: la transacción en curso o, si no hay, la conexión. */
export function ejecutor(): Ejecutor {
  return enTransaccion.getStore() ?? conexion().bd
}

/**
 * BEGIN … COMMIT, con ROLLBACK si algo falla. Si ya hay una transacción abierta, corre dentro de
 * ella. Regla de siempre: nunca llamar a Open Payments ni a la liquidación aquí adentro.
 */
export async function transaccion<T>(fn: () => Promise<T>): Promise<T> {
  if (enTransaccion.getStore()) return fn()
  return conexion().bd.transaction((tx) => enTransaccion.run(tx, fn))
}

/**
 * Un punto de guardado (SAVEPOINT) dentro de la transacción en curso. En PostgreSQL, después de
 * un error la transacción entera queda anulada; con esto se puede atrapar un error esperado (por
 * ejemplo, el índice único de RN-02) y seguir usando la transacción.
 */
export async function puntoDeGuardado<T>(fn: () => Promise<T>): Promise<T> {
  const tx = enTransaccion.getStore()
  if (!tx) return fn()
  return tx.transaction((sp) => enTransaccion.run(sp, fn))
}

// ---------------------------------------------------------------------------------------------
// Errores de PostgreSQL
// ---------------------------------------------------------------------------------------------

/** El error original de PostgreSQL (Drizzle lo envuelve en `cause`). */
function errorPg(e: unknown): { code: string; message: string } | undefined {
  let x = e as { code?: unknown; message?: unknown; cause?: unknown } | undefined
  for (let i = 0; i < 4 && x; i++) {
    if (typeof x.code === 'string' && /^[0-9A-Z]{5}$/.test(x.code)) return { code: x.code, message: String(x.message ?? '') }
    x = x.cause as typeof x
  }
  return undefined
}

/**
 * ¿El error es una restricción de la base? 23xxx: único, check o llave foránea; P0001: una
 * excepción de un trigger (máquina de estados o reglas del cobro). Con `texto`, además el
 * mensaje tiene que contenerlo.
 */
export function esRestriccion(e: unknown, texto?: string): boolean {
  const err = errorPg(e)
  if (!err || !(err.code.startsWith('23') || err.code === 'P0001')) return false
  return texto ? err.message.includes(texto) : true
}

/** El mensaje de la excepción de un trigger (P0001), por ejemplo «RN-06: …». */
export function mensajeDeTrigger(e: unknown): string | undefined {
  const err = errorPg(e)
  return err?.code === 'P0001' ? err.message : undefined
}

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

export const ahoraIso = () => new Date().toISOString()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Las columnas `uuid` de PostgreSQL rechazan con error un texto que no es UUID. Los repositorios
 * lo revisan antes, para que `/programas/abc` siga dando 404 y no 500.
 */
export const esUuid = (v: string) => UUID.test(v)

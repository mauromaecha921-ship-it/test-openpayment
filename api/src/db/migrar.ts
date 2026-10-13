import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { baseDeDatos } from '../config.js'
import { abrirBd, cerrarBd, conexion, ESQUEMA, ESQUEMA_GOBIERNO } from './conexion.js'

const CARPETA_MIGRACIONES = path.join(import.meta.dirname, 'migraciones')

/**
 * Las tablas del piloto, todas en el esquema `piloto`. `db:reset` borra los esquemas `piloto` y
 * `piloto_gobierno` enteros, y `vaciar` deja estas tablas sin filas. Nada de esto toca `public`,
 * donde están las tablas de la rama de Pablo en la misma base de Supabase.
 */
const TABLAS = [
  'bloqueo_pin',
  'cobro',
  'evento',
  'cuenta_beneficiario',
  'beneficiario',
  'programa_punto',
  'programa_categoria',
  'punto',
  'comercio',
  'programa',
].map((t) => `${ESQUEMA}.${t}`)

/**
 * Protección (plan § 12): si el esquema `piloto` ya tiene tablas pero no la tabla `migracion`, no
 * lo creó este piloto: no se migra ni se borra nada.
 */
async function exigirEsquemaDelPiloto() {
  const [f] = await conexion().filas<{ tablas: number; piloto: boolean }>(
    `SELECT count(*)::int AS tablas, coalesce(bool_or(tablename = 'migracion'), false) AS piloto
       FROM pg_tables WHERE schemaname = $1`,
    [ESQUEMA],
  )
  if (f && f.tablas > 0 && !f.piloto) {
    throw new Error(`El esquema «${ESQUEMA}» tiene tablas que no creó el piloto (no tiene «migracion»): no se toca.`)
  }
}

/**
 * Aplica `migraciones/*.sql` en orden y anota en `piloto.migracion` las que ya corrieron. Los
 * archivos de db/ de main no dicen el esquema: corren con el `search_path` del piloto.
 */
export async function migrar(): Promise<string[]> {
  const c = conexion()
  await exigirEsquemaDelPiloto()
  await c.script(`
    CREATE SCHEMA IF NOT EXISTS ${ESQUEMA};
    CREATE TABLE IF NOT EXISTS ${ESQUEMA}.migracion (
      nombre      text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE ${ESQUEMA}.migracion ENABLE ROW LEVEL SECURITY;`)
  const hechas = new Set((await c.filas<{ nombre: string }>(`SELECT nombre FROM ${ESQUEMA}.migracion`)).map((f) => f.nombre))
  const aplicadas: string[] = []
  for (const archivo of readdirSync(CARPETA_MIGRACIONES).filter((a) => a.endsWith('.sql')).sort()) {
    if (hechas.has(archivo)) continue
    try {
      // Cada archivo trae su propio BEGIN … COMMIT (los de db/ de main también)
      await c.script(readFileSync(path.join(CARPETA_MIGRACIONES, archivo), 'utf8'))
    } catch (e) {
      throw new Error(`Falló la migración ${archivo}: ${(e as Error).message}`)
    }
    await c.filas(`INSERT INTO ${ESQUEMA}.migracion (nombre) VALUES ($1)`, [archivo])
    aplicadas.push(archivo)
  }
  return aplicadas
}

/** Borra los dos esquemas del piloto, para empezar de cero. `public` no se toca. */
export async function borrarTodo() {
  await exigirEsquemaDelPiloto()
  await conexion().script(`
    DROP SCHEMA IF EXISTS ${ESQUEMA_GOBIERNO} CASCADE;
    DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE;`)
}

/**
 * Deja todas las tablas sin filas (las pruebas lo usan entre caso y caso). Los triggers de `main`
 * prohíben borrar cobros y eventos, así que se apagan solo durante el TRUNCATE. Necesita permisos
 * de superusuario: es para PGlite, no para Supabase.
 */
export async function vaciar() {
  await conexion().script(`
    SET session_replication_role = replica;
    TRUNCATE ${TABLAS.join(', ')}, ${ESQUEMA_GOBIERNO}.persona;
    SET session_replication_role = DEFAULT;
    ALTER SEQUENCE ${ESQUEMA}.cobro_referencia_seq RESTART;
    ALTER SEQUENCE ${ESQUEMA}.evento_id_seq RESTART;`)
}

/**
 * `pnpm --filter api db:reset` (limpia: el equipo se registra desde la app),
 * `pnpm --filter api db:reset:demo` (las 4 personas del guion, con las DEMO_WALLET_*) y
 * `pnpm --filter api db:semilla:ui` (token falso, nunca paga). Con la API apagada.
 */
async function cli(orden: string | undefined) {
  if (orden !== 'limpia' && orden !== 'demo' && orden !== 'semilla-ui') {
    throw new Error('Uso: tsx src/db/migrar.ts limpia | demo | semilla-ui')
  }
  const base = baseDeDatos()
  if (base.aviso) console.warn(`⚠️  ${base.aviso}`)
  if (base.tipo === 'pglite' && !base.ruta) throw new Error('DATABASE_URL apunta a memoria: no hay base que reiniciar')
  await abrirBd(base)
  try {
    await borrarTodo()
    const aplicadas = await migrar()
    console.log(`Base nueva: ${base.descripcion} (esquemas ${ESQUEMA} y ${ESQUEMA_GOBIERNO}); migraciones: ${aplicadas.join(', ')}`)
    // Las semillas usan los repositorios; se cargan solo aquí para que migrar() no los arrastre
    const { sembrarBase, sembrarSoloUi } = await import('./semillas/base.js')
    if (orden === 'limpia') {
      console.log('Base limpia: registren a las personas y los puntos desde la app, en «Equipo de prueba».')
    } else if (orden === 'demo') {
      const r = await sembrarBase()
      console.log(`Semilla base: ${r.beneficiarios} personas, punto «${r.punto}», cuenta de Ana Verificada.`)
      console.log('El programa no se siembra: se crea desde la app (HU-01).')
    } else {
      await sembrarSoloUi()
      console.log('Semilla «solo UI» cargada: programa Activo con token FALSO. Sirve para ver pantallas, nunca para pagar.')
    }
  } finally {
    await cerrarBd()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  cli(process.argv[2]).catch((e) => {
    console.error((e as Error).message)
    process.exit(1)
  })
}

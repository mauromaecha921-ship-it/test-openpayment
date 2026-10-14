/**
 * `pnpm --filter api db:pull`: genera src/db/schema.ts leyendo la base, «primero la base» como en
 * la rama de Pablo (su scripts/pos-pull.ts). La fuente de verdad son los SQL de
 * src/db/migraciones/; este script no escribe en ninguna base que no sea la suya.
 *
 *   pnpm --filter api db:pull              arma una base PGlite nueva con las migraciones y la lee
 *   pnpm --filter api db:pull --postgres   lee la DATABASE_URL de PostgreSQL del .env (Supabase),
 *                                          para comprobar que la base real es igual a las migraciones
 *
 * Después de drizzle-kit pull: copia schema.ts a src/db/, cambia `timestamp()` por `instante()`
 * (fechas en texto ISO, src/db/tipos.ts) y quita el parámetro `table` que no se usa. No se copia
 * relations.ts: el piloto no usa consultas relacionales.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { RAIZ_API } from '../src/config.js'
import { abrirBd, cerrarBd } from '../src/db/conexion.js'
import { migrar } from '../src/db/migrar.js'

const desdePostgres = process.argv.includes('--postgres')
const BASE_ESQUEMA = path.join(RAIZ_API, 'data', 'pglite-esquema')
const SALIDA = path.join(RAIZ_API, 'data', 'introspeccion')
const DESTINO = path.join(RAIZ_API, 'src', 'db', 'schema.ts')

async function armarBaseLocal() {
  rmSync(BASE_ESQUEMA, { recursive: true, force: true })
  await abrirBd({ tipo: 'pglite', ruta: BASE_ESQUEMA, descripcion: 'PGlite para leer el esquema' })
  try {
    const aplicadas = await migrar()
    console.log(`Base para leer el esquema: ${aplicadas.join(', ')}`)
  } finally {
    await cerrarBd()
  }
}

function leerConDrizzleKit() {
  rmSync(SALIDA, { recursive: true, force: true })
  const r = spawnSync('pnpm', ['exec', 'drizzle-kit', 'pull'], {
    cwd: RAIZ_API,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ESQUEMA_ORIGEN: desdePostgres ? 'postgres' : 'local' },
  })
  if (r.status !== 0) throw new Error('drizzle-kit pull falló')
}

function posProceso() {
  let codigo = readFileSync(path.join(SALIDA, 'schema.ts'), 'utf8')
  const fechas = codigo.match(/timestamp\(\{ withTimezone: true \}\)/g)?.length ?? 0
  codigo = codigo.replace(/timestamp\(\{ withTimezone: true \}\)/g, 'instante()')
  // Ya no se usa `timestamp` en el import de pg-core
  if (!/\btimestamp\(/.test(codigo)) codigo = codigo.replace(/(import \{[^}]*?)\btimestamp, /, '$1')
  // Fuera de `public`, drizzle-kit nombra `programaInPiloto`, `personaInPiloto_gobierno` o
  // `llaveInPiloto_puente`: se dejan `programa`, `persona` y `llave`, como si estuvieran en `public`
  // (el esquema va igual en cada consulta)
  codigo = codigo
    .replace(/\b(\w+?)InPiloto_gobierno\b/g, '$1')
    .replace(/\b(\w+?)InPiloto_puente\b/g, '$1')
    .replace(/\b(\w+?)InPiloto\b/g, '$1')
  // `(table) => [` sin `table.` (lo corrige igual el pos-pull de Pablo)
  codigo = codigo.replace(/\(table\) => \[([^]*?)\]\);/g, (todo, cuerpo: string) => (cuerpo.includes('table.') ? todo : `() => [${cuerpo}]);`))
  const encabezado =
    '// Generado con «pnpm --filter api db:pull» (scripts/esquema.ts) desde src/db/migraciones/.\n' +
    '// No se edita a mano: se cambia la migración y se vuelve a generar.\n' +
    "import { instante } from './tipos.js'\n"
  writeFileSync(DESTINO, encabezado + codigo)
  console.log(`✅ ${path.relative(RAIZ_API, DESTINO)} · ${fechas} fechas como instante()`)
}

async function principal() {
  if (!desdePostgres) await armarBaseLocal()
  leerConDrizzleKit()
  posProceso()
}

principal().catch((e) => {
  console.error((e as Error).message)
  process.exit(1)
})

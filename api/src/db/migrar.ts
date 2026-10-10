import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { rutaBaseDeDatos } from '../config.js'
import { abrirBd, cerrarBd } from './conexion.js'
import { sembrarBase, sembrarLiquidacionDemo } from './semillas/base.js'

const CARPETA_MIGRACIONES = path.join(import.meta.dirname, 'migraciones')
const SEMILLA_UI = path.join(import.meta.dirname, 'semillas', 'solo-ui.sql')

/** Aplica `migraciones/*.sql` en orden y anota en `migracion` las que ya corrieron. */
export function migrar(bd: DatabaseSync): string[] {
  bd.exec(`CREATE TABLE IF NOT EXISTS migracion (
    nombre TEXT PRIMARY KEY,
    aplicada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT`)
  const hechas = new Set(
    (bd.prepare('SELECT nombre FROM migracion').all() as { nombre: string }[]).map((f) => f.nombre),
  )
  const aplicadas: string[] = []
  for (const archivo of readdirSync(CARPETA_MIGRACIONES).filter((a) => a.endsWith('.sql')).sort()) {
    if (hechas.has(archivo)) continue
    const sql = readFileSync(path.join(CARPETA_MIGRACIONES, archivo), 'utf8')
    bd.exec('BEGIN IMMEDIATE')
    try {
      bd.exec(sql)
      bd.prepare('INSERT INTO migracion (nombre) VALUES (?)').run(archivo)
      bd.exec('COMMIT')
    } catch (e) {
      bd.exec('ROLLBACK')
      throw new Error(`Falló la migración ${archivo}: ${(e as Error).message}`)
    }
    aplicadas.push(archivo)
  }
  return aplicadas
}

/** La semilla «solo UI»: el escenario de db/002_datos_prueba.sql con token falso. Nunca paga. */
export function sembrarSoloUi(bd: DatabaseSync) {
  bd.exec(readFileSync(SEMILLA_UI, 'utf8'))
  sembrarLiquidacionDemo(bd)
}

function borrarArchivo(ruta: string) {
  for (const sufijo of ['', '-wal', '-shm']) {
    if (existsSync(ruta + sufijo)) rmSync(ruta + sufijo)
  }
}

/**
 * `npm run db:reset` (limpia: el equipo se registra desde la app), `npm run db:reset:demo` (las 4
 * personas del guion, con las DEMO_WALLET_*) y `npm run db:semilla:ui` (token falso, nunca paga).
 */
function cli(orden: string | undefined) {
  const ruta = rutaBaseDeDatos()
  if (ruta === ':memory:') throw new Error('DATABASE_URL apunta a memoria: no hay archivo que reiniciar')
  if (orden !== 'limpia' && orden !== 'demo' && orden !== 'semilla-ui') {
    throw new Error('Uso: tsx src/db/migrar.ts limpia | demo | semilla-ui')
  }
  borrarArchivo(ruta)
  const bd = abrirBd(ruta)
  const aplicadas = migrar(bd)
  console.log(`BD nueva en ${path.relative(process.cwd(), ruta)}; migraciones: ${aplicadas.join(', ')}`)
  if (orden === 'limpia') {
    console.log('BD limpia: registren a las personas y los puntos desde la app, en «Equipo de prueba».')
  } else if (orden === 'demo') {
    const r = sembrarBase(bd)
    console.log(`Semilla base: ${r.beneficiarios} personas, punto «${r.punto}», cuenta de Ana Verificada.`)
    console.log('El programa no se siembra: se crea desde la app (HU-01).')
  } else {
    sembrarSoloUi(bd)
    console.log('Semilla «solo UI» cargada: programa Activo con token FALSO. Sirve para ver pantallas, nunca para pagar.')
  }
  cerrarBd()
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    cli(process.argv[2])
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}

// Post-procesa la salida de `drizzle-kit pull` para el flujo DB-First:
//
//   1. Mueve `schema.ts` y `relations.ts` generados (carpeta `out`) a `src/db/`,
//      que es donde apunta `schema` en `drizzle.config.ts`.
//   2. Corrige los callbacks `(table) => [...]` cuyo parámetro no se usa, para
//      que pase `noUnusedParameters` (el proyecto tiene typecheck estricto).
//   3. Re-aplica el `name` real de las FKs de una sola columna.
//
// ¿Por qué el punto 3? `drizzle-kit pull` omite el `name` cuando la FK usa el
// nombre por defecto de Postgres (`<tabla>_<columna>_fkey`), pero Drizzle calcula
// `<tabla>_<col>_<tabla_ref>_<col_ref>_fkey`. Esa diferencia hace que
// `drizzle-kit generate`/`push` quieran renombrar las constraints. Como acá la
// base de datos es la fuente de verdad, volvemos a poner los nombres reales.
//
// Se ejecuta desde `pnpm --filter api db:pull` (ver package.json).
import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { client } from '../src/db/pool'
import drizzleConfig from '../drizzle.config'

const raizApi = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(raizApi, drizzleConfig.out ?? './src/db/migraciones')
const schemaCfg = Array.isArray(drizzleConfig.schema) ? drizzleConfig.schema[0] : drizzleConfig.schema
const schemaPath = resolve(raizApi, schemaCfg ?? './src/db/schema.ts')
const dbDir = dirname(schemaPath)

try {
  // 1) Mover schema.ts y relations.ts desde `out` a src/db/.
  for (const archivo of ['schema.ts', 'relations.ts']) {
    const origen = resolve(outDir, archivo)
    const destino = resolve(dbDir, archivo)
    if (origen === destino) continue
    try {
      await access(origen)
    } catch {
      console.warn(`⚠️  No se generó ${origen}; se omite.`)
      continue
    }
    await rename(origen, destino)
    console.log(`movido: ${origen} → ${destino}`)
  }

  const lineas = (await readFile(schemaPath, 'utf8')).split('\n')

  // 2) `(table) => [` sin usar `table.` rompe `noUnusedParameters`.
  let callbacksCorregidos = 0
  for (let i = 0; i < lineas.length; i++) {
    if (!lineas[i].includes('(table) => [')) continue
    let j = i
    let usaTabla = false
    while (j < lineas.length) {
      if (lineas[j].includes('table.')) usaTabla = true
      if (lineas[j].includes(']);')) break
      j++
    }
    if (!usaTabla) {
      lineas[i] = lineas[i].replace('(table) =>', '() =>')
      callbacksCorregidos++
    }
  }

  // 3) Nombres reales de las FKs de una sola columna (según Postgres).
  const filas = await client`
    select
      c.conrelid::regclass::text as tabla,
      a.attname as columna,
      c.conname as nombre
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
  `
  const fks = new Map<string, string>()
  for (const f of filas) {
    fks.set(`${String(f.tabla).replace(/^public\./, '')}.${f.columna}`, String(f.nombre))
  }

  let tablaActual = ''
  let nombradas = 0
  const sinNombre: string[] = []
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    const mTabla = l.match(/pgTable(?:\.withRLS)?\(\s*"([^"]+)"\s*,/)
    if (mTabla) {
      tablaActual = mTabla[1]
      continue
    }
    if (!l.includes('.references(') || l.includes('name:')) continue
    const mCol = l.match(/^\s*[A-Za-z0-9_]+:\s*[^(]+\(\s*"([^"]+)"\s*\)/)
    if (!mCol) continue

    const nombre = fks.get(`${tablaActual}.${mCol[1]}`)
    if (!nombre) {
      sinNombre.push(`${tablaActual}.${mCol[1]}`)
      continue
    }

    const conConfig = l.replace(
      /(\.references\(\s*\(\)\s*=>\s*[\w.]+)\s*,\s*\{/,
      `$1, { name: "${nombre}",`,
    )
    if (conConfig !== l) {
      lineas[i] = conConfig
      nombradas++
      continue
    }
    const sinConfig = l.replace(
      /(\.references\(\s*\(\)\s*=>\s*[\w.]+)\)/,
      `$1, { name: "${nombre}" })`,
    )
    if (sinConfig !== l) {
      lineas[i] = sinConfig
      nombradas++
      continue
    }
    sinNombre.push(`${tablaActual}.${mCol[1]}`)
  }

  await writeFile(schemaPath, lineas.join('\n'))
  console.log(`✅ callbacks corregidos: ${callbacksCorregidos} · FKs nombradas: ${nombradas}`)
  if (sinNombre.length > 0) {
    console.warn(`⚠️  FKs sin nombre en la base (quedaron sin name): ${sinNombre.join(', ')}`)
  }
} finally {
  await client.end()
}

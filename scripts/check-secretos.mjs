// pnpm check:secretos — busca llaves privadas en los archivos que git vería (Plan backend § 12).
// Revisa el encabezado PEM en texto y codificado en base64, y una OP_PRIVATE_KEY_* con valor.
// Los patrones se arman aquí adentro para que el script no se detecte a sí mismo.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const guiones = '-'.repeat(5)
const encabezado = `${guiones}BEGIN`
const patrones = [
  { nombre: 'encabezado PEM', re: new RegExp(`${encabezado}[A-Z ]*PRIVATE KEY${guiones}`) },
  // base64 de «-----BEGIN» en sus 3 alineaciones posibles dentro de un texto más largo
  ...[encabezado, `x${encabezado}`, `xx${encabezado}`].map((t, i) => ({
    nombre: 'encabezado PEM en base64',
    re: new RegExp(Buffer.from(t).toString('base64').slice(i === 0 ? 0 : 4, 12).replace(/[+/=]/g, '\\$&')),
  })),
  { nombre: 'llave en una variable', re: new RegExp('OP_PRIVATE_KEY_' + '(BASE64|PEM)\\s*=\\s*[A-Za-z0-9+/]{20,}') },
]

const archivos = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const hallazgos = []
for (const archivo of archivos) {
  let contenido
  try {
    if (statSync(archivo).size > 5_000_000) continue
    contenido = readFileSync(archivo, 'utf8')
  } catch {
    continue
  }
  for (const { nombre, re } of patrones) {
    if (re.test(contenido)) hallazgos.push(`${archivo}: ${nombre}`)
  }
}

if (hallazgos.length) {
  console.error(`❌ Posibles secretos en ${hallazgos.length} lugar(es):\n  ${hallazgos.join('\n  ')}`)
  process.exit(1)
}
console.log(`✅ check:secretos: 0 hallazgos en ${archivos.length} archivos`)

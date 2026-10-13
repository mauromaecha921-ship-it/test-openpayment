/**
 * Prueba de D-35: ¿el permiso del programa sigue vivo si la app renueva el token antes de que
 * venza? Rota el token cada `--cada` segundos (por defecto, la mitad de lo que dura) durante
 * `--minutos`, y después de cada rotación lee lo gastado del permiso para confirmar que el
 * token nuevo sirve. Guarda el token nuevo en la BD, así que la API que está corriendo lo usa.
 *
 *   pnpm --filter api exec tsx scripts/mantener-permiso.ts [programaId] [--minutos 20] [--cada 120]
 *
 * Sin programaId toma el programa Activo más reciente. Nunca imprime tokens. Con la base local
 * (PGlite) la API tiene que estar apagada: dos procesos no pueden abrir la misma carpeta.
 */
import '../src/certificados.js'
import { baseDeDatos } from '../src/config.js'
import { abrirBd } from '../src/db/conexion.js'
import * as eventos from '../src/db/repositorios/eventos.js'
import * as programas from '../src/db/repositorios/programas.js'
import * as op from '../src/openPaymentsService.js'
import { conToken, rotarPermiso } from '../src/programas/servicio.js'

const args = process.argv.slice(2)
const opcion = (nombre: string, porDefecto: number) => {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? Number(args[i + 1]) : porDefecto
}
const minutos = opcion('minutos', 20)
const cadaFijo = args.includes('--cada') ? opcion('cada', 120) : null

await abrirBd(baseDeDatos())
const programaId =
  args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? (await programas.listar()).find((p) => p.estado === 'Activo')?.id
if (!programaId) throw new Error('No hay un programa Activo')

const hora = () => new Date().toLocaleTimeString('es-CO')
const espera = (s: number) => new Promise((ok) => setTimeout(ok, s * 1000))

async function gastado(): Promise<string> {
  const g = await conToken(programaId!, (token, p) => op.gastadoDelPermiso({ billeteraPrograma: p.billetera_programa, token }))
  return g ?? '0'
}

console.log(`[${hora()}] Programa ${programaId}: renovando durante ${minutos} min`)
const fin = Date.now() + minutos * 60_000
let n = 0
while (Date.now() < fin) {
  try {
    await rotarPermiso(programaId)
    n += 1
    const detalle = eventos.detalleDe((await eventos.deEntidad('programa', programaId)).at(-1)!)
    const dura = Number(detalle.expiresIn) || null
    const g = await gastado()
    console.log(`[${hora()}] Rotación ${n} ✅ · el token nuevo dura ${dura ?? '?'} s · gastado del permiso: ${g}`)
    const cada = cadaFijo ?? Math.max(30, Math.floor((dura ?? 240) / 2))
    await espera(Math.min(cada, Math.max(1, (fin - Date.now()) / 1000)))
  } catch (e) {
    console.log(`[${hora()}] Rotación ${n + 1} ❌ ${(e as Error).message}`)
    process.exit(1)
  }
}
console.log(`[${hora()}] Listo: ${n} rotaciones seguidas y el permiso sigue vivo.`)

// --probar-vencido: deja vencer el token y prueba si todavía se puede rotar (¿hace falta mantenerlo vivo?)
if (args.includes('--probar-vencido')) {
  const dura = Number(eventos.detalleDe((await eventos.deEntidad('programa', programaId)).at(-1)!).expiresIn) || 600
  console.log(`[${hora()}] Esperando ${dura + 60} s a que el token venza…`)
  await espera(dura + 60)
  try {
    await rotarPermiso(programaId)
    console.log(`[${hora()}] Con el token vencido la rotación ✅ funciona · gastado: ${await gastado()}`)
  } catch (e) {
    console.log(`[${hora()}] Con el token vencido la rotación ❌ falla: ${(e as Error).message}`)
  }
}

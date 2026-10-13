/**
 * Guion de la demo, pasos 2 a 7 (Guía § Guion del video), por HTTP contra la API que está
 * corriendo. Sirve para las puertas de las Fases 3 y 4 y para V-02, V-14 y V-18 con pagos reales.
 *
 *   pnpm --filter api db:reset:demo       semilla base con las wallets del .env
 *   pnpm --filter api start:3100          la API (o pnpm --filter api dev en el 3000)
 *   pnpm --filter api guion               este script; pide aprobar el permiso en la Test Wallet
 *
 * GUION_API cambia la URL (por defecto http://localhost:3100/api). Gasta 2 × el monto base de la
 * liquidación (Ana y Jorge); bájalo con LIQUIDACION_MONTO_BASE si falta saldo.
 * Guarda los resultados en api/data/guion-<fecha>.json.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { config, RAIZ_API } from '../src/config.js'

const API = (process.env.GUION_API ?? 'http://localhost:3100/api').replace(/\/+$/, '')
const ESPERA_APROBACION_MS = 10 * 60_000
const FINALES = ['Pagado', 'Rechazado', 'Fallido']

interface Fila {
  paso: string
  esperado: string
  obtenido: string
  ok: boolean
}
const filas: Fila[] = []
const medidas: Record<string, unknown> = {}

function anotar(paso: string, esperado: string, obtenido: string) {
  const ok = obtenido === esperado
  filas.push({ paso, esperado, obtenido, ok })
  console.log(`${ok ? '✅' : '❌'} ${paso}: ${obtenido}${ok ? '' : ` (se esperaba ${esperado})`}`)
}

type Json = Record<string, any>

async function llamar(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    redirect: 'manual',
  })
  const texto = await res.text()
  return { status: res.status, json: texto ? (JSON.parse(texto) as Json) : {} }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Consulta el cobro cada segundo (POLL_INTERVALO_MS) hasta que termine; mide cuánto tardó. */
async function esperarFinal(id: string, limiteMs = 60_000) {
  const t0 = Date.now()
  let c: Json = {}
  while (Date.now() - t0 < limiteMs) {
    c = (await llamar('GET', `/cobros/${id}`)).json
    if (FINALES.includes(c.estado)) break
    await dormir(1000)
  }
  return { cobro: c, segundos: (Date.now() - t0) / 1000 }
}

const resumen = (c: Json) => `${c.estado}${c.motivo ? ` · ${c.motivo.codigo}` : ''}`

async function main() {
  const cfg = config()
  if (!cfg.DEMO_WALLET_PROGRAMA) throw new Error('Falta DEMO_WALLET_PROGRAMA en api/.env')

  const salud = await llamar('GET', '/salud').catch(() => null)
  if (!salud) throw new Error(`No hay API en ${API}. Arráncala con pnpm --filter api start:3100`)
  if (salud.json.openPayments?.coincide !== true) {
    throw new Error(`La API no está lista para pagar: ${salud.json.openPayments?.detalle ?? 'sin diagnóstico'}`)
  }
  const puntos = (await llamar('GET', '/puntos')).json as unknown as Json[]
  const punto = puntos[0]
  if (!punto) throw new Error('No hay puntos: corre pnpm --filter api db:reset:demo')

  // Paso 2 · la entidad conecta el programa y lo aprueba una vez en su banco (O1, O2)
  const hoy = new Date().toISOString().slice(0, 10)
  const fin = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
  const creado = await llamar('POST', '/programas', {
    entidad: 'Entidad de prueba',
    nombre: `Subsidio adulto mayor (simulado) ${new Date().toISOString().slice(11, 16)}`,
    billetera: cfg.DEMO_WALLET_PROGRAMA,
    vigenciaInicio: hoy,
    vigenciaFin: fin,
  })
  if (creado.status !== 201) throw new Error(`No se creó el programa: ${JSON.stringify(creado.json)}`)
  const programaId = creado.json.id as string
  const autorizar = await llamar('POST', `/programas/${programaId}/autorizar`)
  if (autorizar.status !== 200) throw new Error(`No se pidió la aprobación: ${JSON.stringify(autorizar.json)}`)
  console.log(`\n👉 Aprueba el permiso con tope ${autorizar.json.programa.tope} en la Test Wallet (10 minutos):\n\n   ${autorizar.json.redirect}\n`)

  const t0 = Date.now()
  let programa: Json = {}
  while (Date.now() - t0 < ESPERA_APROBACION_MS) {
    programa = (await llamar('GET', `/programas/${programaId}`)).json
    if (programa.estado !== 'EsperandoAprobacion') break
    await dormir(2000)
  }
  anotar('2 · el programa queda Activo con callback real', 'Activo', programa.estado)
  if (programa.estado !== 'Activo') throw new Error('Sin permiso no se puede seguir')

  // Paso 3 · Ana cobra a su cuenta, sin PIN (P-09)
  const ana = await llamar('POST', '/cobros', { programaId, documento: '900000001', canal: 'cuenta', llaveIdempotencia: randomUUID() })
  const anaFinal = await esperarFinal(ana.json.id)
  medidas.ana = { segundos: anaFinal.segundos, referencia: anaFinal.cobro.referencia }
  anotar('3 · Ana cobra a su cuenta', 'Pagado', resumen(anaFinal.cobro))

  // Paso 4 · Jorge retira en el punto con PIN; se mide del PIN a Pagado (V-14)
  const jorge = await llamar('POST', '/cobros', { programaId, documento: '900000003', canal: 'retiro', puntoId: punto.id, llaveIdempotencia: randomUUID() })
  const tPin = Date.now()
  await llamar('POST', `/cobros/${jorge.json.id}/confirmar`, { pin: '3333' })
  const jorgeFinal = await esperarFinal(jorge.json.id)
  medidas.jorge = { segundosDesdePin: (Date.now() - tPin) / 1000, referencia: jorgeFinal.cobro.referencia }
  anotar('4 · Jorge retira con PIN', 'Pagado', resumen(jorgeFinal.cobro))
  console.log(`   Del PIN a Pagado: ${(medidas.jorge as Json).segundosDesdePin} s (RNF-02 pide 10 s o menos)`)

  // Paso 5 · Jorge intenta otra vez
  const otra = await llamar('POST', '/cobros', { programaId, documento: '900000003', canal: 'retiro', puntoId: punto.id, llaveIdempotencia: randomUUID() })
  anotar('5 · Jorge intenta otra vez', 'Rechazado · YaCobrado', resumen(otra.json))

  // Paso 6 · Rosa, con el retroactivo: el banco lo rechaza por tope (RN-09, V-02)
  const rosa = await llamar('POST', '/cobros', { programaId, documento: '900000004', canal: 'retiro', puntoId: punto.id, llaveIdempotencia: randomUUID() })
  await llamar('POST', `/cobros/${rosa.json.id}/confirmar`, { pin: '4444' })
  const rosaFinal = await esperarFinal(rosa.json.id)
  medidas.rosa = { eventos: rosaFinal.cobro.eventos }
  anotar('6 · Rosa choca con el tope del banco', 'Fallido · TopeSuperado', resumen(rosaFinal.cobro))

  // Tablero: el cobrado sale del permiso (fuente «banco»)
  const t = (await llamar('GET', `/programas/${programaId}/tablero`)).json
  medidas.tablero = { autorizado: t.autorizado, cobrado: t.cobrado, noHaSalido: t.noHaSalido, fuente: t.fuente, reembolsoSegundos: t.reembolsoSegundos }
  anotar('Tablero · fuente del cobrado', 'banco', t.fuente)
  anotar('Tablero · lo que no ha salido', String(BigInt(t.autorizado) - 2n * BigInt(cfg.LIQUIDACION_MONTO_BASE)), t.noHaSalido)

  // Paso 7 · cerrar y Luis llega tarde
  const cierre = await llamar('POST', `/programas/${programaId}/cerrar`, { confirmacion: 'CERRAR' })
  medidas.cierre = cierre.json.cierre
  anotar('7 · el programa se cierra y revoca el permiso', 'Cerrado', cierre.json.programa?.estado ?? `error ${cierre.status}`)
  const luis = await llamar('POST', '/cobros', { programaId, documento: '900000002', canal: 'retiro', puntoId: punto.id, llaveIdempotencia: randomUUID() })
  anotar('7 · Luis intenta después del cierre', 'Rechazado · ProgramaCerrado', resumen(luis.json))

  console.log('\nRevisa a mano en la Test Wallet que se vean las referencias de Ana y Jorge (V-21).')
}

main()
  .catch((e) => {
    console.error(`\n❌ ${(e as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => {
    const fecha = new Date().toISOString().replace(/[:.]/g, '-')
    const carpeta = path.join(RAIZ_API, 'data')
    mkdirSync(carpeta, { recursive: true })
    const archivo = path.join(carpeta, `guion-${fecha}.json`)
    writeFileSync(archivo, JSON.stringify({ fecha, api: API, filas, medidas }, null, 2))
    console.log(`\nResultados en ${path.relative(process.cwd(), archivo)}`)
    if (filas.length) console.table(filas.map(({ paso, obtenido, ok }) => ({ paso, obtenido, ok })))
  })

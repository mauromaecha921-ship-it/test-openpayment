/**
 * Fase 1 (Plan backend § 10): el hito crítico de la Guía en un script, contra la Test Wallet.
 * Responde las preguntas que pueden cambiar el diseño antes de construir la API.
 *
 *   npm run primer-cobro -w api                 pasos 1 a 11
 *   npm run primer-cobro -w api -- --rotar      también rota el token (paso 10)
 *   npm run primer-cobro -w api -- --cancelar   también prueba grant.cancel (paso 12)
 *
 * Usa el adaptador openPaymentsService.ts (AD-07: el SDK se importa solo allí). Imprime una
 * tabla de resultados y la guarda en api/data/primer-cobro-<fecha>.json, SIN tokens.
 * Montos pequeños: MONTO_PRUEBA ($10.000 por defecto) y un tope de dos pagos.
 */
import '../src/certificados.js'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { config, RAIZ_API } from '../src/config.js'
import { formatear } from '../src/comun/montos.js'
import * as op from '../src/openPaymentsService.js'
import { candidatos } from '../src/programas/hash.js'

const args = new Set(process.argv.slice(2))
const PUERTO_CALLBACK = 3001
const ESPERA_APROBACION_MS = 10 * 60_000

interface Fila {
  paso: string
  valida: string
  resultado: string
  ok: boolean | null
}
const filas: Fila[] = []
const extra: Record<string, unknown> = {}

function anotar(paso: string, valida: string, resultado: string, ok: boolean | null) {
  filas.push({ paso, valida, resultado, ok })
  const marca = ok === true ? '✅' : ok === false ? '❌' : '⚠️ '
  console.log(`${marca} [${paso}] ${valida}: ${resultado}`)
}

function describirError(e: unknown) {
  if (e instanceof op.ErrorOP) return { tipo: e.tipo, status: e.status ?? null, code: e.code ?? null, description: e.description ?? null }
  return { tipo: 'Desconocido', mensaje: (e as Error)?.message ?? String(e) }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Paso 3: un receptor local que captura interact_ref y hash del callback. */
function esperarCallback(): { url: string; promesa: Promise<Record<string, string>>; cerrar: () => void } {
  let resolver!: (q: Record<string, string>) => void
  const promesa = new Promise<Record<string, string>>((r) => (resolver = r))
  const servidor = createServer((req, res) => {
    const u = new URL(req.url ?? '/', `http://localhost:${PUERTO_CALLBACK}`)
    if (u.pathname !== '/callback') {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<p>Listo: ya puedes volver a la terminal.</p>')
    resolver(Object.fromEntries(u.searchParams))
  })
  servidor.listen(PUERTO_CALLBACK)
  return { url: `http://localhost:${PUERTO_CALLBACK}/callback`, promesa, cerrar: () => servidor.close() }
}

async function conTiempo<T>(p: Promise<T>, ms: number, que: string): Promise<T> {
  let t: NodeJS.Timeout | undefined
  const limite = new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(`Se agotó la espera: ${que}`)), ms)))
  try {
    return await Promise.race([p, limite])
  } finally {
    clearTimeout(t)
  }
}

/** Pasos 6 y 7: pago entrante de monto fijo y saliente con debitAmount igual; se consulta cada segundo hasta 30 s. */
async function pagar(nombre: string, destino: string, token: string, programa: op.Wallet, monto: number) {
  const moneda = { codigo: programa.codigoMoneda, escala: programa.escala }
  const referencia = `PRUEBA-${nombre.toUpperCase()}-${Date.now().toString().slice(-5)}`
  const t0 = Date.now()
  const entrante = await op.crearPagoEntrante({ billetera: destino, monto, moneda, referencia, descripcion: `Primer cobro · ${referencia}` })
  const saliente = await op.crearPagoSaliente({
    billeteraPrograma: programa.id,
    token,
    urlPagoEntrante: entrante.id,
    monto,
    moneda,
    referencia,
  })
  const estados: unknown[] = [{ t: 0, saliente, entrante }]
  let completo = false
  for (let i = 1; i <= 30 && !completo; i++) {
    await dormir(1000)
    const s = await op.leerPagoSaliente({ url: saliente.id, token })
    const e = await op.leerPagoEntrante({ url: entrante.id, billetera: destino })
    estados.push({ t: i, saliente: s, entrante: e })
    completo = !s.fallido && BigInt(s.enviado) >= BigInt(s.debitado)
    if (completo || s.fallido || e.completado) {
      extra[`pago_${nombre}`] = { referencia, segundos: (Date.now() - t0) / 1000, saliente: s, entrante: e }
      return { completo: completo || e.completado, fallido: s.fallido, segundos: (Date.now() - t0) / 1000, s, e }
    }
  }
  extra[`pago_${nombre}`] = { referencia, estados }
  return { completo: false, fallido: false, segundos: (Date.now() - t0) / 1000, s: null, e: null }
}

async function main() {
  const cfg = config()
  const MONTO = Number(process.env.MONTO_PRUEBA ?? '1000000')
  const faltan = ['DEMO_WALLET_PROGRAMA', 'DEMO_WALLET_ANA', 'DEMO_WALLET_PUNTO'].filter((k) => !cfg[k as keyof typeof cfg])
  if (faltan.length) throw new Error(`Faltan en api/.env: ${faltan.join(', ')}`)

  // 1 · Cliente y llave frente al jwks.json
  const llave = await op.diagnosticoLlave()
  anotar('1', 'Llave y keyId', llave.detalle, llave.coincide)
  if (!llave.coincide) throw new Error('La llave no coincide: corrige api/.env antes de seguir')

  // 2 · Wallets: moneda y escala (V-03)
  const programa = await op.leerWallet(cfg.DEMO_WALLET_PROGRAMA!)
  const ana = await op.leerWallet(cfg.DEMO_WALLET_ANA!)
  const punto = await op.leerWallet(cfg.DEMO_WALLET_PUNTO!)
  for (const [n, w] of Object.entries({ programa, ana, punto })) {
    anotar('2', `Moneda de ${n}`, `${w.codigoMoneda} escala ${w.escala}`, w.codigoMoneda === programa.codigoMoneda && w.escala === programa.escala)
  }
  extra.monedas = { programa: [programa.codigoMoneda, programa.escala], ana: [ana.codigoMoneda, ana.escala], punto: [punto.codigoMoneda, punto.escala] }
  const tope = MONTO * 2
  console.log(`\nMonto de prueba ${formatear(MONTO, programa.escala)} · tope ${formatear(tope, programa.escala)}\n`)

  // 3 y 4 · Permiso de pago saliente con tope y sin receptor (O2, V-08)
  const receptor = esperarCallback()
  const nonce = randomUUID()
  const moneda = { codigo: programa.codigoMoneda, escala: programa.escala }
  let pendiente: op.PermisoPendiente
  try {
    pendiente = await op.pedirPermisoPrograma({ billetera: programa.id, tope, moneda, nonce, urlRetorno: receptor.url })
    anotar('4', 'V-08 · el servidor acepta el client del SDK', 'permiso pendiente de aprobación', true)
  } catch (e) {
    anotar('4', 'V-08 · el servidor acepta el client del SDK', JSON.stringify(describirError(e)), false)
    receptor.cerrar()
    throw e
  }
  console.log('\n👉 Aprueba el permiso en la Test Wallet (tienes 10 minutos):\n')
  console.log(`   ${pendiente.redirect}\n`)

  // 5 · Callback: las 6 variantes del hash (V-05) y grant.continue (V-03)
  const q = await conTiempo(receptor.promesa, ESPERA_APROBACION_MS, 'la aprobación')
  receptor.cerrar()
  if (q.result) {
    anotar('5', 'Callback', `result=${q.result}`, false)
    throw new Error('El permiso no se aprobó')
  }
  const lista = candidatos({ nonceCliente: nonce, nonceCierre: pendiente.nonceCierre, interactRef: q.interact_ref ?? '', urlPermiso: pendiente.urlPermiso })
  const variante = lista.find((c) => c.valor === q.hash)
  extra.hash = { variante: variante?.variante ?? null, grantUrl: variante?.grantUrl ?? null, largo: q.hash?.length ?? 0 }
  anotar('5', 'V-05 · variante del hash', variante ? `${variante.variante} con grant_url «${variante.grantUrl}»` : 'ninguna coincide', !!variante)

  let permiso = await op.continuarPermiso({
    uriContinuacion: pendiente.uriContinuacion,
    tokenContinuacion: pendiente.tokenContinuacion,
    interactRef: q.interact_ref!,
  })
  extra.expiresIn = permiso.expiraEnSeg ?? null
  anotar('5', 'V-03 · duración del token', `expires_in = ${permiso.expiraEnSeg ?? 'sin dato'} s`, null)

  // 6 · Pago 1 al punto (V-10, V-11, V-14, V-21)
  const p1 = await pagar('punto', punto.id, permiso.token, programa, MONTO)
  anotar('6', 'V-10/V-11 · pago al punto se completa', p1.completo ? `completo en ${p1.segundos} s` : `no completó en 30 s (failed=${p1.fallido})`, p1.completo)

  // 7 · Pago 2 a Ana con el mismo token (V-01)
  try {
    const p2 = await pagar('ana', ana.id, permiso.token, programa, MONTO)
    anotar('7', 'V-01 · un permiso sin receptor paga a 2 wallets', p2.completo ? `completo en ${p2.segundos} s` : 'no completó', p2.completo)
  } catch (e) {
    anotar('7', 'V-01 · un permiso sin receptor paga a 2 wallets', JSON.stringify(describirError(e)), false)
  }

  // 8 · Pago 3 supera lo que queda del tope (V-02)
  try {
    const p3 = await pagar('tope', punto.id, permiso.token, programa, MONTO)
    anotar('8', 'V-02 · el banco rechaza al superar el tope', `NO rechazó: completo=${p3.completo} failed=${p3.fallido}`, false)
  } catch (e) {
    const d = describirError(e)
    extra.errorTope = d
    anotar('8', 'V-02 · el banco rechaza al superar el tope', JSON.stringify(d), true)
  }

  // 9 · Gastado del permiso (HU-15)
  const gastado = await op.gastadoDelPermiso({ billeteraPrograma: programa.id, token: permiso.token })
  extra.gastado = gastado
  anotar('9', 'HU-15 · getGrantSpentAmounts', `spentDebitAmount = ${gastado ?? 'null'}`, gastado === String(tope))

  // 10 · Rotar el token y usarlo (opcional, V-03)
  if (args.has('--rotar')) {
    try {
      permiso = await op.rotarToken({ urlGestion: permiso.urlGestion, token: permiso.token })
      const otra = await op.gastadoDelPermiso({ billeteraPrograma: programa.id, token: permiso.token })
      anotar('10', 'V-03 · token.rotate y uso del nuevo', `gastado con el token nuevo = ${otra}`, true)
    } catch (e) {
      anotar('10', 'V-03 · token.rotate y uso del nuevo', JSON.stringify(describirError(e)), false)
    }
  }

  // 11 · Revocar y probar el token revocado (V-07)
  await op.revocarPermiso({ urlGestion: permiso.urlGestion, token: permiso.token })
  try {
    await op.gastadoDelPermiso({ billeteraPrograma: programa.id, token: permiso.token })
    anotar('11', 'V-07 · token.revoke deja el permiso inutilizable', 'el token revocado TODAVÍA responde', false)
  } catch (e) {
    const d = describirError(e)
    extra.errorRevocado = d
    anotar('11', 'V-07 · token.revoke deja el permiso inutilizable', JSON.stringify(d), true)
  }

  // 12 · Opcional: un segundo permiso cancelado con grant.cancel (V-07, V-09)
  if (args.has('--cancelar')) {
    const segundo = await op.pedirPermisoPrograma({ billetera: programa.id, tope: MONTO, moneda, nonce: randomUUID(), urlRetorno: receptor.url })
    try {
      await op.continuarPermiso({ uriContinuacion: segundo.uriContinuacion, tokenContinuacion: segundo.tokenContinuacion, interactRef: 'sin-aprobar' })
      anotar('12', 'V-09 · continue antes de aprobar', 'el servidor lo aceptó (inesperado)', false)
    } catch (e) {
      anotar('12', 'V-09 · continue antes de aprobar', JSON.stringify(describirError(e)), null)
    }
    try {
      await op.cancelarPermisoPendiente({ uriContinuacion: segundo.uriContinuacion, tokenContinuacion: segundo.tokenContinuacion })
      anotar('12', 'V-07 · grant.cancel del pendiente', 'cancelado', true)
    } catch (e) {
      anotar('12', 'V-07 · grant.cancel del pendiente', JSON.stringify(describirError(e)), false)
    }
  }

  console.log('\n13 · Revisa a mano en la Test Wallet: saldos (V-12) y si se ve la referencia en quien recibe (V-21).')
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
    const archivo = path.join(carpeta, `primer-cobro-${fecha}.json`)
    writeFileSync(archivo, JSON.stringify({ fecha, filas, extra }, null, 2))
    console.log(`\nResultados (sin tokens) en ${path.relative(process.cwd(), archivo)}`)
    console.table(filas.map(({ paso, valida, ok }) => ({ paso, valida, ok })))
    process.exit()
  })

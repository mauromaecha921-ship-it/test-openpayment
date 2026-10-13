/**
 * Dobles de prueba: un Open Payments falso que hace cumplir el tope como lo haría el banco
 * (RN-09) y una liquidación que responde desde datos.ts sin HTTP. Ningún valor es real.
 */
import { vi } from 'vitest'
import type * as OP from '../src/openPaymentsService.js'
import type * as Liq from '../src/liquidacion/cliente.js'
import * as datos from '../src/liquidacion/datos.js'

/** Valores que nunca deben aparecer en una respuesta ni en un evento (V-20). */
export const SECRETOS = {
  token: 'token-secreto-de-prueba',
  tokenRotado: 'token-rotado-de-prueba',
  tokenContinuacion: 'continuacion-secreta-de-prueba',
  nonceCierre: 'nonce-del-servidor-de-prueba',
  urlGestion: 'https://auth.prueba.dev/token/gestion-secreta',
  uriContinuacion: 'https://auth.prueba.dev/continue/continuacion-secreta',
}

export const AUTH = 'https://auth.prueba.dev/'

export const estado = {
  gastado: 0,
  tope: 0,
  entrantes: new Map<string, { completado: boolean; recibido: string; esperado: string }>(),
  salientes: new Map<string, { fallido: boolean; debitado: string; enviado: string }>(),
  contador: 0,
  /** Si es true, crearPagoSaliente queda «enviando» (sentAmount 0) hasta que se lea. */
  salientesLentos: false,
  falloAlContinuar: false,
}

export function reiniciarEstado() {
  estado.gastado = 0
  estado.tope = 0
  estado.entrantes.clear()
  estado.salientes.clear()
  estado.contador = 0
  estado.salientesLentos = false
  estado.falloAlContinuar = false
}

type ModuloOP = typeof OP

export function falsoOP(real: ModuloOP) {
  const wallet = async (d: string): Promise<OP.Wallet> => {
    const id = d.replace(/^\$/, 'https://').replace(/\/+$/, '')
    if (id.includes('no-existe')) throw new real.ErrorOP('ErrorOpenPayments', 404)
    return {
      id,
      codigoMoneda: id.includes('usd') ? 'USD' : 'COP',
      escala: 2,
      authServer: AUTH,
      resourceServer: 'https://ilp.prueba.dev',
      nombre: id.split('/').pop(),
    }
  }
  const pendiente = (): OP.PermisoPendiente => ({
    redirect: 'https://auth.prueba.dev/interact/abc',
    nonceCierre: SECRETOS.nonceCierre,
    uriContinuacion: SECRETOS.uriContinuacion,
    tokenContinuacion: SECRETOS.tokenContinuacion,
    urlPermiso: AUTH,
  })
  const fns = {
    leerWallet: vi.fn(wallet),
    diagnosticoLlave: vi.fn(async () => ({ configurado: true, coincide: true, detalle: 'falso' })),
    pedirPermisoPrograma: vi.fn(async (a: { tope: number }) => {
      // Un permiso nuevo (aprobar o renovar) empieza sin gasto
      estado.tope = a.tope
      estado.gastado = 0
      return pendiente()
    }),
    continuarPermiso: vi.fn(async () => {
      if (estado.falloAlContinuar) throw new real.ErrorOP('ErrorOpenPayments', 401, 'invalid_continuation')
      return { token: SECRETOS.token, urlGestion: SECRETOS.urlGestion, expiraEnSeg: 600 }
    }),
    cancelarPermisoPendiente: vi.fn(async () => {}),
    rotarToken: vi.fn(async () => ({ token: SECRETOS.tokenRotado, urlGestion: SECRETOS.urlGestion, expiraEnSeg: 600 })),
    revocarPermiso: vi.fn(async () => {}),
    pedirVerificacionCuenta: vi.fn(async () => pendiente()),
    continuarVerificacion: vi.fn(async () => true),
    crearPagoEntrante: vi.fn(async (a: { billetera: string; monto: number }) => {
      const id = `${a.billetera}/incoming-payments/${++estado.contador}`
      estado.entrantes.set(id, { completado: false, recibido: '0', esperado: String(a.monto) })
      return { id, completado: false, recibido: '0', esperado: String(a.monto) }
    }),
    // El banco hace cumplir el tope: 403 si el pago lo supera (RN-09)
    crearPagoSaliente: vi.fn(async (a: { urlPagoEntrante: string; monto: number; token: string }) => {
      if (estado.gastado + a.monto > estado.tope) throw new real.ErrorOP('TopeSuperado', 403, 'InsufficientGrant')
      estado.gastado += a.monto
      const id = `https://ilp.prueba.dev/outgoing-payments/${++estado.contador}`
      const enviado = estado.salientesLentos ? '0' : String(a.monto)
      const p = { fallido: false, debitado: String(a.monto), enviado }
      estado.salientes.set(id, p)
      if (!estado.salientesLentos) estado.entrantes.set(a.urlPagoEntrante, { completado: true, recibido: String(a.monto), esperado: String(a.monto) })
      return { id, ...p }
    }),
    leerPagoSaliente: vi.fn(async (a: { url: string }) => {
      const p = estado.salientes.get(a.url)!
      p.enviado = p.debitado // al consultarlo, ya terminó
      return { id: a.url, ...p }
    }),
    leerPagoEntrante: vi.fn(async (a: { url: string }) => ({ id: a.url, ...estado.entrantes.get(a.url)! })),
    gastadoDelPermiso: vi.fn(async () => (estado.gastado ? String(estado.gastado) : null)),
  } satisfies Partial<Record<keyof ModuloOP, unknown>>
  return { ...real, ...fns }
}

export function falsaLiquidacion(real: typeof Liq) {
  const personas = async (documentos: string[]) => new Map((await datos.personas(documentos)).map((p) => [p.documento, p]))
  return {
    ...real,
    resumen: vi.fn(async (p: string) => datos.resumen(p)),
    pago: vi.fn(async (p: string, d: string) => datos.pago(p, d)),
    validarPin: vi.fn(async (d: string, p: string) => datos.validarPin(d, p)),
    // Lo que Tatú no guarda (nombre y PIN) lo pide al gobierno (Plan Supabase y pnpm § 3)
    personas: vi.fn(personas),
    persona: vi.fn(async (d: string) => (await personas([d])).get(d)),
    inscribir: vi.fn(async (d: string, nombre: string, pin?: string) => datos.inscribir(d, nombre, pin)),
    ponerPin: vi.fn(async (d: string, pin: string) => datos.ponerPin(d, pin)),
  }
}

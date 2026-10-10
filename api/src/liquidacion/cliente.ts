import { config } from '../config.js'
import { ErrorApi } from '../comun/errores.js'
import { Pago, RespuestaPin, Resumen } from './contrato.js'

/**
 * Lo que usa la API: HTTP contra LIQUIDACION_URL. Si la liquidación no responde, lanza
 * `LiquidacionNoResponde` (HU-02: «No pudimos consultar tu pago; intenta en un momento»).
 */
export class LiquidacionNoResponde extends ErrorApi {
  constructor() {
    super(503, 'LiquidacionNoResponde', 'No pudimos consultar tu pago; intenta en un momento')
  }
}

async function pedir(ruta: string, init?: RequestInit): Promise<{ status: number; cuerpo: unknown }> {
  try {
    const res = await fetch(`${config().LIQUIDACION_URL}${ruta}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status >= 500) throw new LiquidacionNoResponde()
    return { status: res.status, cuerpo: await res.json() }
  } catch (e) {
    if (e instanceof LiquidacionNoResponde) throw e
    throw new LiquidacionNoResponde()
  }
}

function leer<T>(esquema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, v: unknown): T {
  const r = esquema.safeParse(v)
  if (!r.success) throw new LiquidacionNoResponde()
  return r.data
}

export async function resumen(programaId: string): Promise<Resumen> {
  const { cuerpo } = await pedir(`/programas/${encodeURIComponent(programaId)}/resumen`)
  return leer(Resumen, cuerpo)
}

export async function pago(programaId: string, documento: string): Promise<Pago> {
  const { status, cuerpo } = await pedir(
    `/programas/${encodeURIComponent(programaId)}/pagos/${encodeURIComponent(documento)}`,
  )
  if (status === 404) return { disponible: false }
  return leer(Pago, cuerpo)
}

export async function validarPin(documento: string, pin: string): Promise<boolean> {
  const { cuerpo } = await pedir('/pin/validar', { method: 'POST', body: JSON.stringify({ documento, pin }) })
  return leer(RespuestaPin, cuerpo).valido
}

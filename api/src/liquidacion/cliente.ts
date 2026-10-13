import { config } from '../config.js'
import { ErrorApi } from '../comun/errores.js'
import { Pago, Persona, Personas, RespuestaPin, Resumen } from './contrato.js'

/**
 * Lo que usa la API: HTTP contra LIQUIDACION_URL, el sistema del gobierno. Tatú nunca lee su
 * esquema con SQL. Si no responde, lanza `LiquidacionNoResponde` (HU-02: «No pudimos consultar
 * tu pago; intenta en un momento»).
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

/** Nombre y si tiene PIN de varias cédulas, en una sola consulta (las vistas por lote, D-43). */
export async function personas(documentos: string[]): Promise<Map<string, Persona>> {
  const unicos = [...new Set(documentos)]
  if (!unicos.length) return new Map()
  const { cuerpo } = await pedir(`/personas?documentos=${encodeURIComponent(unicos.join(','))}`)
  return new Map(leer(Personas, cuerpo).map((p) => [p.documento, p]))
}

/** La persona en el gobierno, o undefined si no está inscrita. */
export async function persona(documento: string): Promise<Persona | undefined> {
  return (await personas([documento])).get(documento)
}

/** «Equipo de prueba» la inscribe en el gobierno (o la actualiza). */
export async function inscribir(documento: string, nombre: string, pin?: string): Promise<Persona> {
  const { status, cuerpo } = await pedir('/personas', { method: 'POST', body: JSON.stringify({ documento, nombre, pin }) })
  if (status !== 200) throw new LiquidacionNoResponde()
  return leer(Persona, cuerpo)
}

/** Pone o cambia el PIN. false si la cédula no está en la liquidación. */
export async function ponerPin(documento: string, pin: string): Promise<boolean> {
  const { status } = await pedir(`/personas/${encodeURIComponent(documento)}/pin`, { method: 'POST', body: JSON.stringify({ pin }) })
  if (status === 404) return false
  if (status !== 200) throw new LiquidacionNoResponde()
  return true
}

import { config } from '../config.js'
import { ErrorApi } from '../comun/errores.js'
import { Coincidencia, Llave, Llaves, Resolucion, type TipoLlave } from './contrato.js'

/**
 * Lo que usa la API: HTTP contra el banco puente de Bre-B (PUENTE_URL; por defecto, el simulador en
 * `${API_BASE_URL}/puente`). Tatú nunca lee su esquema con SQL. Si no responde, lanza
 * `PuenteNoResponde`.
 */
export class PuenteNoResponde extends ErrorApi {
  constructor() {
    super(503, 'PuenteNoResponde', 'No pudimos consultar Bre-B; intenta en un momento')
  }
}

/** Una llave que el banco no aceptó al registrarla (Equipo de prueba). */
export class LlaveRechazada extends ErrorApi {}

export function urlPuente(): string {
  const c = config()
  return c.PUENTE_URL ?? `${c.API_BASE_URL}/puente`
}

async function pedir(ruta: string, init?: RequestInit): Promise<{ status: number; cuerpo: unknown }> {
  try {
    const res = await fetch(`${urlPuente()}${ruta}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status >= 500) throw new PuenteNoResponde()
    return { status: res.status, cuerpo: res.status === 204 ? null : await res.json() }
  } catch (e) {
    if (e instanceof PuenteNoResponde) throw e
    throw new PuenteNoResponde()
  }
}

function leer<T>(esquema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, v: unknown): T {
  const r = esquema.safeParse(v)
  if (!r.success) throw new PuenteNoResponde()
  return r.data
}

const ruta = (tipo: TipoLlave, valor: string) => `/llaves/${encodeURIComponent(tipo)}/${encodeURIComponent(valor)}`

/** A qué wallet llega la llave y el titular enmascarado; null si no existe en Bre-B. */
export async function resolverLlave(tipo: TipoLlave, valor: string): Promise<Resolucion | null> {
  const { status, cuerpo } = await pedir(ruta(tipo, valor))
  if (status === 404) return null
  return leer(Resolucion, cuerpo)
}

/** RN-16: ¿el titular de la llave es esta cédula? null si la llave no existe. */
export async function pertenece(tipo: TipoLlave, valor: string, documento: string): Promise<boolean | null> {
  const { status, cuerpo } = await pedir(`${ruta(tipo, valor)}/pertenece`, { method: 'POST', body: JSON.stringify({ documento }) })
  if (status === 404) return null
  return leer(Coincidencia, cuerpo).pertenece
}

// «Equipo de prueba» hace de banco de cada persona: registra y borra sus llaves

export async function llavesDe(documento: string): Promise<Llave[]> {
  const { status, cuerpo } = await pedir(`/llaves?documento=${encodeURIComponent(documento)}`)
  if (status !== 200) throw new PuenteNoResponde()
  return leer(Llaves, cuerpo)
}

export async function registrarLlave(l: Llave): Promise<Llave> {
  const { status, cuerpo } = await pedir('/llaves', { method: 'POST', body: JSON.stringify(l) })
  if (status === 200 || status === 201) return leer(Llave, cuerpo)
  const e = (cuerpo as { error?: { codigo?: string; mensaje?: string } } | null)?.error
  if (e?.codigo && e.mensaje && [400, 409, 422].includes(status)) throw new LlaveRechazada(status, e.codigo, e.mensaje)
  throw new PuenteNoResponde()
}

/** false si la llave no existía. */
export async function borrarLlave(tipo: TipoLlave, valor: string): Promise<boolean> {
  const { status } = await pedir(ruta(tipo, valor), { method: 'DELETE' })
  if (status === 404) return false
  if (status !== 204) throw new PuenteNoResponde()
  return true
}

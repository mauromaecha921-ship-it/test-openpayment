import { and, desc, eq, inArray } from 'drizzle-orm'
import type { EstadoCuenta } from '../../programas/estados.js'
import { ejecutor, esUuid } from '../conexion.js'
import { cuenta_beneficiario as cuenta } from '../schema.js'

export type FilaCuenta = typeof cuenta.$inferSelect

export type NuevaCuenta = Pick<FilaCuenta, 'id' | 'beneficiario_id' | 'billetera' | 'estado'> &
  Partial<Pick<FilaCuenta, 'verificada_en' | 'nonce_cliente' | 'nonce_cierre' | 'uri_continuacion' | 'token_continuacion' | 'tipo_llave' | 'llave'>>

const VIGENTE = ['PorVerificar', 'Verificada'] as const

export async function obtener(id: string): Promise<FilaCuenta | undefined> {
  if (!esUuid(id)) return undefined
  const [c] = await ejecutor().select().from(cuenta).where(eq(cuenta.id, id)).limit(1)
  return c
}

/** Varias cuentas en una sola consulta (las vistas por lote, D-43). */
export async function deIds(ids: string[]): Promise<Map<string, FilaCuenta>> {
  const validos = [...new Set(ids)].filter(esUuid)
  if (!validos.length) return new Map()
  const filas = await ejecutor().select().from(cuenta).where(inArray(cuenta.id, validos))
  return new Map(filas.map((c) => [c.id, c]))
}

/** La cuenta vigente (PorVerificar o Verificada) de la persona, si tiene. */
export async function vigenteDe(beneficiarioId: string): Promise<FilaCuenta | undefined> {
  const [c] = await ejecutor()
    .select()
    .from(cuenta)
    .where(and(eq(cuenta.beneficiario_id, beneficiarioId), inArray(cuenta.estado, [...VIGENTE])))
    .limit(1)
  return c
}

/** La vigente o, si no hay, la más reciente (para mostrar el estado). */
export async function ultimaDe(beneficiarioId: string): Promise<FilaCuenta | undefined> {
  const vigente = await vigenteDe(beneficiarioId)
  if (vigente) return vigente
  const [c] = await ejecutor()
    .select()
    .from(cuenta)
    .where(eq(cuenta.beneficiario_id, beneficiarioId))
    .orderBy(desc(cuenta.creado_en))
    .limit(1)
  return c
}

/** La última cuenta de cada persona (la lista del equipo), en una sola consulta. */
export async function ultimasDe(beneficiarioIds: string[]): Promise<Map<string, FilaCuenta>> {
  const mapa = new Map<string, FilaCuenta>()
  if (!beneficiarioIds.length) return mapa
  const filas = await ejecutor()
    .select()
    .from(cuenta)
    .where(inArray(cuenta.beneficiario_id, [...new Set(beneficiarioIds)]))
    .orderBy(desc(cuenta.creado_en))
  for (const c of filas) {
    const actual = mapa.get(c.beneficiario_id)
    // La vigente gana; si no hay, la más reciente (la primera en llegar)
    const esVigente = (x: FilaCuenta) => (VIGENTE as readonly string[]).includes(x.estado)
    if (!actual || (!esVigente(actual) && esVigente(c))) mapa.set(c.beneficiario_id, c)
  }
  return mapa
}

export async function crear(datos: NuevaCuenta) {
  await ejecutor().insert(cuenta).values(datos)
}

export async function actualizar(
  id: string,
  campos: Partial<Omit<FilaCuenta, 'id' | 'creado_en'>>,
  estadoEsperado?: EstadoCuenta,
): Promise<boolean> {
  const condicion = estadoEsperado ? and(eq(cuenta.id, id), eq(cuenta.estado, estadoEsperado)) : eq(cuenta.id, id)
  const filas = await ejecutor().update(cuenta).set(campos).where(condicion).returning({ id: cuenta.id })
  return filas.length === 1
}

/** La cuenta vigente que ya usa esa wallet, de cualquier persona. */
export async function vigentePorBilletera(billetera: string): Promise<FilaCuenta | undefined> {
  const [c] = await ejecutor()
    .select()
    .from(cuenta)
    .where(and(eq(cuenta.billetera, billetera), inArray(cuenta.estado, [...VIGENTE])))
    .limit(1)
  return c
}

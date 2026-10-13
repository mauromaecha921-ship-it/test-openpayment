import { and, desc, eq, inArray } from 'drizzle-orm'
import { ejecutor } from '../conexion.js'
import { evento } from '../schema.js'

export type TipoEntidad = 'programa' | 'cuenta' | 'cobro' | 'beneficiario'
export type FilaEvento = typeof evento.$inferSelect

/**
 * Quién hizo el cambio (RNF-09, `evento.actor` de db/003): el rol y, si aplica, su id. Nunca la
 * cédula. La base exige la forma «rol» o «rol:uuid».
 */
export type Actor = 'sistema' | 'entidad' | 'banco' | `punto:${string}` | `beneficiario:${string}`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const actorPunto = (id: string): Actor => (UUID.test(id) ? `punto:${id.toLowerCase()}` : 'sistema')
export const actorBeneficiario = (id: string): Actor => (UUID.test(id) ? `beneficiario:${id.toLowerCase()}` : 'sistema')

/**
 * Escribe un evento (solo inserción). `detalle` nunca lleva tokens, PIN, llaves ni datos
 * personales: la cédula va enmascarada.
 */
export async function registrar(args: {
  tipo: TipoEntidad
  id: string
  desde?: string | null
  hacia?: string | null
  detalle?: Record<string, unknown>
  actor?: Actor
}) {
  await ejecutor()
    .insert(evento)
    .values({
      tipo_entidad: args.tipo,
      id_entidad: args.id,
      estado_anterior: args.desde ?? null,
      estado_nuevo: args.hacia ?? null,
      detalle: args.detalle ?? {},
      actor: args.actor ?? 'sistema',
    })
}

export async function deEntidad(tipo: TipoEntidad, id: string): Promise<FilaEvento[]> {
  return ejecutor()
    .select()
    .from(evento)
    .where(and(eq(evento.tipo_entidad, tipo), eq(evento.id_entidad, id)))
    .orderBy(evento.id)
}

/** Los eventos de varias entidades en una sola consulta, en orden (las vistas por lote, D-43). */
export async function deEntidades(tipo: TipoEntidad, ids: string[]): Promise<Map<string, FilaEvento[]>> {
  const mapa = new Map<string, FilaEvento[]>()
  if (!ids.length) return mapa
  const filas = await ejecutor()
    .select()
    .from(evento)
    .where(and(eq(evento.tipo_entidad, tipo), inArray(evento.id_entidad, [...new Set(ids)])))
    .orderBy(evento.id)
  for (const e of filas) mapa.set(e.id_entidad, [...(mapa.get(e.id_entidad) ?? []), e])
  return mapa
}

/** El último evento que llevó la entidad a ese estado (para vencimientos y tiempos). */
export async function ultimoHacia(tipo: TipoEntidad, id: string, estado: string): Promise<FilaEvento | undefined> {
  const [e] = await ejecutor()
    .select()
    .from(evento)
    .where(and(eq(evento.tipo_entidad, tipo), eq(evento.id_entidad, id), eq(evento.estado_nuevo, estado)))
    .orderBy(desc(evento.id))
    .limit(1)
  return e
}

/** Lo mismo que `ultimoHacia`, sobre una lista ya cargada. */
export function ultimoHaciaEn(lista: FilaEvento[] | undefined, estado: string): FilaEvento | undefined {
  return lista?.findLast((e) => e.estado_nuevo === estado)
}

export function detalleDe(e: FilaEvento): Record<string, unknown> {
  return (e.detalle ?? {}) as Record<string, unknown>
}

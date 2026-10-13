import { and, asc, eq, exists, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { ejecutor, esUuid } from '../conexion.js'
import { comercio, programa_categoria, programa_punto, punto } from '../schema.js'

export type FilaPunto = typeof punto.$inferSelect

export async function crear(datos: Omit<FilaPunto, 'id' | 'comercio_id'> & { id?: string; comercio_id?: string | null }): Promise<FilaPunto> {
  const [p] = await ejecutor().insert(punto).values(datos).returning()
  return p!
}

export async function obtener(id: string): Promise<FilaPunto | undefined> {
  if (!esUuid(id)) return undefined
  const [p] = await ejecutor().select().from(punto).where(eq(punto.id, id)).limit(1)
  return p
}

/** Varios puntos en una sola consulta (las vistas por lote, D-43). */
export async function deIds(ids: string[]): Promise<Map<string, FilaPunto>> {
  const validos = [...new Set(ids)].filter(esUuid)
  if (!validos.length) return new Map()
  const filas = await ejecutor().select().from(punto).where(inArray(punto.id, validos))
  return new Map(filas.map((p) => [p.id, p]))
}

export async function porBilletera(billetera: string): Promise<FilaPunto | undefined> {
  const [p] = await ejecutor().select().from(punto).where(eq(punto.billetera, billetera)).limit(1)
  return p
}

export async function listar(): Promise<FilaPunto[]> {
  return ejecutor().select().from(punto).orderBy(asc(punto.nombre))
}

/** Las sedes de varios comercios, en una sola consulta. */
export async function sedesDe(comercioIds: string[]): Promise<Map<string, FilaPunto[]>> {
  const mapa = new Map<string, FilaPunto[]>()
  const validos = [...new Set(comercioIds)].filter(esUuid)
  if (!validos.length) return mapa
  const filas = await ejecutor().select().from(punto).where(inArray(punto.comercio_id, validos)).orderBy(asc(punto.nombre))
  for (const p of filas) mapa.set(p.comercio_id!, [...(mapa.get(p.comercio_id!) ?? []), p])
  return mapa
}

/** El punto está en la lista de comercios del bono (`programa_punto`, extra HU-21). */
const enLista = (programaId: string) =>
  ejecutor()
    .select({ si: sql`1` })
    .from(programa_punto)
    .where(and(eq(programa_punto.programa_id, programaId), eq(programa_punto.punto_id, punto.id)))

/** § 11: la sede es de un comercio verificado cuya categoría acepta el bono (D-38, D-39). */
const porCategoria = (programaId: string) =>
  ejecutor()
    .select({ si: sql`1` })
    .from(comercio)
    .innerJoin(programa_categoria, and(eq(programa_categoria.programa_id, programaId), eq(programa_categoria.categoria, comercio.categoria)))
    .where(and(eq(comercio.id, punto.comercio_id), isNotNull(comercio.verificado_en)))

/**
 * ¿Este punto puede cobrar este bono? Por la lista de comercios o por categoría. Es la misma
 * regla que hace cumplir el trigger `fn_cobro_reglas` (010_piloto.sql).
 */
export async function autorizadoEnPrograma(programaId: string, puntoId: string): Promise<boolean> {
  if (!esUuid(programaId) || !esUuid(puntoId)) return false
  const filas = await ejecutor()
    .select({ id: punto.id })
    .from(punto)
    .where(and(eq(punto.id, puntoId), eq(punto.tipo, 'compra'), or(exists(enLista(programaId)), exists(porCategoria(programaId)))))
    .limit(1)
  return filas.length === 1
}

/** Las sedes donde se puede usar un bono (lo que ve el beneficiario). */
export async function autorizadosEnPrograma(programaId: string): Promise<FilaPunto[]> {
  if (!esUuid(programaId)) return []
  return ejecutor()
    .select()
    .from(punto)
    .where(and(eq(punto.tipo, 'compra'), or(exists(enLista(programaId)), exists(porCategoria(programaId)))))
    .orderBy(asc(punto.nombre))
}

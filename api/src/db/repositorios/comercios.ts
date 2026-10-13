import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { ahoraIso, ejecutor, esUuid } from '../conexion.js'
import { comercio, programa_categoria } from '../schema.js'

export type FilaComercio = typeof comercio.$inferSelect

export async function crear(datos: Pick<FilaComercio, 'nit' | 'razon_social' | 'ciiu' | 'categoria'>): Promise<FilaComercio> {
  const [c] = await ejecutor().insert(comercio).values(datos).returning()
  return c!
}

export async function obtener(id: string): Promise<FilaComercio | undefined> {
  if (!esUuid(id)) return undefined
  const [c] = await ejecutor().select().from(comercio).where(eq(comercio.id, id)).limit(1)
  return c
}

/** Varios comercios en una sola consulta (las vistas por lote, D-43). */
export async function deIds(ids: string[]): Promise<Map<string, FilaComercio>> {
  const validos = [...new Set(ids)].filter(esUuid)
  if (!validos.length) return new Map()
  const filas = await ejecutor().select().from(comercio).where(inArray(comercio.id, validos))
  return new Map(filas.map((c) => [c.id, c]))
}

export async function porNit(nit: string): Promise<FilaComercio | undefined> {
  const [c] = await ejecutor().select().from(comercio).where(eq(comercio.nit, nit)).limit(1)
  return c
}

export async function listar(): Promise<FilaComercio[]> {
  return ejecutor().select().from(comercio).orderBy(asc(comercio.razon_social))
}

/** La entidad lo verificó (en producción, contra el RUT y el RUES). Devuelve si cambió. */
export async function verificar(id: string): Promise<boolean> {
  const filas = await ejecutor()
    .update(comercio)
    .set({ verificado_en: ahoraIso() })
    .where(and(eq(comercio.id, id), isNull(comercio.verificado_en)))
    .returning({ id: comercio.id })
  return filas.length === 1
}

// ── Categorías que acepta cada bono ──────────────────────────────────────────

export async function categoriasDe(programaId: string): Promise<string[]> {
  return (await categoriasDeVarios([programaId])).get(programaId) ?? []
}

/** Las categorías de varios programas, en una sola consulta. */
export async function categoriasDeVarios(programaIds: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  const validos = [...new Set(programaIds)].filter(esUuid)
  if (!validos.length) return mapa
  const filas = await ejecutor()
    .select()
    .from(programa_categoria)
    .where(inArray(programa_categoria.programa_id, validos))
    .orderBy(asc(programa_categoria.categoria))
  for (const f of filas) mapa.set(f.programa_id, [...(mapa.get(f.programa_id) ?? []), f.categoria])
  return mapa
}

export async function ponerCategorias(programaId: string, categorias: string[]) {
  await ejecutor().delete(programa_categoria).where(eq(programa_categoria.programa_id, programaId))
  const unicas = [...new Set(categorias)]
  if (unicas.length) {
    await ejecutor()
      .insert(programa_categoria)
      .values(unicas.map((categoria) => ({ programa_id: programaId, categoria })))
  }
}

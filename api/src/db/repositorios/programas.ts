import { and, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { EstadoPrograma } from '../../programas/estados.js'
import { ejecutor, esUuid } from '../conexion.js'
import { programa } from '../schema.js'

export type FilaPrograma = typeof programa.$inferSelect

export type CamposPrograma = Partial<Omit<FilaPrograma, 'id' | 'creado_en'>>

export type NuevoPrograma = Pick<
  FilaPrograma,
  | 'entidad'
  | 'nombre'
  | 'tipo'
  | 'destino'
  | 'billetera_programa'
  | 'codigo_moneda'
  | 'escala_moneda'
  | 'vigencia_inicio'
  | 'vigencia_fin'
> &
  Partial<Pick<FilaPrograma, 'monto_por_persona'>>

export async function crear(datos: NuevoPrograma): Promise<FilaPrograma> {
  const [p] = await ejecutor().insert(programa).values(datos).returning()
  return p!
}

export async function obtener(id: string): Promise<FilaPrograma | undefined> {
  if (!esUuid(id)) return undefined
  const [p] = await ejecutor().select().from(programa).where(eq(programa.id, id)).limit(1)
  return p
}

/** Varios programas en una sola consulta (las vistas por lote, D-43). */
export async function deIds(ids: string[]): Promise<Map<string, FilaPrograma>> {
  const validos = [...new Set(ids)].filter(esUuid)
  if (!validos.length) return new Map()
  const filas = await ejecutor().select().from(programa).where(inArray(programa.id, validos))
  return new Map(filas.map((p) => [p.id, p]))
}

/** En orden de creación, el más reciente primero. */
export async function listar(): Promise<FilaPrograma[]> {
  return ejecutor().select().from(programa).orderBy(desc(programa.creado_en), desc(programa.id))
}

/**
 * Actualiza campos; con `estadoEsperado`, solo si el programa sigue en ese estado (así dos
 * callbacks no activan dos veces). Devuelve si cambió.
 */
export async function actualizar(id: string, campos: CamposPrograma, estadoEsperado?: EstadoPrograma): Promise<boolean> {
  if (!esUuid(id)) return false
  const condicion = estadoEsperado ? and(eq(programa.id, id), eq(programa.estado, estadoEsperado)) : eq(programa.id, id)
  const filas = await ejecutor().update(programa).set(campos).where(condicion).returning({ id: programa.id })
  return filas.length === 1
}

/** D-35: los programas cuyo token hay que rotar en segundo plano. */
export async function conPermisoVigente(): Promise<{ id: string }[]> {
  return ejecutor()
    .select({ id: programa.id })
    .from(programa)
    .where(and(inArray(programa.estado, ['Activo', 'Pausado']), isNotNull(programa.token_acceso), isNull(programa.permiso_vencido_en)))
}

/** /estado: cuántos programas abiertos tienen el token falso de la semilla «solo UI». */
export async function cuantosConToken(token: string): Promise<number> {
  const [f] = await ejecutor()
    .select({ n: count() })
    .from(programa)
    .where(and(inArray(programa.estado, ['Activo', 'Pausado']), eq(programa.token_acceso, token)))
  return f?.n ?? 0
}

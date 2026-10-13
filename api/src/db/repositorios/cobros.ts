import { and, asc, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { EstadoCobro } from '../../cobros/estados.js'
import { ejecutor, esUuid } from '../conexion.js'
import { cobro } from '../schema.js'

export type FilaCobro = typeof cobro.$inferSelect

export type NuevoCobro = Pick<FilaCobro, 'programa_id' | 'beneficiario_id' | 'canal' | 'llave_idempotencia'> &
  Partial<Pick<FilaCobro, 'punto_id' | 'cuenta_id' | 'total_compra' | 'monto' | 'motivo_rechazo'>> & {
    estado: 'Solicitado' | 'PorConfirmar' | 'Rechazado'
  }

/** La referencia (SUB-0001…) la pone la base con `cobro_referencia_seq` (db/001). */
export async function crear(datos: NuevoCobro): Promise<FilaCobro> {
  const [c] = await ejecutor().insert(cobro).values(datos).returning()
  return c!
}

export async function obtener(id: string): Promise<FilaCobro | undefined> {
  if (!esUuid(id)) return undefined
  const [c] = await ejecutor().select().from(cobro).where(eq(cobro.id, id)).limit(1)
  return c
}

export async function porLlave(llave: string): Promise<FilaCobro | undefined> {
  const [c] = await ejecutor().select().from(cobro).where(eq(cobro.llave_idempotencia, llave)).limit(1)
  return c
}

/** El cobro vivo o pagado de la persona en el programa (lo que vigila el índice de RN-02). */
export async function vivoDe(programaId: string, beneficiarioId: string): Promise<FilaCobro | undefined> {
  const [c] = await ejecutor()
    .select()
    .from(cobro)
    .where(
      and(
        eq(cobro.programa_id, programaId),
        eq(cobro.beneficiario_id, beneficiarioId),
        inArray(cobro.estado, ['Solicitado', 'PorConfirmar', 'Pagando', 'Pagado']),
      ),
    )
    .limit(1)
  return c
}

/**
 * Bloqueo optimista (HU-14): UPDATE … WHERE id = ? AND version = ?. El trigger de db/001 sube
 * `version` y `actualizado_en`. Si no cambió ninguna fila, otra petición ganó y se devuelve false.
 */
export async function actualizar(
  id: string,
  versionEsperada: number,
  campos: Partial<Omit<FilaCobro, 'id' | 'version' | 'creado_en' | 'actualizado_en'>>,
): Promise<boolean> {
  const filas = await ejecutor()
    .update(cobro)
    .set(campos)
    .where(and(eq(cobro.id, id), eq(cobro.version, versionEsperada)))
    .returning({ id: cobro.id })
  return filas.length === 1
}

const recientePrimero = [desc(cobro.creado_en), desc(cobro.referencia)] as const

export async function dePrograma(programaId: string): Promise<FilaCobro[]> {
  return ejecutor()
    .select()
    .from(cobro)
    .where(eq(cobro.programa_id, programaId))
    .orderBy(...recientePrimero)
}

export async function dePunto(puntoId: string, desde?: string): Promise<FilaCobro[]> {
  const condicion = desde ? and(eq(cobro.punto_id, puntoId), gte(cobro.creado_en, desde)) : eq(cobro.punto_id, puntoId)
  return ejecutor()
    .select()
    .from(cobro)
    .where(condicion)
    .orderBy(...recientePrimero)
}

export async function deBeneficiario(beneficiarioId: string): Promise<FilaCobro[]> {
  return ejecutor()
    .select()
    .from(cobro)
    .where(eq(cobro.beneficiario_id, beneficiarioId))
    .orderBy(...recientePrimero)
}

export async function enEstado(estado: EstadoCobro): Promise<FilaCobro[]> {
  return ejecutor().select().from(cobro).where(eq(cobro.estado, estado)).orderBy(asc(cobro.actualizado_en))
}

export async function cuantosEnEstado(programaId: string, estado: EstadoCobro): Promise<number> {
  const [f] = await ejecutor()
    .select({ n: count() })
    .from(cobro)
    .where(and(eq(cobro.programa_id, programaId), eq(cobro.estado, estado)))
  return f?.n ?? 0
}

async function suma(programaId: string, estados: EstadoCobro[]): Promise<number> {
  const [f] = await ejecutor()
    .select({ total: sql<number>`coalesce(sum(${cobro.monto}), 0)`.mapWith(Number) })
    .from(cobro)
    .where(and(eq(cobro.programa_id, programaId), inArray(cobro.estado, estados)))
  return f?.total ?? 0
}

/** Lo que ya salió o está saliendo (Pagado y Pagando): al renovar el permiso, eso ya no cabe en el nuevo. */
export const sumaComprometida = (programaId: string) => suma(programaId, ['Pagado', 'Pagando'])

export const sumaPagada = (programaId: string) => suma(programaId, ['Pagado'])

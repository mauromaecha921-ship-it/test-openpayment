import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { ejecutor, esUuid } from '../conexion.js'
import { beneficiario } from '../schema.js'

/**
 * La persona en Tatú: solo tipo y número de documento (`beneficiario` de db/001, «somos
 * pasarela»). El nombre y el PIN son del gobierno: se piden a la liquidación (D-01, D-31).
 */
export type FilaBeneficiario = typeof beneficiario.$inferSelect

/** La persona por su cédula. */
export async function porDocumento(documento: string): Promise<FilaBeneficiario | undefined> {
  const [b] = await ejecutor()
    .select()
    .from(beneficiario)
    .where(eq(beneficiario.numero_documento, documento))
    .orderBy(desc(sql`${beneficiario.tipo_documento} = 'CC'`))
    .limit(1)
  return b
}

export async function obtener(id: string): Promise<FilaBeneficiario | undefined> {
  if (!esUuid(id)) return undefined
  const [b] = await ejecutor().select().from(beneficiario).where(eq(beneficiario.id, id)).limit(1)
  return b
}

/** Varias personas en una sola consulta (las vistas por lote, D-43). */
export async function deIds(ids: string[]): Promise<Map<string, FilaBeneficiario>> {
  const validos = [...new Set(ids)].filter(esUuid)
  if (!validos.length) return new Map()
  const filas = await ejecutor().select().from(beneficiario).where(inArray(beneficiario.id, validos))
  return new Map(filas.map((b) => [b.id, b]))
}

export async function listar(): Promise<FilaBeneficiario[]> {
  return ejecutor().select().from(beneficiario).orderBy(asc(beneficiario.numero_documento))
}

/** Registro del equipo: la cédula (como C.C.); el id lo puede fijar la semilla. */
export async function crear(p: { id?: string; numero_documento: string }): Promise<FilaBeneficiario> {
  const [b] = await ejecutor()
    .insert(beneficiario)
    .values({ ...(p.id ? { id: p.id } : {}), tipo_documento: 'CC', numero_documento: p.numero_documento })
    .returning()
  return b!
}

import { and, asc, eq } from 'drizzle-orm'
import { ejecutor } from '../db/conexion.js'
import { llave } from '../db/schema.js'
import type { Llave, TipoLlave } from './contrato.js'

/**
 * Datos del banco puente simulado, en el esquema `piloto_puente` (030_puente.sql). Solo los usan
 * su router y las pruebas: la API de Tatú los pide por HTTP (`cliente.ts`), como haría con el
 * banco real.
 */
type FilaLlave = typeof llave.$inferSelect

const aLlave = (f: FilaLlave): Llave => ({
  tipo: f.tipo as TipoLlave,
  valor: f.valor,
  documentoTitular: f.documento_titular,
  nombreTitular: f.nombre_titular,
  billetera: f.billetera,
})

export async function obtener(tipo: TipoLlave, valor: string): Promise<Llave | undefined> {
  const [f] = await ejecutor()
    .select()
    .from(llave)
    .where(and(eq(llave.tipo, tipo), eq(llave.valor, valor)))
    .limit(1)
  return f ? aLlave(f) : undefined
}

export async function deTitular(documento: string): Promise<Llave[]> {
  const filas = await ejecutor().select().from(llave).where(eq(llave.documento_titular, documento)).orderBy(asc(llave.creado_en))
  return filas.map(aLlave)
}

export type ResultadoRegistro = 'creada' | 'actualizada' | 'deOtro'

/**
 * Registra la llave o, si ya era de esa misma persona, cambia la wallet a la que llega (así se
 * prueba RN-18: la persona movió su llave a otro banco). Si es de otra persona, no se toca.
 */
export async function registrar(l: Llave): Promise<ResultadoRegistro> {
  const previa = await obtener(l.tipo, l.valor)
  if (previa && previa.documentoTitular !== l.documentoTitular) return 'deOtro'
  await ejecutor()
    .insert(llave)
    .values({ tipo: l.tipo, valor: l.valor, documento_titular: l.documentoTitular, nombre_titular: l.nombreTitular, billetera: l.billetera })
    .onConflictDoUpdate({ target: [llave.tipo, llave.valor], set: { nombre_titular: l.nombreTitular, billetera: l.billetera } })
  return previa ? 'actualizada' : 'creada'
}

export async function borrar(tipo: TipoLlave, valor: string): Promise<boolean> {
  const filas = await ejecutor()
    .delete(llave)
    .where(and(eq(llave.tipo, tipo), eq(llave.valor, valor)))
    .returning({ valor: llave.valor })
  return filas.length === 1
}

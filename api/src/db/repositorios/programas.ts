// Repositorio de `programa` (O1 · HU-01) sobre Drizzle.
//
// La moneda ya viene resuelta por `programas/servicio.ts`; aquí solo se inserta
// la fila. El programa nace en Borrador: `tope_total` queda nulo hasta pedir la
// aprobación (RN-08, HU-04). Tokens y nonces nunca salen del backend (RNF-01).
import { eq } from 'drizzle-orm'
import type { NuevoPrograma, Programa } from '../../programas/servicio'
import type { ProgramaMoneda } from '../../puntos/servicio'
import { db } from '../pool'
import { programa } from '../schema'

export async function crearPrograma(datos: NuevoPrograma): Promise<Programa> {
  const [fila] = await db
    .insert(programa)
    .values({
      entidad: datos.entidad,
      nombre: datos.nombre,
      tipo: datos.tipo,
      destino: datos.destino,
      billeteraPrograma: datos.billeteraPrograma,
      codigoMoneda: datos.codigoMoneda,
      escalaMoneda: datos.escalaMoneda,
      vigenciaInicio: datos.vigenciaInicio,
      vigenciaFin: datos.vigenciaFin,
      estado: datos.estado,
    })
    .returning()

  return { ...datos, id: fila.id, topeTotal: fila.topeTotal ?? null }
}

/** Moneda del programa, para validar la del punto (HU-03). */
export async function buscarProgramaPorId(id: string): Promise<ProgramaMoneda | null> {
  const [fila] = await db
    .select({ id: programa.id, codigoMoneda: programa.codigoMoneda })
    .from(programa)
    .where(eq(programa.id, id))
    .limit(1)

  return fila ?? null
}

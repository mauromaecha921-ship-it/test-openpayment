// Repositorio de `punto` (HU-03) sobre Drizzle.
//
// La wallet ya viene resuelta y normalizada por `puntos/servicio.ts`; aquí solo
// se inserta/consulta. `billetera` es única (la base lo garantiza).
import { eq } from 'drizzle-orm'
import type { NuevoPunto, Punto } from '../../puntos/servicio'
import { db } from '../pool'
import { punto } from '../schema'

export async function crearPunto(datos: NuevoPunto): Promise<Punto> {
  const [fila] = await db
    .insert(punto)
    .values({
      nombre: datos.nombre,
      direccion: datos.direccion,
      billetera: datos.billetera,
      tipo: datos.tipo,
    })
    .returning()

  return {
    id: fila.id,
    nombre: fila.nombre,
    direccion: fila.direccion,
    billetera: fila.billetera,
    tipo: fila.tipo,
  }
}

export async function listarPuntos(): Promise<Punto[]> {
  const filas = await db.select().from(punto)
  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    direccion: fila.direccion,
    billetera: fila.billetera,
    tipo: fila.tipo,
  }))
}

export async function existeBilletera(billetera: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: punto.id })
    .from(punto)
    .where(eq(punto.billetera, billetera))
    .limit(1)

  return Boolean(fila)
}

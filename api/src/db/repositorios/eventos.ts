// Repositorio de `evento`: solo inserción (línea de tiempo y auditoría, HU-16).
// `detalle` nunca guarda tokens, PIN ni llaves (RNF-09). Sobre Drizzle.
import type { EventoNuevo } from '../../programas/servicio'
import { db } from '../pool'
import { evento } from '../schema'

export async function registrarEvento(datos: EventoNuevo): Promise<void> {
  await db.insert(evento).values({
    tipoEntidad: datos.tipoEntidad,
    idEntidad: datos.idEntidad,
    estadoAnterior: datos.estadoAnterior,
    estadoNuevo: datos.estadoNuevo,
    detalle: datos.detalle,
    actor: datos.actor,
  })
}

import { ejecutar, uno, varios } from '../conexion.js'

export type TipoEntidad = 'programa' | 'cuenta' | 'cobro' | 'beneficiario'

export interface FilaEvento {
  id: number
  tipo_entidad: TipoEntidad
  id_entidad: string
  estado_anterior: string | null
  estado_nuevo: string | null
  detalle: string
  creado_en: string
}

/**
 * Escribe un evento (solo inserción). `detalle` nunca lleva tokens, PIN, llaves ni datos
 * personales: la cédula va enmascarada.
 */
export function registrar(args: {
  tipo: TipoEntidad
  id: string
  desde?: string | null
  hacia?: string | null
  detalle?: Record<string, unknown>
}) {
  ejecutar(
    `INSERT INTO evento (tipo_entidad, id_entidad, estado_anterior, estado_nuevo, detalle)
     VALUES (:tipo, :id, :desde, :hacia, :detalle)`,
    {
      tipo: args.tipo,
      id: args.id,
      desde: args.desde ?? null,
      hacia: args.hacia ?? null,
      detalle: JSON.stringify(args.detalle ?? {}),
    },
  )
}

export function deEntidad(tipo: TipoEntidad, id: string): FilaEvento[] {
  return varios<FilaEvento>('SELECT * FROM evento WHERE tipo_entidad = :tipo AND id_entidad = :id ORDER BY id', {
    tipo,
    id,
  })
}

/** El último evento que llevó la entidad a ese estado (para vencimientos y tiempos). */
export function ultimoHacia(tipo: TipoEntidad, id: string, estado: string): FilaEvento | undefined {
  return uno<FilaEvento>(
    `SELECT * FROM evento WHERE tipo_entidad = :tipo AND id_entidad = :id AND estado_nuevo = :estado
     ORDER BY id DESC LIMIT 1`,
    { tipo, id, estado },
  )
}

export function detalleDe(e: FilaEvento): Record<string, unknown> {
  return JSON.parse(e.detalle) as Record<string, unknown>
}

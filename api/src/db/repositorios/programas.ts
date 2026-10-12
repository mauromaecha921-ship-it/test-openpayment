import { randomUUID } from 'node:crypto'
import type { SQLInputValue } from 'node:sqlite'
import type { EstadoPrograma } from '../../programas/estados.js'
import { ejecutar, uno, varios } from '../conexion.js'
import { asignaciones } from './comun.js'

export interface FilaPrograma {
  id: string
  entidad: string
  nombre: string
  tipo: 'subsidio' | 'bono'
  destino: 'libre' | 'restringido'
  billetera_programa: string
  codigo_moneda: string
  escala_moneda: number
  vigencia_inicio: string
  vigencia_fin: string
  tope_total: number | null
  estado: EstadoPrograma
  token_acceso: string | null
  url_gestion: string | null
  uri_continuacion: string | null
  token_continuacion: string | null
  nonce_cliente: string | null
  nonce_cierre: string | null
  url_permiso: string | null
  /** Unidades mínimas; null = LIQUIDACION_MONTO_BASE (migración 003). */
  monto_por_persona: number | null
  /** Migración 004: cuándo se detectó que el permiso ya no sirve; null = vigente (D-35). */
  permiso_vencido_en: string | null
  /** Migración 004: lo que salió con permisos anteriores del programa. */
  gastado_permisos_anteriores: number
}

export type CamposPrograma = Partial<Omit<FilaPrograma, 'id'>>

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

export function crear(datos: NuevoPrograma): FilaPrograma {
  const id = randomUUID()
  ejecutar(
    `INSERT INTO programa (id, entidad, nombre, tipo, destino, billetera_programa, codigo_moneda,
                           escala_moneda, vigencia_inicio, vigencia_fin, monto_por_persona)
     VALUES (:id, :entidad, :nombre, :tipo, :destino, :billetera_programa, :codigo_moneda,
             :escala_moneda, :vigencia_inicio, :vigencia_fin, :monto_por_persona)`,
    { id, monto_por_persona: null, ...datos },
  )
  return obtener(id)!
}

export function obtener(id: string): FilaPrograma | undefined {
  return uno<FilaPrograma>('SELECT * FROM programa WHERE id = :id', { id })
}

/** En orden de creación, el más reciente primero. */
export function listar(): FilaPrograma[] {
  return varios<FilaPrograma>('SELECT * FROM programa ORDER BY rowid DESC')
}

/**
 * Actualiza campos; con `estadoEsperado`, solo si el programa sigue en ese estado (así dos
 * callbacks no activan dos veces). Devuelve si cambió.
 */
export function actualizar(id: string, campos: CamposPrograma, estadoEsperado?: EstadoPrograma): boolean {
  const { sql, parametros } = asignaciones(campos as Record<string, SQLInputValue | undefined>)
  const condicion = estadoEsperado ? ' AND estado = :estado_esperado' : ''
  return (
    ejecutar(`UPDATE programa SET ${sql} WHERE id = :id${condicion}`, {
      ...parametros,
      id,
      ...(estadoEsperado ? { estado_esperado: estadoEsperado } : {}),
    }) === 1
  )
}

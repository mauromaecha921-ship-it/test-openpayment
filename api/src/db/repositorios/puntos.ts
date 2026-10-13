import { randomUUID } from 'node:crypto'
import { ejecutar, uno, varios } from '../conexion.js'

export interface FilaPunto {
  id: string
  nombre: string
  direccion: string
  billetera: string
  tipo: 'retiro' | 'compra'
  /** Migración 005: la sede de un comercio (tipo compra); null en los puntos de retiro. */
  comercio_id: string | null
}

export function crear(datos: Omit<FilaPunto, 'id' | 'comercio_id'> & { comercio_id?: string | null }): FilaPunto {
  const id = randomUUID()
  ejecutar(
    `INSERT INTO punto (id, nombre, direccion, billetera, tipo, comercio_id)
     VALUES (:id, :nombre, :direccion, :billetera, :tipo, :comercio_id)`,
    { id, comercio_id: null, ...datos },
  )
  return obtener(id)!
}

export function obtener(id: string): FilaPunto | undefined {
  return uno<FilaPunto>('SELECT * FROM punto WHERE id = :id', { id })
}

export function porBilletera(billetera: string): FilaPunto | undefined {
  return uno<FilaPunto>('SELECT * FROM punto WHERE billetera = :billetera', { billetera })
}

export function listar(): FilaPunto[] {
  return varios<FilaPunto>('SELECT * FROM punto ORDER BY nombre')
}

export function sedesDe(comercioId: string): FilaPunto[] {
  return varios<FilaPunto>('SELECT * FROM punto WHERE comercio_id = :c ORDER BY nombre', { c: comercioId })
}

/**
 * ¿Este punto puede cobrar este bono? Por la lista de comercios del extra (HU-21, `programa_punto`)
 * o, desde el § 11 del Plan de ajustes, por categoría: la sede es de un comercio verificado cuya
 * categoría acepta el bono.
 */
export function autorizadoEnPrograma(programaId: string, puntoId: string): boolean {
  return !!uno(
    `SELECT 1 AS si FROM programa_punto WHERE programa_id = :p AND punto_id = :q
     UNION ALL
     SELECT 1 FROM punto s
       JOIN comercio c ON c.id = s.comercio_id AND c.verificado_en IS NOT NULL
       JOIN programa_categoria pc ON pc.programa_id = :p AND pc.categoria = c.categoria
     WHERE s.id = :q AND s.tipo = 'compra'
     LIMIT 1`,
    { p: programaId, q: puntoId },
  )
}

/** Las sedes donde se puede usar un bono (lo que ve el beneficiario). */
export function autorizadosEnPrograma(programaId: string): FilaPunto[] {
  return varios<FilaPunto>(
    `SELECT s.* FROM punto s WHERE s.tipo = 'compra' AND EXISTS (
       SELECT 1 FROM programa_punto pp WHERE pp.programa_id = :p AND pp.punto_id = s.id
       UNION ALL
       SELECT 1 FROM comercio c JOIN programa_categoria pc ON pc.programa_id = :p AND pc.categoria = c.categoria
       WHERE c.id = s.comercio_id AND c.verificado_en IS NOT NULL)
     ORDER BY s.nombre`,
    { p: programaId },
  )
}

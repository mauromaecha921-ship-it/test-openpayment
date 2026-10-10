import { randomUUID } from 'node:crypto'
import { ejecutar, uno, varios } from '../conexion.js'

export interface FilaPunto {
  id: string
  nombre: string
  direccion: string
  billetera: string
  tipo: 'retiro' | 'compra'
}

export function crear(datos: Omit<FilaPunto, 'id'>): FilaPunto {
  const id = randomUUID()
  ejecutar('INSERT INTO punto (id, nombre, direccion, billetera, tipo) VALUES (:id, :nombre, :direccion, :billetera, :tipo)', {
    id,
    ...datos,
  })
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

export function autorizadoEnPrograma(programaId: string, puntoId: string): boolean {
  return !!uno('SELECT 1 AS si FROM programa_punto WHERE programa_id = :p AND punto_id = :q', { p: programaId, q: puntoId })
}

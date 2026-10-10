import type { SQLInputValue } from 'node:sqlite'
import type { EstadoCuenta } from '../../programas/estados.js'
import { ejecutar, uno } from '../conexion.js'
import { asignaciones } from './comun.js'

export interface FilaCuenta {
  id: string
  beneficiario_id: string
  billetera: string
  estado: EstadoCuenta
  nonce_cliente: string | null
  nonce_cierre: string | null
  verificada_en: string | null
  uri_continuacion: string | null
  token_continuacion: string | null
}

export function obtener(id: string): FilaCuenta | undefined {
  return uno<FilaCuenta>('SELECT * FROM cuenta_beneficiario WHERE id = :id', { id })
}

/** La cuenta vigente (PorVerificar o Verificada) de la persona, si tiene. */
export function vigenteDe(beneficiarioId: string): FilaCuenta | undefined {
  return uno<FilaCuenta>(
    `SELECT * FROM cuenta_beneficiario WHERE beneficiario_id = :b AND estado IN ('PorVerificar', 'Verificada')`,
    { b: beneficiarioId },
  )
}

/** La vigente o, si no hay, la más reciente (para mostrar el estado). */
export function ultimaDe(beneficiarioId: string): FilaCuenta | undefined {
  return (
    vigenteDe(beneficiarioId) ??
    uno<FilaCuenta>('SELECT * FROM cuenta_beneficiario WHERE beneficiario_id = :b ORDER BY rowid DESC LIMIT 1', {
      b: beneficiarioId,
    })
  )
}

export function crear(datos: Omit<FilaCuenta, 'verificada_en'> & { verificada_en?: string | null }) {
  ejecutar(
    `INSERT INTO cuenta_beneficiario (id, beneficiario_id, billetera, estado, nonce_cliente, nonce_cierre,
                                      verificada_en, uri_continuacion, token_continuacion)
     VALUES (:id, :beneficiario_id, :billetera, :estado, :nonce_cliente, :nonce_cierre,
             :verificada_en, :uri_continuacion, :token_continuacion)`,
    { verificada_en: null, ...datos },
  )
}

export function actualizar(id: string, campos: Partial<Omit<FilaCuenta, 'id'>>, estadoEsperado?: EstadoCuenta): boolean {
  const { sql, parametros } = asignaciones(campos as Record<string, SQLInputValue | undefined>)
  const condicion = estadoEsperado ? ' AND estado = :estado_esperado' : ''
  return (
    ejecutar(`UPDATE cuenta_beneficiario SET ${sql} WHERE id = :id${condicion}`, {
      ...parametros,
      id,
      ...(estadoEsperado ? { estado_esperado: estadoEsperado } : {}),
    }) === 1
  )
}

/** La cuenta vigente que ya usa esa wallet, de cualquier persona. */
export function vigentePorBilletera(billetera: string): FilaCuenta | undefined {
  return uno<FilaCuenta>(
    `SELECT * FROM cuenta_beneficiario WHERE billetera = :billetera AND estado IN ('PorVerificar', 'Verificada') LIMIT 1`,
    { billetera },
  )
}

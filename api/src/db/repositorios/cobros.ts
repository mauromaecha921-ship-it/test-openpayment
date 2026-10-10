import { randomUUID } from 'node:crypto'
import type { SQLInputValue } from 'node:sqlite'
import type { Canal, EstadoCobro } from '../../cobros/estados.js'
import { ahoraIso, ejecutar, uno, varios } from '../conexion.js'
import { asignaciones } from './comun.js'

export interface FilaCobro {
  id: string
  programa_id: string
  punto_id: string | null
  cuenta_id: string | null
  beneficiario_id: string
  canal: Canal
  total_compra: number | null
  monto: number | null
  estado: EstadoCobro
  motivo_rechazo: string | null
  intentos_pin: number
  referencia: string
  llave_idempotencia: string
  url_pago_entrante: string | null
  url_pago_saliente: string | null
  version: number
  creado_en: string
  actualizado_en: string
}

/** 'SUB-' || printf('%04d', valor), desde la tabla secuencia. Llamar dentro de la transacción del INSERT. */
export function siguienteReferencia(): string {
  const fila = uno<{ valor: number }>(
    `UPDATE secuencia SET valor = valor + 1 WHERE nombre = 'cobro_referencia' RETURNING valor`,
  )
  if (!fila) throw new Error('Falta la fila cobro_referencia en secuencia')
  return `SUB-${String(fila.valor).padStart(4, '0')}`
}

export type NuevoCobro = Pick<FilaCobro, 'programa_id' | 'beneficiario_id' | 'canal' | 'llave_idempotencia'> &
  Partial<Pick<FilaCobro, 'punto_id' | 'cuenta_id' | 'total_compra' | 'monto' | 'motivo_rechazo'>> & {
    estado: 'Solicitado' | 'PorConfirmar' | 'Rechazado'
  }

export function crear(datos: NuevoCobro): FilaCobro {
  const id = randomUUID()
  const ahora = ahoraIso()
  ejecutar(
    `INSERT INTO cobro (id, programa_id, punto_id, cuenta_id, beneficiario_id, canal, total_compra, monto,
                        estado, motivo_rechazo, referencia, llave_idempotencia, creado_en, actualizado_en)
     VALUES (:id, :programa_id, :punto_id, :cuenta_id, :beneficiario_id, :canal, :total_compra, :monto,
             :estado, :motivo_rechazo, :referencia, :llave_idempotencia, :ahora, :ahora)`,
    {
      punto_id: null,
      cuenta_id: null,
      total_compra: null,
      monto: null,
      motivo_rechazo: null,
      ...datos,
      id,
      referencia: siguienteReferencia(),
      ahora,
    },
  )
  return obtener(id)!
}

export function obtener(id: string): FilaCobro | undefined {
  return uno<FilaCobro>('SELECT * FROM cobro WHERE id = :id', { id })
}

export function porLlave(llave: string): FilaCobro | undefined {
  return uno<FilaCobro>('SELECT * FROM cobro WHERE llave_idempotencia = :llave', { llave })
}

/** El cobro vivo o pagado de la persona en el programa (lo que vigila el índice de RN-02). */
export function vivoDe(programaId: string, beneficiarioId: string): FilaCobro | undefined {
  return uno<FilaCobro>(
    `SELECT * FROM cobro WHERE programa_id = :p AND beneficiario_id = :b
       AND estado IN ('Solicitado', 'PorConfirmar', 'Pagando', 'Pagado')`,
    { p: programaId, b: beneficiarioId },
  )
}

/**
 * Bloqueo optimista (HU-14): SET …, version = version + 1 WHERE id = ? AND version = ?.
 * Si no cambió ninguna fila, otra petición ganó y se devuelve false.
 */
export function actualizar(id: string, versionEsperada: number, campos: Partial<Omit<FilaCobro, 'id' | 'version'>>): boolean {
  const { sql, parametros } = asignaciones({
    ...(campos as Record<string, SQLInputValue | undefined>),
    actualizado_en: ahoraIso(),
  })
  return (
    ejecutar(`UPDATE cobro SET ${sql}, version = version + 1 WHERE id = :id AND version = :version_esperada`, {
      ...parametros,
      id,
      version_esperada: versionEsperada,
    }) === 1
  )
}

export function dePrograma(programaId: string): FilaCobro[] {
  return varios<FilaCobro>('SELECT * FROM cobro WHERE programa_id = :p ORDER BY creado_en DESC, rowid DESC', {
    p: programaId,
  })
}

export function dePunto(puntoId: string, desde?: string): FilaCobro[] {
  return varios<FilaCobro>(
    `SELECT * FROM cobro WHERE punto_id = :p AND creado_en >= :desde ORDER BY creado_en DESC, rowid DESC`,
    { p: puntoId, desde: desde ?? '0000' },
  )
}

export function deBeneficiario(beneficiarioId: string): FilaCobro[] {
  return varios<FilaCobro>('SELECT * FROM cobro WHERE beneficiario_id = :b ORDER BY creado_en DESC, rowid DESC', {
    b: beneficiarioId,
  })
}

export function enEstado(estado: EstadoCobro): FilaCobro[] {
  return varios<FilaCobro>('SELECT * FROM cobro WHERE estado = :estado ORDER BY actualizado_en', { estado })
}

export function cuantosEnEstado(programaId: string, estado: EstadoCobro): number {
  return uno<{ n: number }>('SELECT count(*) AS n FROM cobro WHERE programa_id = :p AND estado = :estado', {
    p: programaId,
    estado,
  })!.n
}

export function sumaPagada(programaId: string): number {
  return uno<{ total: number }>(
    `SELECT coalesce(sum(monto), 0) AS total FROM cobro WHERE programa_id = :p AND estado = 'Pagado'`,
    { p: programaId },
  )!.total
}

/** D-17: el último PinBloqueado de la persona, en cualquier programa. */
export function ultimoBloqueoPin(beneficiarioId: string): string | null {
  return (
    uno<{ t: string | null }>(
      `SELECT max(actualizado_en) AS t FROM cobro
       WHERE beneficiario_id = :b AND estado = 'Rechazado' AND motivo_rechazo = 'PinBloqueado'`,
      { b: beneficiarioId },
    )?.t ?? null
  )
}

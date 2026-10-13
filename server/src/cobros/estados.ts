/**
 * Máquina pura del cobro (6 estados). Repite la tabla del trigger `cobro_transicion`:
 * doble defensa, la función con tests y la BD (Plan backend § 9).
 *
 *   Solicitado   -> PorConfirmar | Pagando | Rechazado
 *   PorConfirmar -> Pagando | Rechazado
 *   Pagando      -> Pagado | Fallido
 *   Pagado, Rechazado, Fallido: finales
 */

export const ESTADOS_COBRO = ['Solicitado', 'PorConfirmar', 'Pagando', 'Pagado', 'Rechazado', 'Fallido'] as const
export type EstadoCobro = (typeof ESTADOS_COBRO)[number]

export type Canal = 'cuenta' | 'retiro' | 'compra'

const TRANSICIONES: Record<EstadoCobro, readonly EstadoCobro[]> = {
  Solicitado: ['PorConfirmar', 'Pagando', 'Rechazado'],
  PorConfirmar: ['Pagando', 'Rechazado'],
  Pagando: ['Pagado', 'Fallido'],
  Pagado: [],
  Rechazado: [],
  Fallido: [],
}

/** Estados en los que un cobro cuenta para RN-02 (el índice `un_cobro_vivo_por_persona`). */
export const ESTADOS_VIVOS: readonly EstadoCobro[] = ['Solicitado', 'PorConfirmar', 'Pagando', 'Pagado']

/** Estados en los que un cobro puede nacer (trigger `cobro_nacimiento`). */
export const ESTADOS_INICIALES: readonly EstadoCobro[] = ['Solicitado', 'PorConfirmar', 'Rechazado']

export function puedeTransicionar(desde: EstadoCobro, hacia: EstadoCobro): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

export function esFinal(estado: EstadoCobro): boolean {
  return TRANSICIONES[estado].length === 0
}

/**
 * Siguiente estado después de Solicitado: el canal cuenta salta PorConfirmar porque la cuenta
 * ya probó ser del beneficiario (P-09); retiro y compra esperan el PIN (RN-07).
 */
export function despuesDeSolicitado(canal: Canal): EstadoCobro {
  return canal === 'cuenta' ? 'Pagando' : 'PorConfirmar'
}

export class TransicionInvalida extends Error {
  constructor(desde: EstadoCobro, hacia: EstadoCobro) {
    super(`Transición de cobro no permitida: ${desde} -> ${hacia}`)
  }
}

export function exigirTransicion(desde: EstadoCobro, hacia: EstadoCobro) {
  if (!puedeTransicionar(desde, hacia)) throw new TransicionInvalida(desde, hacia)
}

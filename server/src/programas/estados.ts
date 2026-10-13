/**
 * Máquina del programa (5 estados, Plan backend § 9):
 *   Borrador -> EsperandoAprobacion -> Activo <-> Pausado -> Cerrado
 *   EsperandoAprobacion -> Borrador (rechazo, vencimiento o cancelación)
 */
export const ESTADOS_PROGRAMA = ['Borrador', 'EsperandoAprobacion', 'Activo', 'Pausado', 'Cerrado'] as const
export type EstadoPrograma = (typeof ESTADOS_PROGRAMA)[number]

const TRANSICIONES: Record<EstadoPrograma, readonly EstadoPrograma[]> = {
  Borrador: ['EsperandoAprobacion'],
  EsperandoAprobacion: ['Activo', 'Borrador'],
  Activo: ['Pausado', 'Cerrado'],
  Pausado: ['Activo', 'Cerrado'],
  Cerrado: [],
}

export function puedeTransicionarPrograma(desde: EstadoPrograma, hacia: EstadoPrograma): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

/** Cuenta del beneficiario (3 estados): SinEnlazar -> PorVerificar -> Verificada; PorVerificar -> SinEnlazar. */
export type EstadoCuenta = 'SinEnlazar' | 'PorVerificar' | 'Verificada'

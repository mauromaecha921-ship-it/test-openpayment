import type { EstadoCobro, EstadoPrograma, EventoCobro } from '@/api/tipos'

// Las pantallas 15 a 19 son una sola ruta (/punto/cobros/:id): la vista sale del estado del cobro,
// así un recargo o un doble clic siempre muestran lo que dice la API.

export type PantallaCobroPunto = 'cargando' | 'confirmarPin' | 'pagando' | 'pagado' | 'rechazo'

export function pantallaDelCobro(estado: EstadoCobro | undefined): PantallaCobroPunto {
  switch (estado) {
    case undefined:
      return 'cargando'
    case 'Solicitado':
    case 'PorConfirmar':
      return 'confirmarPin'
    case 'Pagando':
      return 'pagando'
    case 'Pagado':
      return 'pagado'
    case 'Rechazado':
    case 'Fallido':
      return 'rechazo'
  }
}

export function esEstadoFinal(estado: EstadoCobro | undefined): boolean {
  return estado === 'Pagado' || estado === 'Rechazado' || estado === 'Fallido'
}

/** A dónde va la entidad según el estado de su programa. */
export function rutaDelPrograma(id: string, estado: EstadoPrograma): string {
  switch (estado) {
    case 'Borrador':
      return `/entidad/programas/${id}/editar`
    case 'EsperandoAprobacion':
      return `/entidad/programas/${id}/aprobar`
    default:
      return `/entidad/programas/${id}`
  }
}

/** Cuándo pasó el cobro a Pagando, para contar cuánto lleva. */
export function inicioPagando(eventos: EventoCobro[]): string | null {
  return eventos.find((e) => e.hacia === 'Pagando')?.creado ?? null
}

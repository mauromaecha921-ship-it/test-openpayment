/**
 * Catálogo único de rechazos (HU-13, Plan backend § 9). El código es lo que se guarda en
 * `cobro.motivo_rechazo`; el mensaje es lo que ve la persona. Los textos viven aquí (P-16).
 */
export const MOTIVOS = {
  YaCobrado: { mensaje: 'Este subsidio ya fue cobrado', estado: 'Rechazado' },
  EnProceso: { mensaje: 'Este subsidio ya está en proceso o fue cobrado', estado: 'Rechazado' },
  TopeSuperado: { mensaje: 'El banco rechazó el pago: el programa llegó a su tope', estado: 'Fallido' },
  ProgramaCerrado: { mensaje: 'El programa está cerrado y ya no recibe cobros', estado: 'Rechazado' },
  SinPagoDisponible: { mensaje: 'Esta cédula no tiene pagos disponibles en este programa', estado: 'Rechazado' },
  CuentaNoVerificada: { mensaje: 'Primero enlaza y verifica tu cuenta', estado: 'Rechazado' },
  PinBloqueado: { mensaje: 'No pudimos confirmar tu identidad', estado: 'Rechazado' },
  TiempoAgotado: { mensaje: 'No pudimos confirmar tu identidad', estado: 'Rechazado' },
  ProgramaNoRecibe: { mensaje: 'El programa no está recibiendo cobros', estado: 'Rechazado' },
  SinFondos: { mensaje: 'El programa no tiene fondos en este momento', estado: 'Fallido' },
  LiquidacionNoResponde: { mensaje: 'No pudimos consultar tu pago; intenta en un momento', estado: 'Rechazado' },
  PermisoVencido: { mensaje: 'El permiso venció: apruébalo de nuevo', estado: 'Fallido' },
  Cancelado: { mensaje: 'El cobro se canceló. No se movió dinero', estado: 'Rechazado' },
  // Nuevo en el piloto: respuesta definitiva del banco que no es el tope (4xx, o failed sin
  // causa confirmada; V-15 dirá si es SinFondos). Va a Resultados del piloto.
  ErrorPago: { mensaje: 'El banco no pudo procesar el pago. No se movió dinero', estado: 'Fallido' },
} as const satisfies Record<string, { mensaje: string; estado: 'Rechazado' | 'Fallido' }>

export type Motivo = keyof typeof MOTIVOS

export function motivo(codigo: Motivo) {
  return { codigo, mensaje: MOTIVOS[codigo].mensaje }
}

/** Un motivo guardado en la BD → lo que ve la web. Si el código no está en el catálogo, se muestra tal cual. */
export function motivoDesdeBd(codigo: string | null): { codigo: string; mensaje: string } | null {
  if (!codigo) return null
  return codigo in MOTIVOS ? motivo(codigo as Motivo) : { codigo, mensaje: codigo }
}

/** El PIN incorrecto no es un motivo: es la respuesta 422 (HU-11). */
export function mensajePinIncorrecto(restantes: number): string {
  return restantes === 1 ? 'PIN incorrecto, te queda 1 intento' : `PIN incorrecto, te quedan ${restantes} intentos`
}

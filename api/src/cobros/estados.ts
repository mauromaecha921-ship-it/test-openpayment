// Máquina de estados pura del cobro (Guía § Estados de un cobro): sin red ni
// base de datos; cualquier transición no listada se rechaza (Arquitectura § 2.2).
//
// Antes de Pagando no se ha movido dinero. Los vencimientos (120 s del PIN,
// RN-12) se evalúan al consultar, no con un worker (AD-08).

export type EstadoCobro =
  | 'Solicitado'
  | 'PorConfirmar'
  | 'Rechazado'
  | 'Pagando'
  | 'Pagado'
  | 'Fallido'

// TODO: función pura de transición con tabla de casos en estados.test.ts
// (Rol 3, viernes sesión 1).

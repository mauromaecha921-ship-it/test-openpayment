// Copia del contrato de la API (Plan backend § 7). Se copia en lugar de importarlo de api/ para que
// la web se pueda desplegar sola. JSON en camelCase; los montos, como texto en unidades mínimas.
// Las formas que el Plan backend no detalla están anotadas en web/README.md.

import type { Moneda } from '@/lib/montos'

export type { Moneda }

export interface ErrorRespuesta {
  error: { codigo: string; mensaje: string }
}

// ── Configuración ─────────────────────────────────────────────────────────────

export interface Config {
  pollIntervaloMs: number
  confirmacionTtlSeg: number
  extras: { bono: boolean; qr: boolean; pdf417: boolean; contrato: boolean; deploy: boolean }
}

/** GET /estado: si los pagos salen de verdad hacia la Test Wallet y, si no, qué falta. */
export interface EstadoSistema {
  pagosReales: boolean
  /** Lo que falta, en español («Falta OP_KEY_ID en api/.env»). Vacío cuando pagosReales. */
  faltan: string[]
  openPayments: { configurado: boolean; coincide: boolean | null; detalle: string }
  /** Programas Activos o Pausados con el token falso de la semilla «solo UI»: nunca pagan. */
  programasConTokenFalso: number
  verificacionCuenta: 'subject' | 'simulada'
}

// ── Programas ─────────────────────────────────────────────────────────────────

export type EstadoPrograma = 'Borrador' | 'EsperandoAprobacion' | 'Activo' | 'Pausado' | 'Cerrado'
export type TipoPrograma = 'subsidio' | 'bono'

export interface Programa {
  id: string
  nombre: string
  entidad: string
  tipo: TipoPrograma
  billetera: string
  moneda: Moneda
  /** YYYY-MM-DD */
  vigenciaInicio: string
  /** YYYY-MM-DD */
  vigenciaFin: string
  estado: EstadoPrograma
  /** Se fija al autorizar (RN-08); null en Borrador. */
  tope: string | null
  /**
   * D-35: el banco ya no acepta el token del permiso (la API estuvo apagada mucho tiempo).
   * Los cobros fallan hasta que la entidad lo renueva. La API simulada no lo manda.
   */
  permisoVencido?: boolean
  /** Lo que recibe cada persona registrada, en unidades mínimas. */
  montoPorPersona: string
  /** § 11: las categorías de comercio que acepta un bono; vacío en un subsidio. */
  categorias?: string[]
}

export interface ProgramaEntrada {
  nombre: string
  entidad: string
  tipo: TipoPrograma
  /** Acepta `$ilp…` o `https://…`; la API la convierte. */
  billetera: string
  vigenciaInicio: string
  vigenciaFin: string
  /** En pesos, como lo escribe la entidad («10000»); la API lo pasa a unidades mínimas. */
  montoPorPersona?: string
  /** Solo en un bono: las categorías de comercio que lo aceptan. */
  categorias?: string[]
}

export interface Liquidacion {
  cedulas: number
  total: string
  moneda: Moneda
}

export interface Redireccion {
  redirect: string
}

export interface Billetera {
  id: string
  moneda: Moneda
  /** El nombre público de la wallet en la Test Wallet, si tiene. */
  nombre?: string | null
}

// ── Puntos ────────────────────────────────────────────────────────────────────

export interface Punto {
  id: string
  nombre: string
  direccion: string
  billetera: string
  billeteraCorta: string
  /** La BD no la guarda: puede no venir. La API revisa la moneda al registrar el punto (HU-03). */
  moneda?: Moneda
  /** «retiro»: entrega efectivo de subsidios. «compra»: sede de un comercio que acepta bonos (§ 11). */
  tipo?: 'retiro' | 'compra'
  comercio?: ComercioCorto | null
}

export interface ComercioCorto {
  id: string
  razonSocial: string
  categoria: string
  categoriaNombre: string
  verificado: boolean
}

// ── Comercios y bonos (Plan de ajustes § 11) ───────────────────────────────────

export interface Categoria {
  id: string
  nombre: string
  actividades: Array<{ ciiu: string; nombre: string }>
}

export interface Comercio extends ComercioCorto {
  nit: string
  ciiu: string
  verificadoEn: string | null
  sedes: Punto[]
}

export interface SedeEntrada {
  nombre: string
  direccion?: string
  billetera: string
}

export interface ComercioEntrada {
  nit: string
  razonSocial: string
  ciiu: string
  sede: SedeEntrada
}

export interface PuntoEntrada {
  programaId?: string
  nombre: string
  /** Opcional: la API pone «Sin dirección». */
  direccion?: string
  billetera: string
}

// ── Cobros ────────────────────────────────────────────────────────────────────

export type EstadoCobro =
  | 'Solicitado'
  | 'PorConfirmar'
  | 'Pagando'
  | 'Pagado'
  | 'Rechazado'
  | 'Fallido'

export type Canal = 'cuenta' | 'retiro' | 'compra'

export type CodigoMotivo =
  | 'YaCobrado'
  | 'EnProceso'
  | 'TopeSuperado'
  | 'ProgramaCerrado'
  | 'SinPagoDisponible'
  | 'CuentaNoVerificada'
  | 'PinBloqueado'
  | 'TiempoAgotado'
  | 'ProgramaNoRecibe'
  | 'SinFondos'
  | 'LiquidacionNoResponde'
  | 'PermisoVencido'
  | 'Cancelado'
  | 'ErrorPago'

export interface Motivo {
  codigo: CodigoMotivo | string
  mensaje: string
}

export interface EventoCobro {
  desde: EstadoCobro | null
  hacia: EstadoCobro
  texto: string
  /** ISO 8601 */
  creado: string
}

export interface Cobro {
  id: string
  referencia: string
  programa: { id: string; nombre: string; estado?: EstadoPrograma }
  canal: Canal
  punto: { id: string; nombre: string; billeteraCorta: string } | null
  cuenta: { billetera: string; billeteraCorta: string } | null
  persona: { nombre: string | null; etiqueta: string; novedad?: boolean }
  /** null en un Rechazado que se cortó antes de calcular el monto (p. ej. SinPagoDisponible). */
  monto: string | null
  /** Solo en una compra con bono: el total de la compra; el cliente paga la diferencia con `monto`. */
  totalCompra?: string | null
  moneda: Moneda
  estado: EstadoCobro
  motivo: Motivo | null
  intentosRestantes: number | null
  /** ISO 8601; solo en PorConfirmar */
  confirmarAntesDe: string | null
  /** Segundos entre el PIN (o la solicitud, en el canal cuenta) y Pagado. */
  segundosHastaPagado: number | null
  creado: string
  actualizado: string
  eventos: EventoCobro[]
}

export interface CobroEntrada {
  programaId?: string
  documento: string
  canal: Canal
  puntoId?: string
  llaveIdempotencia: string
}

/** Fila de las tablas (tablero y «Cobros de hoy»): un cobro sin su línea de tiempo. */
export type CobroResumen = Omit<Cobro, 'eventos'>

// ── Tablero ───────────────────────────────────────────────────────────────────

export interface Tablero {
  programa: Programa
  autorizado: string
  cobrado: string
  /** "banco": leído del permiso (getGrantSpentAmounts); "plataforma": suma de la BD. */
  fuente: 'banco' | 'plataforma'
  noHaSalido: string
  cobrosPagados: number
  porCanal: { cuenta: { cobros: number; monto: string }; retiro: { cobros: number; monto: string }; compra?: { cobros: number; monto: string } }
  /** Promedio de segundos del PIN a Pagado en los retiros. */
  reembolsoSegundos: number | null
  giradoPorAdelantado: string
  /** null si la liquidación no responde. */
  sinCobrar: { cedulas: number; monto: string } | null
  cobrosPagando: number
  rechazadosYFallidos: number
  cobros: CobroResumen[]
  /** Solo cuando el programa está Cerrado (D-18). */
  cierre: { autorizado: string; cobrado: string; nuncaSalio: string; cerradoEn: string } | null
}

// ── Beneficiarios y cuentas ───────────────────────────────────────────────────

export interface BeneficiarioDemo {
  documento: string
  nombre: string
  etiqueta: string
}

export type EstadoCuenta = 'SinEnlazar' | 'PorVerificar' | 'Verificada'

/** GET /beneficiarios: las personas que registró el equipo, con su cuenta. */
export interface PersonaRegistrada {
  documento: string
  nombre: string
  billetera: string | null
  billeteraCorta: string | null
  /** La moneda de la wallet; null si no se pudo leer. */
  moneda: Moneda | null
  estadoCuenta: EstadoCuenta | null
  tienePin: boolean
  /** ISO 8601 */
  registrado: string
}

/** POST /beneficiarios: el registro es la cédula y la wallet; el PIN solo hace falta para cobrar en un punto. */
export interface PersonaEntrada {
  documento: string
  billetera: string
  pin?: string
}

export interface Cuenta {
  id: string
  documento: string
  estado: EstadoCuenta
  billetera: string
  billeteraCorta: string
}

export interface CuentaEntrada {
  documento: string
  billetera: string
  pin: string
}

export interface CuentaCreada {
  cuenta: Cuenta
  /** null cuando la verificación es simulada (plan B de HU-07). */
  redirect: string | null
}

/** Un subsidio que la persona tiene por cobrar en un programa. */
export interface PagoPendiente {
  programa: { id: string; nombre: string; estado: EstadoPrograma; tipo?: TipoPrograma }
  monto: string
  moneda: Moneda
  /** YYYY-MM-DD */
  vigenciaFin: string
}

export type PeriodoCaja = 'hoy' | '7d' | 'todo'

/** GET /puntos/:id/resumen?desde=: la caja del punto (D-36). */
export interface CajaPunto {
  punto: Punto
  periodo: PeriodoCaja
  /** Una fila por moneda; en la demo, solo COP. Entregado = reembolsado: se entrega al ver «Pagado». */
  totales: Array<{ moneda: Moneda; entregado: string; reembolsado: string; pendiente: string }>
  cobros: { pagados: number; enCurso: number; rechazados: number }
  /** Promedio de segundos del PIN al reembolso; null sin retiros pagados. */
  reembolsoSegundos: number | null
  giradoPorAdelantado: string
}

/** GET /puntos/:id/pagos?documento=: lo que el punto puede pagarle hoy a esa cédula. */
export interface PagosEnPunto {
  persona: { nombre: string; etiqueta: string; tienePin: boolean }
  pagos: PagoPendiente[]
}

export interface ResumenBeneficiario {
  /** Sin PIN, la persona no cobra en un punto ni lo necesita para cambiar su cuenta. */
  persona: { nombre: string; documento: string; tienePin: boolean }
  /** Todos los subsidios por cobrar, de todos los programas Activos o Pausados. */
  pagos: PagoPendiente[]
  /** El primero de `pagos`, o null (compatibilidad). */
  pago: PagoPendiente | null
  cuenta: Cuenta | null
  ultimoCobro: CobroResumen | null
}

/**
 * Reglas de negocio como funciones puras: sin red ni BD (Plan backend § 9).
 * RN-08 vive en programas/servicio.ts; RN-09 no se valida (lo hace el banco);
 * RN-10 está en la orquestación.
 */
import type { Canal, EstadoCobro } from './estados.js'
import type { Motivo } from './mensajes.js'

export type Resultado = Motivo | null

// RN-01 · la cédula tiene un pago disponible en la liquidación del programa
export function rn01PagoDisponible(pago: { disponible: boolean } | null): Resultado {
  return pago?.disponible ? null : 'SinPagoDisponible'
}

// RN-02 · un solo cobro vivo o pagado por persona y programa (la BD lo arbitra con el índice;
// esto decide qué mensaje mostrar, D-08)
export function rn02CobroExistente(estadoExistente: EstadoCobro | null): Resultado {
  if (!estadoExistente) return null
  return estadoExistente === 'Pagado' ? 'YaCobrado' : 'EnProceso'
}

// RN-03 · destino libre: cuenta y retiro · destino restringido (bono): solo compra en comercios autorizados
export function rn03CanalPermitido(args: {
  destino: 'libre' | 'restringido'
  canal: Canal
  puntoAutorizado?: boolean
}): Resultado {
  if (args.destino === 'libre') return args.canal === 'cuenta' || args.canal === 'retiro' ? null : 'ProgramaNoRecibe'
  // § 11 del Plan de ajustes: dos mensajes distintos (HU-21)
  if (args.canal !== 'compra') return 'SoloEnComercios'
  return args.puntoAutorizado ? null : 'ComercioNoAutorizado'
}

// RN-04 · el canal cuenta exige una cuenta Verificada y en la misma moneda del programa
export function rn04CuentaLista(args: {
  cuenta: { estado: string } | null
  monedaCuenta: { codigo: string; escala: number } | null
  monedaPrograma: { codigo: string; escala: number }
}): Resultado {
  if (!args.cuenta || args.cuenta.estado !== 'Verificada') return 'CuentaNoVerificada'
  if (
    !args.monedaCuenta ||
    args.monedaCuenta.codigo !== args.monedaPrograma.codigo ||
    args.monedaCuenta.escala !== args.monedaPrograma.escala
  ) {
    return 'CuentaNoVerificada'
  }
  return null
}

// RN-05 · el monto lo calcula el backend: subsidio = valor completo; bono = min(valor, total_compra)
export function rn05Monto(args: { tipo: 'subsidio' | 'bono'; valorDisponible: number; totalCompra?: number }): number {
  if (!Number.isSafeInteger(args.valorDisponible) || args.valorDisponible <= 0) throw new Error('Valor disponible inválido')
  if (args.tipo === 'subsidio') return args.valorDisponible
  if (!args.totalCompra || !Number.isSafeInteger(args.totalCompra) || args.totalCompra <= 0) {
    throw new Error('Un bono necesita el total de la compra')
  }
  return Math.min(args.valorDisponible, args.totalCompra)
}

// RN-06 · el programa está Activo y dentro de su vigencia; uno Cerrado rechaza todo cobro
export function rn06ProgramaRecibe(args: {
  estado: string
  vigenciaInicio: string
  vigenciaFin: string
  ahora: Date
}): Resultado {
  if (args.estado === 'Cerrado') return 'ProgramaCerrado'
  if (args.estado !== 'Activo') return 'ProgramaNoRecibe'
  const t = args.ahora.getTime()
  if (t < Date.parse(args.vigenciaInicio) || t > Date.parse(args.vigenciaFin)) return 'ProgramaNoRecibe'
  return null
}

// RN-07 · PIN validado por la liquidación; al tercer fallo, rechazado y bloqueo de la cédula
export type ResultadoPin =
  | { resultado: 'correcto' }
  | { resultado: 'incorrecto'; intentos: number; restantes: number }
  | { resultado: 'bloqueado'; intentos: number }

export function rn07EvaluarPin(args: { valido: boolean; intentosPrevios: number; maxIntentos: number }): ResultadoPin {
  if (args.valido) return { resultado: 'correcto' }
  const intentos = args.intentosPrevios + 1
  if (intentos >= args.maxIntentos) return { resultado: 'bloqueado', intentos }
  return { resultado: 'incorrecto', intentos, restantes: args.maxIntentos - intentos }
}

/** RN-07 (D-17): la cédula está bloqueada si tuvo un PinBloqueado en los últimos N minutos. */
export function rn07Bloqueada(args: { ultimoBloqueo: string | null; ahora: Date; bloqueoMin: number }): boolean {
  if (!args.ultimoBloqueo) return false
  return args.ahora.getTime() - Date.parse(args.ultimoBloqueo) < args.bloqueoMin * 60_000
}

// RN-11 · todo monto se valida en el backend con la escala de la moneda
export function rn11MontoValido(args: { monto: string; escala: number }): boolean {
  return /^\d+$/.test(args.monto) && BigInt(args.monto) > 0n && Number.isInteger(args.escala) && args.escala >= 0
}

// RN-12 · un cobro PorConfirmar sin PIN en N segundos pasa a Rechazado (se evalúa al consultar)
export function rn12Vencio(args: { estado: EstadoCobro; desde: string; ahora: Date; ttlSeg: number }): boolean {
  return args.estado === 'PorConfirmar' && args.ahora.getTime() - Date.parse(args.desde) > args.ttlSeg * 1000
}

export function confirmarAntesDe(desde: string, ttlSeg: number): string {
  return new Date(Date.parse(desde) + ttlSeg * 1000).toISOString()
}

// RN-10 (D-15) · el pago saliente no tiene estado: Pagado si no falló y envió todo, o si el
// pago entrante se completó. Se ajusta según V-10.
export function rn10Resultado(args: {
  saliente: { fallido: boolean; debitado: string; enviado: string } | null
  entrante?: { completado: boolean; recibido: string; esperado?: string } | null
}): 'Pagado' | 'Fallido' | 'Pagando' {
  if (args.saliente?.fallido) return 'Fallido'
  if (args.saliente && BigInt(args.saliente.enviado) >= BigInt(args.saliente.debitado)) return 'Pagado'
  const e = args.entrante
  if (e && (e.completado || (e.esperado !== undefined && BigInt(e.recibido) >= BigInt(e.esperado)))) return 'Pagado'
  return 'Pagando'
}

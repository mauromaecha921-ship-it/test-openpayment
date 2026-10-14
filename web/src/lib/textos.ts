// Nombres en español sencillo, fechas y horas. Los mensajes de rechazo los manda la API (P-16);
// aquí solo vive la explicación de apoyo que muestran los wireframes 17 a 19 debajo del título.

import type { EstadoCobro, EstadoCuenta, EstadoPrograma, TipoLlave } from '@/api/tipos'

export const NOMBRE_ESTADO_COBRO: Record<EstadoCobro, string> = {
  Solicitado: 'Solicitado',
  PorConfirmar: 'Por confirmar',
  Pagando: 'Pagando',
  Pagado: 'Pagado',
  Rechazado: 'Rechazado',
  Fallido: 'Fallido',
}

export const NOMBRE_ESTADO_PROGRAMA: Record<EstadoPrograma, string> = {
  Borrador: 'Borrador',
  EsperandoAprobacion: 'Esperando aprobación',
  Activo: 'Activo',
  Pausado: 'Pausado',
  Cerrado: 'Cerrado',
}

export const NOMBRE_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  SinEnlazar: 'Sin enlazar',
  PorVerificar: 'Por verificar',
  Verificada: 'Verificada',
}

/** Texto corto del motivo para la etiqueta del tablero: «Rechazado · ya cobrado». */
export const MOTIVO_CORTO: Record<string, string> = {
  YaCobrado: 'ya cobrado',
  EnProceso: 'en proceso',
  TopeSuperado: 'tope del banco',
  ProgramaCerrado: 'programa cerrado',
  SinPagoDisponible: 'sin pago',
  CuentaNoVerificada: 'cuenta sin verificar',
  PinBloqueado: 'PIN bloqueado',
  TiempoAgotado: 'tiempo agotado',
  ProgramaNoRecibe: 'programa en pausa',
  SinFondos: 'sin fondos',
  LiquidacionNoResponde: 'liquidación sin respuesta',
  PermisoVencido: 'permiso vencido',
  Cancelado: 'cancelado',
  ErrorPago: 'error del banco',
  ComercioNoAutorizado: 'comercio no autorizado',
  SoloEnComercios: 'solo en comercios',
  LlaveNoExiste: 'llave Bre-B borrada',
  PuenteNoResponde: 'Bre-B sin respuesta',
}

/** Cómo se llama cada tipo de llave Bre-B en pantalla (RN-14). */
export const NOMBRE_TIPO_LLAVE: Record<TipoLlave, string> = {
  cedula: 'Cédula',
  celular: 'Celular',
  correo: 'Correo',
  alfanumerica: '@Llave',
}

/** «Celular 300***4567», «Cédula ******7890» o, si es un @alias, solo «@seb***» (ya dice qué es). */
export function textoLlave(tipo: TipoLlave, llave: string): string {
  return tipo === 'alfanumerica' ? llave : `${NOMBRE_TIPO_LLAVE[tipo]} ${llave}`
}

/** Explicación debajo del mensaje de la API (wireframes 17 a 19). */
export function explicacionMotivo(codigo: string | undefined, estado: EstadoCobro): string {
  switch (codigo) {
    case 'YaCobrado':
      return 'Esta cédula ya cobró en este programa. No se creó ningún pago.'
    case 'EnProceso':
      return 'Hay otro cobro de esta cédula en curso. No se creó un pago nuevo.'
    case 'TopeSuperado':
      return 'La cuenta del programa no autorizó más pagos. La plata no se movió.'
    case 'ProgramaCerrado':
      return 'La entidad cerró este subsidio y revocó el permiso. No se creó ningún pago.'
    case 'ProgramaNoRecibe':
      return 'La entidad pausó los cobros por ahora. No se creó ningún pago.'
    case 'PinBloqueado':
      return 'Se equivocó 3 veces con el PIN. Puede intentarlo de nuevo en 15 minutos. No se movió dinero.'
    case 'TiempoAgotado':
      return 'El PIN no se confirmó a tiempo. Empieza un cobro nuevo. No se movió dinero.'
    case 'SinFondos':
      return 'La cuenta del programa no tiene saldo en este momento. La plata no se movió.'
    case 'PermisoVencido':
      return 'La entidad debe aprobar de nuevo el permiso en su banco. La plata no se movió.'
    case 'LlaveNoExiste':
      return 'Tu llave Bre-B ya no existe en tu banco. Enlaza otra llave o cobra en un punto. No se movió dinero.'
    case 'PuenteNoResponde':
      return 'No pudimos consultar Bre-B. Intenta en un momento. No se movió dinero.'
    case 'LiquidacionNoResponde':
      return 'Intenta de nuevo en un momento. No se creó ningún pago.'
    case 'Cancelado':
      return 'Puedes empezar un cobro nuevo cuando quieras.'
    case 'CuentaNoVerificada':
      return 'La cuenta todavía no está verificada. No se movió dinero.'
    case 'ErrorPago':
      return 'Intenta de nuevo en unos minutos. Si se repite, avisa a la entidad.'
    case 'ComercioNoAutorizado':
      return 'El bono solo se acepta en comercios verificados de sus categorías. Cobra la compra completa por otro medio.'
    case 'SoloEnComercios':
      return 'Es un bono con destino: no se entrega en efectivo ni va a la cuenta. Se usa al pagar en un comercio autorizado.'
    case 'SinPagoDisponible':
      return 'Revisa el número de la cédula. No se creó ningún pago.'
    default:
      return estado === 'Fallido' ? 'El pago no se completó. La plata no se movió.' : 'No se creó ningún pago.'
  }
}

const ZONA = undefined // la del navegador

/** "16 de octubre de 2026" a partir de "2026-10-16" (sin correrse por la zona horaria). */
export function formatFecha(fechaIso: string): string {
  const [a, m, d] = fechaIso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "15:02:07" */
export function formatHora(iso: string, conSegundos = true): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: conSegundos ? '2-digit' : undefined,
    hour12: false,
    timeZone: ZONA,
  })
}

/** "16 de octubre de 2026, 15:02" */
export function formatFechaHora(iso: string): string {
  const f = new Date(iso)
  return `${f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}, ${formatHora(iso, false)}`
}

/** 114 → "01:54" */
export function formatCuentaRegresiva(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** https://ilp.interledger-test.dev/ana → …/ana */
export function billeteraCorta(url: string): string {
  const limpia = url.replace(/\/+$/, '')
  const i = limpia.lastIndexOf('/')
  return i > limpia.indexOf('//') + 1 ? `…${limpia.slice(i)}` : limpia
}

export function plural(n: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** "2,4 s" */
export function formatSegundos(s: number): string {
  return `${s.toLocaleString('es-CO', { maximumFractionDigits: 1 })} s`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function partes(fechaIso: string) {
  const [a, m, d] = fechaIso.slice(0, 10).split('-').map(Number)
  return { a, m: m - 1, d }
}

/** Vigencia como en el prototipo: corta «1 al 31 oct 2026» o larga «1 al 31 de octubre de 2026». */
export function formatVigencia(inicio: string, fin: string, larga = false): string {
  const i = partes(inicio)
  const f = partes(fin)
  const mes = (m: number) => (larga ? MESES[m] : MESES[m].slice(0, 3))
  const de = larga ? ' de ' : ' '
  if (i.a === f.a && i.m === f.m) return `${i.d} al ${f.d}${de}${mes(f.m)}${de}${f.a}`
  if (i.a === f.a) return `${i.d}${de}${mes(i.m)} al ${f.d}${de}${mes(f.m)}${de}${f.a}`
  return `${i.d}${de}${mes(i.m)}${de}${i.a} al ${f.d}${de}${mes(f.m)}${de}${f.a}`
}

/** «31 de octubre» (sin el año), para «Cóbralo antes del 31 de octubre». */
export function formatDiaMes(fechaIso: string): string {
  const p = partes(fechaIso)
  return `${p.d} de ${MESES[p.m]}`
}

/** «31 oct», para «hasta el 31 oct». */
export function formatDiaMesCorto(fechaIso: string): string {
  const p = partes(fechaIso)
  return `${p.d} ${MESES[p.m].slice(0, 3)}`
}

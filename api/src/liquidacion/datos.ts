import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'
import { ejecutar, uno, varios } from '../db/conexion.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import type { Pago, Resumen } from './contrato.js'

/**
 * Datos de la liquidación simulada (Plan backend § 5), ahora en la tabla `liquidacion_persona`:
 * el equipo registra personas desde la app (Plan de ajustes § 2). El simulador no cuenta
 * intentos de PIN: eso lo lleva la API.
 *
 * El monto de cada persona es el `monto_por_persona` del programa (o LIQUIDACION_MONTO_BASE)
 * por `veces`. El simulador lee el programa de la misma BD: es un atajo del piloto, porque en
 * producción la liquidación es otro sistema (AD-12).
 */
interface FilaLiquidacion {
  documento: string
  veces: number
  pin_hash: string | null
  novedad: number
  creado_en: string
}

// scrypt con costo bajo: el PIN tiene 4 dígitos, así que lo que protege de verdad es el límite
// de intentos (PIN_MAX_INTENTOS). El hash solo evita guardar el PIN en claro.
const COSTO = { N: 1024, r: 8, p: 1 }

export function hashPin(pin: string): string {
  const sal = randomBytes(16)
  return `${sal.toString('hex')}:${scryptSync(pin, sal, 32, COSTO).toString('hex')}`
}

function pinCoincide(guardado: string, pin: string): boolean {
  const [sal, hash] = guardado.split(':')
  if (!sal || !hash) return false
  const esperado = Buffer.from(hash, 'hex')
  const calculado = scryptSync(pin, Buffer.from(sal, 'hex'), esperado.length, COSTO)
  return timingSafeEqual(esperado, calculado)
}

function fila(documento: string): FilaLiquidacion | undefined {
  return uno<FilaLiquidacion>('SELECT * FROM liquidacion_persona WHERE documento = :documento', { documento })
}

/** Cuándo fijó el programa su tope (RN-08). En Borrador todavía no hay corte. */
function corte(programaId: string): string | undefined {
  const p = programas.obtener(programaId)
  if (!p || p.estado === 'Borrador') return undefined
  return eventos.ultimoHacia('programa', p.id, 'EsperandoAprobacion')?.creado_en
}

function montoBase(programaId: string): bigint {
  const p = programas.obtener(programaId)
  return BigInt(p?.monto_por_persona ?? config().LIQUIDACION_MONTO_BASE)
}

/** Novedad: retroactivo fijo, o registrada después de que el programa fijó su tope. */
const esNovedad = (f: FilaLiquidacion, desde: string | undefined) => f.novedad === 1 || (desde !== undefined && f.creado_en > desde)

/** Cédulas y total sin las novedades: es el tope que se aprueba en el banco (RN-08). */
export function resumen(programaId: string): Resumen {
  const desde = corte(programaId)
  const base = montoBase(programaId)
  const filas = varios<FilaLiquidacion>('SELECT * FROM liquidacion_persona').filter((f) => !esNovedad(f, desde))
  const total = filas.reduce((suma, f) => suma + base * BigInt(f.veces), 0n)
  return { cedulas: filas.length, total: total.toString() }
}

export function pago(programaId: string, documento: string): Pago {
  const f = fila(documento)
  if (!f) return { disponible: false }
  return {
    documento: f.documento,
    disponible: true,
    monto: (montoBase(programaId) * BigInt(f.veces)).toString(),
    novedad: esNovedad(f, corte(programaId)),
  }
}

export function validarPin(documento: string, pin: string): boolean {
  const guardado = fila(documento)?.pin_hash
  return guardado ? pinCoincide(guardado, pin) : false
}

export function existe(documento: string): boolean {
  return fila(documento) !== undefined
}

export function tienePin(documento: string): boolean {
  return Boolean(fila(documento)?.pin_hash)
}

/** Pone o cambia el PIN de alguien ya registrado. false si la cédula no está en la liquidación. */
export function ponerPin(documento: string, pin: string): boolean {
  return ejecutar('UPDATE liquidacion_persona SET pin_hash = :pin_hash WHERE documento = :documento', { documento, pin_hash: hashPin(pin) }) === 1
}

/** Registra a la persona en la liquidación (va dentro de la transacción del registro). */
export function registrar(documento: string, pin?: string) {
  ejecutar('INSERT INTO liquidacion_persona (documento, pin_hash) VALUES (:documento, :pin_hash)', {
    documento,
    pin_hash: pin ? hashPin(pin) : null,
  })
}

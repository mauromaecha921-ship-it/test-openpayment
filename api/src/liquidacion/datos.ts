import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { asc, eq, inArray } from 'drizzle-orm'
import { config } from '../config.js'
import { ejecutor } from '../db/conexion.js'
import * as programas from '../db/repositorios/programas.js'
import { persona } from '../db/schema.js'
import type { Pago, Persona, Resumen } from './contrato.js'

/**
 * Datos del sistema del gobierno (simulado), en el esquema `piloto_gobierno` (020_gobierno.sql): quién
 * recibe, su nombre y su PIN. Solo los usan el router de la liquidación y las semillas: la API
 * de Tatú los pide por HTTP (`cliente.ts`). El simulador no cuenta intentos de PIN: eso lo lleva
 * la API.
 *
 * El monto de cada persona es el `monto_por_persona` del programa (o LIQUIDACION_MONTO_BASE) por
 * `veces`. Atajo del piloto, el único cruce entre los dos sistemas: el simulador lee el programa
 * de Tatú (monto por persona y cuándo fijó su tope). En producción la liquidación es otro sistema
 * (AD-12) y trae su propio monto.
 */
type FilaPersona = typeof persona.$inferSelect

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

async function fila(documento: string): Promise<FilaPersona | undefined> {
  const [f] = await ejecutor().select().from(persona).where(eq(persona.documento, documento)).limit(1)
  return f
}

/** Cuándo fijó el programa su tope (RN-08): al pedir la aprobación. En Borrador todavía no hay corte. */
function corte(p: programas.FilaPrograma | undefined): string | undefined {
  if (!p || p.estado === 'Borrador') return undefined
  return p.aprobacion_solicitada_en ?? undefined
}

function montoBase(p: programas.FilaPrograma | undefined): bigint {
  return BigInt(p?.monto_por_persona ?? config().LIQUIDACION_MONTO_BASE)
}

/** Novedad: retroactivo fijo, o registrada después de que el programa fijó su tope. */
const esNovedad = (f: FilaPersona, desde: string | undefined) => f.novedad || (desde !== undefined && f.creado_en > desde)

/** Cédulas y total sin las novedades: es el tope que se aprueba en el banco (RN-08). */
export async function resumen(programaId: string): Promise<Resumen> {
  const p = await programas.obtener(programaId)
  const desde = corte(p)
  const base = montoBase(p)
  const filas = (await ejecutor().select().from(persona)).filter((f) => !esNovedad(f, desde))
  const total = filas.reduce((suma, f) => suma + base * BigInt(f.veces), 0n)
  return { cedulas: filas.length, total: total.toString() }
}

export async function pago(programaId: string, documento: string): Promise<Pago> {
  const f = await fila(documento)
  if (!f) return { disponible: false }
  const p = await programas.obtener(programaId)
  return {
    documento: f.documento,
    disponible: true,
    monto: (montoBase(p) * BigInt(f.veces)).toString(),
    novedad: esNovedad(f, corte(p)),
  }
}

export async function validarPin(documento: string, pin: string): Promise<boolean> {
  const guardado = (await fila(documento))?.pin_hash
  return guardado ? pinCoincide(guardado, pin) : false
}

const aPersona = (f: FilaPersona): Persona => ({ documento: f.documento, nombre: f.nombre, tienePin: Boolean(f.pin_hash) })

/** Nombre y si tiene PIN de varias cédulas (las que no están, no vienen). */
export async function personas(documentos: string[]): Promise<Persona[]> {
  const unicos = [...new Set(documentos)]
  if (!unicos.length) return []
  const filas = await ejecutor().select().from(persona).where(inArray(persona.documento, unicos)).orderBy(asc(persona.documento))
  return filas.map(aPersona)
}

/**
 * Inscribe a la persona o, si ya estaba, le cambia el nombre (y el PIN, si llega). Así un registro
 * que falló a medias en Tatú se puede repetir sin quedar trabado.
 */
export async function inscribir(documento: string, nombre: string, pin?: string): Promise<Persona> {
  const pin_hash = pin ? hashPin(pin) : undefined
  const [f] = await ejecutor()
    .insert(persona)
    .values({ documento, nombre, ...(pin_hash ? { pin_hash } : {}) })
    .onConflictDoUpdate({ target: persona.documento, set: { nombre, ...(pin_hash ? { pin_hash } : {}) } })
    .returning()
  return aPersona(f!)
}

/** Pone o cambia el PIN de alguien ya inscrito. false si la cédula no está en la liquidación. */
export async function ponerPin(documento: string, pin: string): Promise<boolean> {
  const filas = await ejecutor()
    .update(persona)
    .set({ pin_hash: hashPin(pin) })
    .where(eq(persona.documento, documento))
    .returning({ documento: persona.documento })
  return filas.length === 1
}

/** La liquidación de la demo (semillas): Ana, Luis, Jorge y Rosa (retroactivo: novedad). */
export async function sembrarDemo(lista: { documento: string; nombre: string; veces: number; pin: string; novedad: boolean }[]) {
  await ejecutor()
    .insert(persona)
    .values(lista.map((f) => ({ documento: f.documento, nombre: f.nombre, veces: f.veces, pin_hash: hashPin(f.pin), novedad: f.novedad })))
}

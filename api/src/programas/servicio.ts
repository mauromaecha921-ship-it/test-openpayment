// Lógica de programas (HU-01 · conectar un subsidio, O1).
//
// El servicio decide; la ruta solo recibe y valida con Zod (Arquitectura § 3.2).
// Para poder probarlo sin red ni base de datos, la resolución de la wallet y la
// persistencia entran por parámetro (puertos). Los adaptadores reales viven en
// `openPaymentsService.ts` (Rol 1, único que importa el SDK, AD-07) y en
// `db/repositorios/`.
//
// HU-01: O1 · `walletAddress.get`: el payment pointer con `$` pasa a `https://`;
// se copia `assetCode`/`assetScale` de la wallet; el programa queda en Borrador
// y no se mueve dinero (Arquitectura § 3.4 · operaciones).
import { z } from 'zod'

// --- Tipos del dominio ------------------------------------------------------

export type TipoPrograma = 'subsidio' | 'bono'
export type DestinoPrograma = 'libre' | 'restringido'
export type EstadoPrograma = 'Borrador' | 'EsperandoAprobacion' | 'Activo' | 'Pausado' | 'Cerrado'
export type CanalCobro = 'cuenta' | 'retiro' | 'compra'

export interface NuevoPrograma {
  entidad: string
  nombre: string
  tipo: TipoPrograma
  destino: DestinoPrograma
  billeteraPrograma: string
  codigoMoneda: string
  escalaMoneda: number
  vigenciaInicio: Date
  vigenciaFin: Date
  estado: EstadoPrograma
}

export interface Programa extends NuevoPrograma {
  id: string
  topeTotal: number | null
}

export interface EventoNuevo {
  tipoEntidad: 'programa' | 'cuenta' | 'cobro' | 'beneficiario'
  idEntidad: string
  estadoAnterior: string | null
  estadoNuevo: string | null
  detalle: Record<string, unknown>
  actor: string
}

/** Lo que devuelve `walletAddress.get` y le importa a HU-01 (no los tokens). */
export interface BilleteraResuelta {
  assetCode: string
  assetScale: number
}

// --- Puertos (los implementan los adaptadores) ------------------------------

export type ResolverBilletera = (url: string) => Promise<BilleteraResuelta>

export interface PuertoProgramas {
  crear(datos: NuevoPrograma): Promise<Programa>
}

export interface PuertoEventos {
  registrar(evento: EventoNuevo): Promise<void>
}

export interface Dependencias {
  resolverBilletera: ResolverBilletera
  programas: PuertoProgramas
  eventos: PuertoEventos
}

// --- Errores ----------------------------------------------------------------

/** Criterio 2: la wallet no resuelve → el usuario ve este mensaje y no se guarda. */
export class BilleteraNoResuelveError extends Error {
  constructor() {
    super('No encontramos esa cuenta')
    this.name = 'BilleteraNoResuelveError'
  }
}

// El adaptador de Rol 1 todavía no está. Permite responder 501 en vez de fingir
// un «No encontramos esa cuenta». Se elimina cuando exista `walletAddress.get`.
export class AdaptadorPendienteError extends Error {
  constructor() {
    super('walletAddress.get no implementado (openPaymentsService.ts, Rol 1)')
    this.name = 'AdaptadorPendienteError'
  }
}

// --- Reglas puras (probables y testeables sin infraestructura) ---------------

/** O1: un payment pointer con `$` pasa a `https://`; se quita la barra final. */
export function normalizarBilletera(entrada: string): string {
  const valor = entrada.trim()
  const url = valor.startsWith('$') ? `https://${valor.slice(1)}` : valor
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/** RN-03: en el MVP el destino sale del tipo. El bono es extra (HU-21). */
export function destinoDeTipo(tipo: TipoPrograma): DestinoPrograma {
  return tipo === 'subsidio' ? 'libre' : 'restringido'
}

/** RN-03 · HU-01: destino libre → cuenta y retiro; restringido → compra. */
export function canalesPermitidos(destino: DestinoPrograma): CanalCobro[] {
  return destino === 'libre' ? ['cuenta', 'retiro'] : ['compra']
}

/**
 * RN-11: todo monto se interpreta con `assetCode` + `assetScale`. Formato es-CO:
 * miles con punto, decimales con coma, seguido del código de la moneda.
 * `23000000` con `COP` y escala 2 → `230.000,00 COP`.
 */
export function formatearMonto(valor: number | bigint, codigoMoneda: string, escalaMoneda: number): string {
  const n = typeof valor === 'bigint' ? valor : BigInt(Math.trunc(valor))
  const negativo = n < 0n
  const abs = negativo ? -n : n
  const factor = 10n ** BigInt(escalaMoneda)
  const entero = (abs / factor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimales = escalaMoneda > 0 ? `,${(abs % factor).toString().padStart(escalaMoneda, '0')}` : ''
  return `${negativo ? '-' : ''}${entero}${decimales} ${codigoMoneda}`
}

// --- Validación de la frontera (Zod) ----------------------------------------

const CODIGO_MONEDA = /^[A-Z]{3}$/
const TIENE_HOST_HTTPS = /^https:\/\/[^\s/]+/

export const esquemaCrearPrograma = z
  .object({
    entidad: z.string().trim().min(3).max(80),
    nombre: z.string().trim().min(3).max(80),
    // El tipo bono queda para el extra HU-21: aquí solo se conecta un subsidio.
    tipo: z.enum(['subsidio']).default('subsidio'),
    billeteraPrograma: z
      .string()
      .trim()
      .min(1)
      .transform(normalizarBilletera)
      .refine((url) => TIENE_HOST_HTTPS.test(url), {
        message: 'La billetera debe ser un payment pointer ($…) o una URL https://',
      }),
    vigenciaInicio: z.coerce.date(),
    vigenciaFin: z.coerce.date(),
  })
  .refine((datos) => datos.vigenciaFin > datos.vigenciaInicio, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['vigenciaFin'],
  })

// --- Caso de uso -------------------------------------------------------------

/**
 * HU-01 · O1: conecta un subsidio.
 *
 * Resuelve la wallet (`walletAddress.get`), copia su moneda y guarda el programa
 * en Borrador sin mover dinero. Si la wallet no resuelve, lanza
 * `BilleteraNoResuelveError` y no deja nada guardado.
 */
export async function crearPrograma(entrada: unknown, deps: Dependencias): Promise<Programa> {
  const datos = esquemaCrearPrograma.parse(entrada)
  const destino = destinoDeTipo(datos.tipo)

  let billetera: BilleteraResuelta
  try {
    billetera = await deps.resolverBilletera(datos.billeteraPrograma)
  } catch (error) {
    if (error instanceof AdaptadorPendienteError) throw error
    throw new BilleteraNoResuelveError()
  }

  const escalaValida = Number.isInteger(billetera?.assetScale) && billetera.assetScale >= 0 && billetera.assetScale <= 18
  if (!CODIGO_MONEDA.test(billetera?.assetCode ?? '') || !escalaValida) {
    throw new BilleteraNoResuelveError()
  }

  const programa = await deps.programas.crear({
    entidad: datos.entidad,
    nombre: datos.nombre,
    tipo: datos.tipo,
    destino,
    billeteraPrograma: datos.billeteraPrograma,
    codigoMoneda: billetera.assetCode,
    escalaMoneda: billetera.assetScale,
    vigenciaInicio: datos.vigenciaInicio,
    vigenciaFin: datos.vigenciaFin,
    estado: 'Borrador',
  })

  // HU-16 / O1: cada cambio de estado deja un evento. Nunca tokens ni llaves.
  await deps.eventos.registrar({
    tipoEntidad: 'programa',
    idEntidad: programa.id,
    estadoAnterior: null,
    estadoNuevo: programa.estado,
    detalle: { billeteraPrograma: programa.billeteraPrograma, codigoMoneda: programa.codigoMoneda },
    actor: 'entidad',
  })

  return programa
}

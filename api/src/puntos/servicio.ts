// Lógica de puntos de retiro (HU-03 · 1 punto, O1 auxiliar).
//
// El servicio decide; la ruta solo recibe y valida con Zod. Igual que en
// `programas/servicio.ts`, la resolución de la wallet y la persistencia entran
// por parámetro (puertos) para poder probarlo sin red ni base de datos.
//
// HU-03: un punto con nombre, dirección y wallet válida sirve para cobrar. Si la
// wallet usa una moneda distinta a la del programa, se advierte y NO se guarda.
import { z } from 'zod'
import {
  BilleteraNoResuelveError,
  normalizarBilletera,
  type BilleteraResuelta,
  type ResolverBilletera,
} from '../programas/servicio'

export type TipoPunto = 'retiro' | 'compra'

export interface NuevoPunto {
  nombre: string
  direccion: string
  billetera: string
  tipo: TipoPunto
}

export interface Punto extends NuevoPunto {
  id: string
}

export interface ProgramaMoneda {
  id: string
  codigoMoneda: string
}

// --- Puertos (los implementan los adaptadores) ------------------------------

export interface PuertoProgramas {
  buscarPorId(id: string): Promise<ProgramaMoneda | null>
}

export interface PuertoPuntos {
  crear(datos: NuevoPunto): Promise<Punto>
  existeBilletera(billetera: string): Promise<boolean>
  listar(): Promise<Punto[]>
}

export interface Dependencias {
  resolverBilletera: ResolverBilletera
  programas: PuertoProgramas
  puntos: PuertoPuntos
}

// --- Errores ----------------------------------------------------------------

export class MonedaNoCoincideError extends Error {
  constructor(codigoPunto: string, codigoPrograma: string) {
    super(`La wallet del punto usa ${codigoPunto} y el programa usa ${codigoPrograma}`)
    this.name = 'MonedaNoCoincideError'
  }
}

export class PuntoDuplicadoError extends Error {
  constructor() {
    super('Esa wallet ya está registrada en otro punto')
    this.name = 'PuntoDuplicadoError'
  }
}

export class ProgramaNoExisteError extends Error {
  constructor() {
    super('El programa no existe')
    this.name = 'ProgramaNoExisteError'
  }
}

// --- Validación (Zod) -------------------------------------------------------

const TIENE_HOST_HTTPS = /^https:\/\/[^\s/]+/

export const esquemaRegistrarPunto = z.object({
  nombre: z.string().trim().min(3).max(80),
  direccion: z.string().trim().min(3).max(160),
  billetera: z
    .string()
    .trim()
    .min(1)
    .transform(normalizarBilletera)
    .refine((url) => TIENE_HOST_HTTPS.test(url), {
      message: 'La billetera debe ser un payment pointer ($…) o una URL https://',
    }),
  tipo: z.enum(['retiro', 'compra']).default('retiro'),
  // Opcional: si viene, se exige que la moneda del punto coincida con la del programa.
  programaId: z.string().uuid().optional(),
})

// --- Caso de uso ------------------------------------------------------------

/**
 * HU-03: registra un punto de retiro (o comercio).
 *
 * Resuelve la wallet con `walletAddress.get` (puerto). Si se indica un programa,
 * exige la misma moneda y lanza `MonedaNoCoincideError` sin guardar si no
 * coincide —el público ve una advertencia—.
 */
export async function registrarPunto(entrada: unknown, deps: Dependencias): Promise<Punto> {
  const datos = esquemaRegistrarPunto.parse(entrada)

  let billetera: BilleteraResuelta
  try {
    billetera = await deps.resolverBilletera(datos.billetera)
  } catch {
    throw new BilleteraNoResuelveError()
  }

  if (datos.programaId) {
    const programa = await deps.programas.buscarPorId(datos.programaId)
    if (!programa) throw new ProgramaNoExisteError()
    if (programa.codigoMoneda !== billetera.assetCode) {
      throw new MonedaNoCoincideError(billetera.assetCode, programa.codigoMoneda)
    }
  }

  if (await deps.puntos.existeBilletera(datos.billetera)) {
    throw new PuntoDuplicadoError()
  }

  return deps.puntos.crear({
    nombre: datos.nombre,
    direccion: datos.direccion,
    billetera: datos.billetera,
    tipo: datos.tipo,
  })
}

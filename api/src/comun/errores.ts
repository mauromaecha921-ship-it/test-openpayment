import type { ErrorRequestHandler } from 'express'
import { z } from 'zod'
import { log } from './log.js'

/** Error de la API: `{ "error": { "codigo", "mensaje" } }` con su status HTTP (Plan backend § 7). */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

export const noEncontrado = (mensaje = 'No existe') => new ErrorApi(404, 'NoEncontrado', mensaje)
export const conflicto = (codigo: string, mensaje: string) => new ErrorApi(409, codigo, mensaje)
export const entradaInvalida = (mensaje: string) => new ErrorApi(400, 'EntradaInvalida', mensaje)

/** Valida con Zod y convierte el fallo en un 400 legible. */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const r = esquema.safeParse(datos)
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`).join('; ')
    throw entradaInvalida(detalle)
  }
  return r.data
}

export const manejarErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ErrorApi) {
    res.status(err.status).json({ error: { codigo: err.codigo, mensaje: err.message } })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { codigo: 'EntradaInvalida', mensaje: 'El cuerpo no es JSON válido' } })
    return
  }
  log.error('Error no controlado', { error: err })
  res.status(500).json({ error: { codigo: 'ErrorInterno', mensaje: 'Algo falló de nuestro lado' } })
}

import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../comun/errores.js'
import { documento } from '../liquidacion/contrato.js'
import { TipoLlave } from '../puente/contrato.js'
import * as servicio from './servicio.js'

const pin = z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos').optional()

/** Una wallet Open Payments escrita a mano, o una llave Bre-B con el tipo que eligió la persona (RN-14). */
export const EntradaCuenta = z.union([
  z.object({
    documento,
    tipoLlave: TipoLlave.describe('El tipo lo elige la persona: nunca se adivina por el formato (RN-14)'),
    llave: z.string().trim().min(3).max(80).meta({ example: '3001234567' }),
    // Quien se registró sin PIN no tiene con qué probar que es la persona (Plan de ajustes § 2)
    pin,
  }),
  z.object({ documento, billetera: z.string().trim().min(3), pin }),
])

const Callback = z.object({
  hash: z.string().optional(),
  interact_ref: z.string().optional(),
  result: z.string().optional(),
})

/** Cuentas: O3 y HU-07 (P-11). */
export function rutasCuentas(): Router {
  const r = Router()

  r.post('/cuentas', async (req, res) => {
    res.status(201).json(await servicio.enlazar(validar(EntradaCuenta, req.body)))
  })

  // «¿Eres Ana M*** R***?» antes de enlazar una llave (HU-07)
  r.get('/cuentas/llaves/:tipo/:valor', async (req, res) => {
    res.json(await servicio.consultarLlave(validar(TipoLlave, req.params.tipo), req.params.valor))
  })

  // Va antes de /cuentas/:documento para que «callback» no se lea como cédula
  r.get('/cuentas/callback/:id', async (req, res) => {
    const q = Callback.safeParse(req.query)
    res.redirect(302, await servicio.callback(req.params.id, q.success ? q.data : {}))
  })

  r.get('/cuentas/:documento', async (req, res) => {
    res.json(await servicio.estado(validar(documento, req.params.documento)))
  })

  return r
}

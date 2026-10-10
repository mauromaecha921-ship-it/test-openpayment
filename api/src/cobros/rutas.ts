import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../comun/errores.js'
import { documento } from '../liquidacion/contrato.js'
import * as orquestacion from './orquestacion.js'

/** Las rutas solo reciben y validan con Zod; decide la orquestación (Arquitectura § 3.2). */
const EntradaCobro = z.object({
  programaId: z.guid().optional(),
  documento,
  canal: z.enum(['cuenta', 'retiro', 'compra']),
  puntoId: z.guid().optional(),
  // P-16: la web genera un UUID por intento
  llaveIdempotencia: z.string().min(8).max(100),
  // RN-11: el monto nunca viene del navegador; solo el total de una compra (bono)
  totalCompra: z.string().regex(/^\d+$/).optional(),
})

const Confirmacion = z.object({ pin: z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos') })

export function rutasCobros(): Router {
  const r = Router()

  r.post('/cobros', async (req, res) => {
    const cobro = await orquestacion.solicitar(validar(EntradaCobro, req.body))
    res.status(201).json(cobro)
  })

  r.post('/cobros/:id/confirmar', async (req, res) => {
    const { status, cobro } = await orquestacion.confirmar(req.params.id, validar(Confirmacion, req.body).pin)
    res.status(status).json(cobro)
  })

  r.post('/cobros/:id/cancelar', (req, res) => {
    res.json(orquestacion.cancelar(req.params.id))
  })

  r.get('/cobros/:id', async (req, res) => {
    res.json(await orquestacion.consultar(req.params.id))
  })

  return r
}

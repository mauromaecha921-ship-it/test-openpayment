import { Router, type Request, type Response } from 'express'

// O4, O5, O6 (Estructura § 4). Las rutas solo reciben y validan (Zod);
// la orquestación vive en `orquestacion.ts` (P-20).
export const rutas = Router()

const pendiente = (_req: Request, res: Response) => {
  res.status(501).json({ error: 'pendiente de implementación' })
}

rutas.post('/cobros', pendiente) // O4/O5: solicitud desde el punto o la app
rutas.post('/cobros/:id/confirmar', pendiente) // O5: PIN (o huella) y pago
rutas.get('/cobros/:id', pendiente) // O6: estado para el punto y el beneficiario

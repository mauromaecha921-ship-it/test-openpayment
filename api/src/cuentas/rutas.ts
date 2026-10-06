import { Router, type Request, type Response } from 'express'

// O3 (Estructura § 4). Las rutas solo reciben y validan (Zod).
export const rutas = Router()

const pendiente = (_req: Request, res: Response) => {
  res.status(501).json({ error: 'pendiente de implementación' })
}

rutas.post('/cuentas', pendiente) // O3: enlazar cuenta del beneficiario (HU-07)
rutas.get('/cuentas/callback/:id', pendiente) // O3: callback de verificación (P-11)

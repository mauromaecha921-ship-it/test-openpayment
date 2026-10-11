import { Router, type Request, type Response } from 'express'

// O1, O2, O7, O8 (Estructura § 4). Las rutas solo reciben y validan (Zod);
// quien decide es `servicio.ts` (Arquitectura § 3.2).
export const rutas = Router()

const pendiente = (_req: Request, res: Response) => {
  res.status(501).json({ error: 'pendiente de implementación' })
}

rutas.post('/programas', pendiente) // O1: conectar programa
rutas.post('/programas/:id/autorizar', pendiente) // O2: grant interactivo con tope
rutas.get('/callback/:id', pendiente) // O2: verificación de hash + grant.continue
rutas.get('/programas/:id/tablero', pendiente) // O7: autorizado, cobrado y lo que nunca salió
rutas.post('/programas/:id/cerrar', pendiente) // O8: token.revoke / grant.cancel (AD-20)

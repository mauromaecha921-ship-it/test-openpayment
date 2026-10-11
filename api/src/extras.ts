import { Router, type Request, type Response } from 'express'
import { config } from './config'

// Banderas EXTRA_* (RNF-10, AD-19): el frontend las lee en GET /config para no
// mostrar botones muertos. Con todas en false, el flujo principal no se toca.
export const rutas = Router()

rutas.get('/config', (_req: Request, res: Response) => {
  res.json({
    extras: {
      bono: config.EXTRA_BONO,
      qr: config.EXTRA_QR,
      pdf417: config.EXTRA_PDF417,
      contrato: config.EXTRA_CONTRATO,
      deploy: config.EXTRA_DEPLOY,
    },
  })
})

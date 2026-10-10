import { Router } from 'express'
import { config } from './config.js'

/** GET /config: banderas EXTRA_* y cadencias para la web (RNF-10). Nada secreto. */
export function rutasExtras(): Router {
  const r = Router()
  r.get('/config', (_req, res) => {
    const c = config()
    res.json({
      extras: {
        bono: c.EXTRA_BONO,
        qr: c.EXTRA_QR,
        pdf417: c.EXTRA_PDF417,
        contrato: c.EXTRA_CONTRATO,
        deploy: c.EXTRA_DEPLOY,
      },
      pollIntervaloMs: c.POLL_INTERVALO_MS,
      confirmacionTtlSeg: c.CONFIRMACION_TTL_SEG,
      pinMaxIntentos: c.PIN_MAX_INTENTOS,
      qrTtlSeg: c.QR_TTL_SEG,
      verificacionCuenta: c.VERIFICACION_CUENTA,
    })
  })
  return r
}

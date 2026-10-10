import { Router } from 'express'
import { config } from '../config.js'
import { PedidoPin, documento } from './contrato.js'
import * as datos from './datos.js'

/**
 * Simulador de la liquidación bajo /api/liquidacion (P-02). La API lo consume por HTTP con
 * LIQUIDACION_URL, como si fuera el sistema de la entidad (AD-12): podría salir a otro proceso
 * sin cambiar código.
 */
export function routerLiquidacion(): Router {
  const r = Router()

  r.use((_req, res, next) => {
    if (config().LIQUIDACION_SIMULAR_FALLA) {
      res.status(503).json({ error: { codigo: 'NoDisponible', mensaje: 'Liquidación simulada en falla' } })
      return
    }
    next()
  })

  r.get('/programas/:programaId/resumen', (req, res) => {
    res.json(datos.resumen(req.params.programaId))
  })

  r.get('/programas/:programaId/pagos/:documento', (req, res) => {
    const doc = documento.safeParse(req.params.documento)
    const p = doc.success ? datos.pago(req.params.programaId, doc.data) : { disponible: false as const }
    res.status(p.disponible ? 200 : 404).json(p)
  })

  r.post('/pin/validar', (req, res) => {
    const pedido = PedidoPin.safeParse(req.body)
    if (!pedido.success) {
      res.json({ valido: false })
      return
    }
    res.json({ valido: datos.validarPin(pedido.data.documento, pedido.data.pin) })
  })

  return r
}

import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { documento, Inscripcion, NuevoPin, PedidoPin } from './contrato.js'
import * as datos from './datos.js'

/** Máximo de cédulas por consulta de nombres (una pantalla con su lista de cobros). */
const MAX_DOCUMENTOS = 500

/**
 * Simulador del sistema del gobierno bajo /api/liquidacion (P-02). La API lo consume por HTTP con
 * LIQUIDACION_URL, como si fuera otro sistema (AD-12): podría salir a otro proceso sin cambiar
 * código. Tatú le pide aquí lo que no guarda: quién recibe y cuánto, el nombre y el PIN.
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

  r.get('/programas/:programaId/resumen', async (req, res) => {
    res.json(await datos.resumen(req.params.programaId))
  })

  r.get('/programas/:programaId/pagos/:documento', async (req, res) => {
    const doc = documento.safeParse(req.params.documento)
    const p = doc.success ? await datos.pago(req.params.programaId, doc.data) : { disponible: false as const }
    res.status(p.disponible ? 200 : 404).json(p)
  })

  r.post('/pin/validar', async (req, res) => {
    const pedido = PedidoPin.safeParse(req.body)
    if (!pedido.success) {
      res.json({ valido: false })
      return
    }
    res.json({ valido: await datos.validarPin(pedido.data.documento, pedido.data.pin) })
  })

  // Nombre y si tiene PIN de varias cédulas: ?documentos=900000001,900000002
  r.get('/personas', async (req, res) => {
    const lista = String(req.query.documentos ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    const validos = z.array(documento).max(MAX_DOCUMENTOS).safeParse(lista)
    if (!validos.success) {
      res.status(400).json({ error: { codigo: 'EntradaInvalida', mensaje: `Hasta ${MAX_DOCUMENTOS} documentos válidos, separados por coma` } })
      return
    }
    res.json(await datos.personas(validos.data))
  })

  // «Equipo de prueba» hace el papel del gobierno: inscribe a la persona o la actualiza
  r.post('/personas', async (req, res) => {
    const e = Inscripcion.safeParse(req.body)
    if (!e.success) {
      res.status(400).json({ error: { codigo: 'EntradaInvalida', mensaje: e.error.issues.map((i) => i.message).join('; ') } })
      return
    }
    res.json(await datos.inscribir(e.data.documento, e.data.nombre, e.data.pin))
  })

  r.post('/personas/:documento/pin', async (req, res) => {
    const doc = documento.safeParse(req.params.documento)
    const cuerpo = NuevoPin.safeParse(req.body)
    if (!doc.success || !cuerpo.success) {
      res.status(400).json({ error: { codigo: 'EntradaInvalida', mensaje: 'Documento o PIN inválido' } })
      return
    }
    if (!(await datos.ponerPin(doc.data, cuerpo.data.pin))) {
      res.status(404).json({ error: { codigo: 'NoEncontrado', mensaje: 'Esa cédula no está en la liquidación' } })
      return
    }
    res.json({ documento: doc.data, tienePin: true })
  })

  return r
}

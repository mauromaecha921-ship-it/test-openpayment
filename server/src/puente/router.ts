import { Router, type Response } from 'express'
import { config } from '../config.js'
import { documento } from '../liquidacion/contrato.js'
import { Coincidencia, Llave, normalizarLlave, PedidoPertenece, TipoLlave, type Resolucion } from './contrato.js'
import * as datos from './datos.js'
import { enmascararNombre } from './enmascarar.js'

function error(res: Response, status: number, codigo: string, mensaje: string) {
  res.status(status).json({ error: { codigo, mensaje } })
}

/** La llave de la ruta, ya limpia; null si el tipo o el valor no sirven (responde 404: no existe). */
function llaveDe(tipo: string, valor: string): { tipo: TipoLlave; valor: string } | null {
  const t = TipoLlave.safeParse(tipo)
  if (!t.success) return null
  const v = normalizarLlave(t.data, valor)
  return v ? { tipo: t.data, valor: v } : null
}

const NO_EXISTE = 'Esa llave no existe en Bre-B'

/**
 * Simulador del banco puente de Bre-B bajo /api/puente (Plan Bre-B § 3.1, AD-21). La API lo consume
 * por HTTP con PUENTE_URL, como si fuera el banco: podría salir a otro proceso sin cambiar código.
 * Las rutas de registro las usa «Equipo de prueba», que hace de banco de cada persona.
 */
export function routerPuente(): Router {
  const r = Router()

  r.use((_req, res, next) => {
    if (config().PUENTE_SIMULAR_FALLA) {
      error(res, 503, 'NoDisponible', 'Banco puente simulado en falla')
      return
    }
    next()
  })

  // Lo que ve cualquiera que consulta una llave: a dónde llega y el titular enmascarado
  r.get('/llaves/:tipo/:valor', async (req, res) => {
    const k = llaveDe(req.params.tipo, req.params.valor)
    const l = k && (await datos.obtener(k.tipo, k.valor))
    if (!l) {
      error(res, 404, 'LlaveNoExiste', NO_EXISTE)
      return
    }
    const resolucion: Resolucion = { tipo: l.tipo, valor: l.valor, billetera: l.billetera, titular: enmascararNombre(l.nombreTitular) }
    res.json(resolucion)
  })

  // RN-16: «¿esta llave es de esta cédula?», sin revelar de quién es
  r.post('/llaves/:tipo/:valor/pertenece', async (req, res) => {
    const k = llaveDe(req.params.tipo, req.params.valor)
    const l = k && (await datos.obtener(k.tipo, k.valor))
    if (!l) {
      error(res, 404, 'LlaveNoExiste', NO_EXISTE)
      return
    }
    const pedido = PedidoPertenece.safeParse(req.body)
    res.json(Coincidencia.parse({ pertenece: pedido.success && pedido.data.documento === l.documentoTitular }))
  })

  // «Equipo de prueba» hace de banco: las llaves de una persona
  r.get('/llaves', async (req, res) => {
    const doc = documento.safeParse(req.query.documento)
    if (!doc.success) {
      error(res, 400, 'EntradaInvalida', 'Falta ?documento= válido')
      return
    }
    res.json(await datos.deTitular(doc.data))
  })

  r.post('/llaves', async (req, res) => {
    const e = Llave.safeParse(req.body)
    const valor = e.success ? normalizarLlave(e.data.tipo, e.data.valor) : null
    if (!e.success || !valor) {
      error(res, 400, 'EntradaInvalida', e.success ? `No es una llave de tipo ${e.data.tipo} válida` : e.error.issues.map((i) => i.message).join('; '))
      return
    }
    if (e.data.tipo === 'cedula' && valor !== e.data.documentoTitular) {
      error(res, 422, 'CedulaAjena', 'Una llave tipo cédula solo la registra su titular')
      return
    }
    const l = { ...e.data, valor }
    const resultado = await datos.registrar(l)
    if (resultado === 'deOtro') {
      error(res, 409, 'LlaveEnUso', 'Esa llave ya es de otra persona')
      return
    }
    res.status(resultado === 'creada' ? 201 : 200).json(l)
  })

  r.delete('/llaves/:tipo/:valor', async (req, res) => {
    const k = llaveDe(req.params.tipo, req.params.valor)
    if (!k || !(await datos.borrar(k.tipo, k.valor))) {
      error(res, 404, 'LlaveNoExiste', NO_EXISTE)
      return
    }
    res.status(204).end()
  })

  return r
}

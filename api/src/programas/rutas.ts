import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../comun/errores.js'
import { IDS_CATEGORIA } from '../comercios/categorias.js'
import * as servicio from './servicio.js'

// «2026-12-31» (día completo en Bogotá) o un instante ISO
const fecha = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'fecha inválida')

// En pesos, como lo escribe la entidad: «10000» o «10000.50»
const montoEnPesos = z.string().trim().regex(/^\d+(\.\d+)?$/, 'monto en pesos, sin puntos de miles')

const EntradaPrograma = z.object({
  entidad: z.string().trim().min(3).max(80),
  nombre: z.string().trim().min(3).max(80),
  billetera: z.string().trim().min(3),
  vigenciaInicio: fecha,
  vigenciaFin: fecha,
  tipo: z.enum(['subsidio', 'bono']).default('subsidio'),
  montoPorPersona: montoEnPesos.optional(),
  categorias: z.array(z.enum(IDS_CATEGORIA)).max(10).optional(),
})

const EdicionPrograma = z
  .object({
    entidad: z.string().trim().min(3).max(80),
    nombre: z.string().trim().min(3).max(80),
    billetera: z.string().trim().min(3),
    vigenciaInicio: fecha,
    vigenciaFin: fecha,
    tipo: z.enum(['subsidio', 'bono']),
    montoPorPersona: montoEnPesos,
    categorias: z.array(z.enum(IDS_CATEGORIA)).max(10),
  })
  .partial()

const Cierre = z.object({ confirmacion: z.string() })

const Callback = z.object({
  hash: z.string().optional(),
  interact_ref: z.string().optional(),
  result: z.string().optional(),
})

/** Programas: O1, O2, O7, O8, HU-05 y HU-18 (Plan backend § 7). */
export function rutasProgramas(): Router {
  const r = Router()

  r.get('/programas', async (_req, res) => {
    res.json(await servicio.listar())
  })

  r.post('/programas', async (req, res) => {
    res.status(201).json(await servicio.crear(validar(EntradaPrograma, req.body)))
  })

  r.get('/programas/:id', async (req, res) => {
    res.json(await servicio.leer(req.params.id))
  })

  r.patch('/programas/:id', async (req, res) => {
    res.json(await servicio.editar(req.params.id, validar(EdicionPrograma, req.body)))
  })

  r.get('/programas/:id/liquidacion', async (req, res) => {
    res.json(await servicio.resumenLiquidacion(req.params.id))
  })

  r.post('/programas/:id/autorizar', async (req, res) => {
    res.json(await servicio.autorizar(req.params.id))
  })

  r.post('/programas/:id/cancelar-aprobacion', async (req, res) => {
    res.json(await servicio.cancelarAprobacion(req.params.id))
  })

  // D-35: el permiso venció en el banco (la API estuvo apagada); se pide uno nuevo por lo que falta
  r.post('/programas/:id/renovar-permiso', async (req, res) => {
    res.json(await servicio.renovarPermiso(req.params.id))
  })

  r.get('/programas/:id/tablero', async (req, res) => {
    res.json(await servicio.tablero(req.params.id))
  })

  r.post('/programas/:id/pausar', (req, res) => {
    res.json(servicio.pausar(req.params.id))
  })

  r.post('/programas/:id/reanudar', (req, res) => {
    res.json(servicio.reanudar(req.params.id))
  })

  r.post('/programas/:id/cerrar', async (req, res) => {
    res.json(await servicio.cerrar(req.params.id, validar(Cierre, req.body).confirmacion))
  })

  // O2: la Test Wallet vuelve aquí (D-06); se verifica el hash y se redirige a la web
  r.get('/callback/:id', async (req, res) => {
    const q = Callback.safeParse(req.query)
    res.redirect(302, await servicio.callback(req.params.id, q.success ? q.data : {}))
  })

  return r
}

import { Router } from 'express'
import { z } from 'zod'
import { conflicto, noEncontrado, validar } from '../comun/errores.js'
import { vistaCobro, vistaPunto } from '../comun/vistas.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as programas from '../db/repositorios/programas.js'
import * as repo from '../db/repositorios/puntos.js'
import { resolverWallet } from '../programas/servicio.js'

const EntradaPunto = z.object({
  nombre: z.string().trim().min(3).max(80),
  direccion: z.string().trim().max(120).optional().transform((v) => (v && v.length >= 3 ? v : 'Sin dirección')),
  billetera: z.string().trim().min(3),
  tipo: z.enum(['retiro', 'compra']).default('retiro'),
  // HU-03: si viene, la moneda del punto debe ser la del programa
  programaId: z.guid().optional(),
})

const Consulta = z.object({ direccion: z.string().trim().min(3) })

/** Inicio del día en Bogotá (UTC−5, sin horario de verano), en ISO UTC. */
function inicioDeHoy(): string {
  const bogota = new Date(Date.now() - 5 * 3600_000)
  return new Date(Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate()) + 5 * 3600_000).toISOString()
}

/** Puntos y billeteras (D-05). */
export function rutasPuntos(): Router {
  const r = Router()

  // «Cuenta encontrada» antes de guardar (wireframe 02)
  r.get('/billeteras/resolver', async (req, res) => {
    const { direccion } = validar(Consulta, req.query)
    const w = await resolverWallet(direccion)
    res.json({ id: w.id, nombre: w.nombre ?? null, moneda: { codigo: w.codigoMoneda, escala: w.escala } })
  })

  r.get('/puntos', (_req, res) => {
    res.json(repo.listar().map(vistaPunto))
  })

  r.post('/puntos', async (req, res) => {
    const e = validar(EntradaPunto, req.body)
    const w = await resolverWallet(e.billetera)
    if (e.programaId) {
      const p = programas.obtener(e.programaId)
      if (!p) throw noEncontrado('Ese programa no existe')
      if (p.codigo_moneda !== w.codigoMoneda || p.escala_moneda !== w.escala) {
        throw conflicto('MonedaDistinta', `La cuenta del punto es en ${w.codigoMoneda} y el programa en ${p.codigo_moneda}`)
      }
    }
    const billetera = w.id.replace(/\/+$/, '')
    const existente = repo.porBilletera(billetera)
    if (existente) throw conflicto('PuntoExiste', `Esa cuenta ya es del punto «${existente.nombre}»`)
    res.status(201).json(vistaPunto(repo.crear({ nombre: e.nombre, direccion: e.direccion, billetera, tipo: e.tipo })))
  })

  r.get('/puntos/:id/cobros', (req, res) => {
    const punto = repo.obtener(req.params.id)
    if (!punto) throw noEncontrado('Ese punto no existe')
    const desde = req.query.desde === 'hoy' ? inicioDeHoy() : undefined
    res.json(cobros.dePunto(punto.id, desde).map((c) => vistaCobro(c, { eventos: false })))
  })

  return r
}

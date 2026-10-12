import { Router } from 'express'
import { z } from 'zod'
import { pagosPendientes } from '../beneficiarios/servicio.js'
import { conflicto, ErrorApi, noEncontrado, validar } from '../comun/errores.js'
import { aTexto } from '../comun/montos.js'
import { moneda, vistaCobro, vistaPersona, vistaPunto } from '../comun/vistas.js'
import * as beneficiarios from '../db/repositorios/beneficiarios.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import * as repo from '../db/repositorios/puntos.js'
import { LiquidacionNoResponde } from '../liquidacion/cliente.js'
import { documento } from '../liquidacion/contrato.js'
import * as datosLiquidacion from '../liquidacion/datos.js'
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

/** Periodo de la caja y del historial del punto (D-36). */
const Periodo = z.enum(['hoy', '7d', 'todo'])

function desdeDe(valor: unknown): string | undefined {
  if (valor === 'hoy') return inicioDeHoy()
  if (valor === '7d') return new Date(Date.parse(inicioDeHoy()) - 6 * 86_400_000).toISOString()
  return undefined
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

  // El punto digita la cédula y ve qué subsidios puede pagarle hoy; si hay varios, elige uno
  r.get('/puntos/:id/pagos', async (req, res) => {
    if (!repo.obtener(req.params.id)) throw noEncontrado('Ese punto no existe')
    const doc = validar(z.object({ documento }), req.query).documento
    const b = beneficiarios.porDocumento(doc)
    // Igual que un cobro con una cédula desconocida: no se dice si existe (D-26)
    if (!b) throw new ErrorApi(404, 'SinPagoDisponible', 'Esta cédula no tiene pagos disponibles')
    const { pagos, liquidacionDisponible } = await pagosPendientes(b, { soloQueReciben: true })
    if (!pagos.length && !liquidacionDisponible) throw new LiquidacionNoResponde()
    res.json({ persona: { ...vistaPersona(b), tienePin: datosLiquidacion.tienePin(doc) }, pagos })
  })

  r.get('/puntos/:id/cobros', (req, res) => {
    const punto = repo.obtener(req.params.id)
    if (!punto) throw noEncontrado('Ese punto no existe')
    res.json(cobros.dePunto(punto.id, desdeDe(req.query.desde)).map((c) => vistaCobro(c, { eventos: false })))
  })

  // D-36 · la caja del punto: cuánto entregó, cuánto le reembolsaron y en cuánto tiempo
  r.get('/puntos/:id/resumen', (req, res) => {
    const punto = repo.obtener(req.params.id)
    if (!punto) throw noEncontrado('Ese punto no existe')
    const periodo = Periodo.catch('hoy').parse(req.query.desde)
    const lista = cobros.dePunto(punto.id, desdeDe(periodo))
    const pagados = lista.filter((c) => c.estado === 'Pagado')

    // Por moneda: un punto puede atender programas en monedas distintas (en la demo, todo es COP)
    const totales = new Map<string, { moneda: { codigo: string; escala: number }; entregado: number; pendiente: number }>()
    for (const c of lista.filter((x) => x.estado === 'Pagado' || x.estado === 'Pagando')) {
      const p = programas.obtener(c.programa_id)!
      const t = totales.get(p.codigo_moneda) ?? { moneda: moneda(p), entregado: 0, pendiente: 0 }
      if (c.estado === 'Pagado') t.entregado += c.monto ?? 0
      else t.pendiente += c.monto ?? 0
      totales.set(p.codigo_moneda, t)
    }

    // Del PIN (PorConfirmar → Pagando) al reembolso (Pagado), como en el tablero de la entidad
    const tiempos = pagados
      .map((c) => {
        const desde = eventos.ultimoHacia('cobro', c.id, 'Pagando')?.creado_en
        const hasta = eventos.ultimoHacia('cobro', c.id, 'Pagado')?.creado_en
        return desde && hasta ? (Date.parse(hasta) - Date.parse(desde)) / 1000 : null
      })
      .filter((t): t is number => t !== null)

    res.json({
      punto: vistaPunto(punto),
      periodo,
      // Lo entregado es lo reembolsado: el punto solo entrega cuando ve «Pagado», y Pagado es el
      // pago ya recibido en su wallet. Por eso no hay plata girada por adelantado.
      totales: [...totales.values()].map((t) => ({ moneda: t.moneda, entregado: aTexto(t.entregado), reembolsado: aTexto(t.entregado), pendiente: aTexto(t.pendiente) })),
      cobros: {
        pagados: pagados.length,
        enCurso: lista.filter((c) => c.estado === 'Solicitado' || c.estado === 'PorConfirmar' || c.estado === 'Pagando').length,
        rechazados: lista.filter((c) => c.estado === 'Rechazado' || c.estado === 'Fallido').length,
      },
      reembolsoSegundos: tiempos.length ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10 : null,
      giradoPorAdelantado: '0',
    })
  })

  return r
}

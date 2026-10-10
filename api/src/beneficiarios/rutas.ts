import { Router } from 'express'
import { z } from 'zod'
import { noEncontrado, validar } from '../comun/errores.js'
import { fechaBogota, moneda, vistaCobro, vistaCuenta, vistaPersona } from '../comun/vistas.js'
import * as repo from '../db/repositorios/beneficiarios.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import * as programas from '../db/repositorios/programas.js'
import { documento } from '../liquidacion/contrato.js'
import * as liquidacion from '../liquidacion/cliente.js'
import * as datosLiquidacion from '../liquidacion/datos.js'
import * as servicio from './servicio.js'

// Registro del equipo: la cédula y la wallet; el nombre y el PIN son opcionales
const EntradaPersona = z.object({
  documento: z.string().trim().regex(/^\d{5,12}$/, 'la cédula va sin puntos ni espacios: de 5 a 12 dígitos'),
  billetera: z.string().trim().min(3),
  nombre: z.string().trim().max(80).optional().transform((v) => v || undefined),
  pin: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos').optional()),
})

/** Beneficiarios (D-05): cédulas de prueba y resumen (HU-08). */
export function rutasBeneficiarios(): Router {
  const r = Router()

  // Para el selector de rol: solo nombre, etiqueta y la cédula de prueba
  r.get('/beneficiarios/demo', (_req, res) => {
    res.json(repo.listar().map((b) => ({ documento: b.numero_documento, ...vistaPersona(b) })))
  })

  // El equipo de prueba: quién está registrado, con qué wallet y si tiene PIN
  r.get('/beneficiarios', async (_req, res) => {
    res.json(await servicio.listar())
  })

  r.post('/beneficiarios', async (req, res) => {
    res.status(201).json(await servicio.registrar(validar(EntradaPersona, req.body)))
  })

  // El PIN de alguien ya registrado: hace falta para retirar en un punto
  r.post('/beneficiarios/:documento/pin', (req, res) => {
    const doc = validar(documento, req.params.documento)
    const { pin } = validar(z.object({ pin: z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos') }), req.body)
    if (!repo.porDocumento(doc) || !datosLiquidacion.ponerPin(doc, pin)) throw noEncontrado('Esa cédula no está registrada')
    res.json({ documento: doc, tienePin: true })
  })

  // HU-08: «Tienes $230.000», vigencia, estado de la cuenta y último cobro
  r.get('/beneficiarios/:documento/resumen', async (req, res) => {
    const doc = validar(documento, req.params.documento)
    const b = repo.porDocumento(doc)
    if (!b) throw noEncontrado('Esa cédula no está registrada')
    const propios = cobros.deBeneficiario(b.id)

    // El pago disponible: el primer programa Activo o Pausado donde la persona no ha cobrado
    let pago = null
    let liquidacionDisponible = true
    for (const p of programas.listar().filter((x) => x.estado === 'Activo' || x.estado === 'Pausado')) {
      if (propios.some((c) => c.programa_id === p.id && c.estado === 'Pagado')) continue
      try {
        const disponible = await liquidacion.pago(p.id, doc)
        if (!disponible.disponible) continue
        pago = {
          programa: { id: p.id, nombre: p.nombre, estado: p.estado },
          monto: disponible.monto,
          moneda: moneda(p),
          vigenciaFin: fechaBogota(p.vigencia_fin),
        }
        break
      } catch {
        liquidacionDisponible = false
      }
    }

    const ultimo = propios.find((c) => c.estado === 'Pagado' || c.estado === 'Pagando')
    res.json({
      persona: { nombre: b.primer_nombre, documento: b.numero_documento, tienePin: datosLiquidacion.tienePin(doc) },
      pago,
      liquidacionDisponible,
      cuenta: vistaCuenta(cuentas.ultimaDe(b.id)),
      ultimoCobro: ultimo ? vistaCobro(ultimo, { eventos: false }) : null,
      historial: propios.map((c) => vistaCobro(c, { eventos: false })),
    })
  })

  return r
}

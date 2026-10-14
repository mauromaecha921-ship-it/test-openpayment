import { Router } from 'express'
import { z } from 'zod'
import { noEncontrado, validar } from '../comun/errores.js'
import { nombresDe, nombrePersona, vistaCuenta, vistaPersona, vistasCobros } from '../comun/vistas.js'
import * as repo from '../db/repositorios/beneficiarios.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import * as liquidacion from '../liquidacion/cliente.js'
import { documento } from '../liquidacion/contrato.js'
import * as servicio from './servicio.js'

// Registro del equipo: la cédula y la wallet; el nombre y el PIN son opcionales
export const EntradaPersona = z.object({
  documento: z.string().trim().regex(/^\d{5,12}$/, 'la cédula va sin puntos ni espacios: de 5 a 12 dígitos'),
  billetera: z.string().trim().min(3),
  nombre: z.string().trim().max(80).optional().transform((v) => v || undefined),
  pin: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos').optional()),
  // Plan Bre-B: «llaveCedula» registra su cédula como llave Bre-B (en el banco puente simulado) y no
  // le enlaza cuenta en Tatú; al cobrar, RN-17 la encuentra sola
  cobraCon: z.enum(['wallet', 'llaveCedula']).default('wallet'),
})

/** Beneficiarios (D-05): cédulas de prueba y resumen (HU-08). */
export function rutasBeneficiarios(): Router {
  const r = Router()

  // Para el selector de rol: solo nombre, etiqueta y la cédula de prueba
  r.get('/beneficiarios/demo', async (_req, res) => {
    const lista = await repo.listar()
    const nombres = await nombresDe(lista.map((b) => b.numero_documento))
    res.json(lista.map((b) => ({ documento: b.numero_documento, ...vistaPersona(b, nombres) })))
  })

  // El equipo de prueba: quién está registrado, con qué wallet y si tiene PIN
  r.get('/beneficiarios', async (_req, res) => {
    res.json(await servicio.listar())
  })

  r.post('/beneficiarios', async (req, res) => {
    res.status(201).json(await servicio.registrar(validar(EntradaPersona, req.body)))
  })

  // El PIN de alguien ya registrado: hace falta para retirar en un punto (lo guarda el gobierno)
  r.post('/beneficiarios/:documento/pin', async (req, res) => {
    const doc = validar(documento, req.params.documento)
    const { pin } = validar(z.object({ pin: z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos') }), req.body)
    if (!(await repo.porDocumento(doc)) || !(await liquidacion.ponerPin(doc, pin))) throw noEncontrado('Esa cédula no está registrada')
    res.json({ documento: doc, tienePin: true })
  })

  // HU-08: «Tienes $230.000», vigencia, estado de la cuenta y último cobro
  r.get('/beneficiarios/:documento/resumen', async (req, res) => {
    const doc = validar(documento, req.params.documento)
    const b = await repo.porDocumento(doc)
    if (!b) throw noEncontrado('Esa cédula no está registrada')
    // Todos los subsidios por cobrar, no solo el primero: una persona puede estar en varios programas
    const [propios, { pagos, liquidacionDisponible }, cuenta, enGobierno] = await Promise.all([
      cobros.deBeneficiario(b.id),
      servicio.pagosPendientes(b),
      cuentas.ultimaDe(b.id),
      nombresDe([doc]),
    ])
    const historial = await vistasCobros(propios, { eventos: false })
    const ultimo = historial.find((c) => c.estado === 'Pagado' || c.estado === 'Pagando')
    res.json({
      persona: { nombre: nombrePersona(doc, enGobierno), documento: b.numero_documento, tienePin: enGobierno.get(doc)?.tienePin ?? false },
      pagos,
      // El primero, para quien solo mira un pago (compatibilidad)
      pago: pagos[0] ?? null,
      liquidacionDisponible,
      cuenta: vistaCuenta(cuenta, b.numero_documento),
      ultimoCobro: ultimo ?? null,
      historial,
    })
  })

  return r
}

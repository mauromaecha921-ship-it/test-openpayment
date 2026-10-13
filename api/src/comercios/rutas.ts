import { Router } from 'express'
import { z } from 'zod'
import { conflicto, ErrorApi, noEncontrado, validar } from '../comun/errores.js'
import { vistaComercioDe, vistasComercios, vistasPuntos } from '../comun/vistas.js'
import { esRestriccion, transaccion } from '../db/conexion.js'
import * as repo from '../db/repositorios/comercios.js'
import * as programas from '../db/repositorios/programas.js'
import * as puntos from '../db/repositorios/puntos.js'
import { resolverWallet } from '../programas/servicio.js'
import { CATEGORIAS, categoriaDe } from './categorias.js'

export const EntradaSede = z.object({
  nombre: z.string().trim().min(3).max(80),
  direccion: z.string().trim().max(120).optional().transform((v) => (v && v.length >= 3 ? v : 'Sin dirección')),
  billetera: z.string().trim().min(3),
})

export const EntradaComercio = z.object({
  nit: z.string().trim().regex(/^\d{5,15}$/, 'el NIT va sin puntos, sin guion y sin dígito de verificación'),
  razonSocial: z.string().trim().min(3).max(120),
  ciiu: z.string().trim().regex(/^\d{4}$/, 'la actividad CIIU tiene 4 dígitos'),
  sede: EntradaSede,
})

/** Una sede es un punto de tipo «compra» con su propia wallet (en la Test Wallet, puede ser de la misma cuenta que las demás sedes). */
async function walletDeSede(direccion: string): Promise<string> {
  const w = await resolverWallet(direccion)
  const billetera = w.id.replace(/\/+$/, '')
  const existente = await puntos.porBilletera(billetera)
  if (existente) throw conflicto('PuntoExiste', `Esa wallet ya es de «${existente.nombre}»`)
  return billetera
}

async function exigirComercio(id: string) {
  const c = await repo.obtener(id)
  if (!c) throw noEncontrado('Ese comercio no existe')
  return c
}

/**
 * Comercios y sus sedes (Plan de ajustes § 11). El comercio se registra con su NIT y su actividad
 * del RUT; la entidad lo verifica (en producción, cruzando con el RUT de la DIAN y el RUES; en el
 * piloto, con un botón). Solo los verificados aceptan bonos.
 */
export function rutasComercios(): Router {
  const r = Router()

  r.get('/categorias', (_req, res) => {
    res.json(CATEGORIAS)
  })

  r.get('/comercios', async (_req, res) => {
    res.json(await vistasComercios(await repo.listar()))
  })

  r.post('/comercios', async (req, res) => {
    const e = validar(EntradaComercio, req.body)
    const categoria = categoriaDe(e.ciiu)
    if (!categoria) throw new ErrorApi(400, 'ActividadSinCategoria', 'Esa actividad no está en ninguna categoría de bono')
    if (await repo.porNit(e.nit)) throw conflicto('ComercioExiste', 'Ya hay un comercio con ese NIT: agrégale una sede')
    const billetera = await walletDeSede(e.sede.billetera)
    try {
      const c = await transaccion(async () => {
        const nuevo = await repo.crear({ nit: e.nit, razon_social: e.razonSocial, ciiu: e.ciiu, categoria: categoria.id })
        await puntos.crear({ nombre: e.sede.nombre, direccion: e.sede.direccion, billetera, tipo: 'compra', comercio_id: nuevo.id })
        return nuevo
      })
      res.status(201).json(await vistaComercioDe(c))
    } catch (err) {
      if (esRestriccion(err)) throw conflicto('ComercioExiste', 'Ese NIT o esa wallet ya están registrados')
      throw err
    }
  })

  r.post('/comercios/:id/sedes', async (req, res) => {
    const c = await exigirComercio(req.params.id)
    const e = validar(EntradaSede, req.body)
    const billetera = await walletDeSede(e.billetera)
    await puntos.crear({ nombre: e.nombre, direccion: e.direccion, billetera, tipo: 'compra', comercio_id: c.id })
    res.status(201).json(await vistaComercioDe(c))
  })

  // Simulación de la verificación del gobierno (RUT y RUES): en el piloto, la entidad pulsa un botón
  r.post('/comercios/:id/verificar', async (req, res) => {
    const c = await exigirComercio(req.params.id)
    await repo.verificar(c.id)
    res.json(await vistaComercioDe((await repo.obtener(c.id))!))
  })

  // Dónde se puede usar un bono: las sedes autorizadas (lo ve el beneficiario)
  r.get('/programas/:id/comercios', async (req, res) => {
    if (!(await programas.obtener(req.params.id))) throw noEncontrado('Ese programa no existe')
    res.json(await vistasPuntos(await puntos.autorizadosEnPrograma(req.params.id)))
  })

  return r
}

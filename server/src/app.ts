import express from 'express'
import { rutasBeneficiarios } from './beneficiarios/rutas.js'
import { rutasComercios } from './comercios/rutas.js'
import { rutasCobros } from './cobros/rutas.js'
import { manejarErrores } from './comun/errores.js'
import { rutasCuentas } from './cuentas/rutas.js'
import { rutasExtras } from './extras.js'
import { routerLiquidacion } from './liquidacion/router.js'
import { rutasOpenApi } from './openapi.js'
import { rutasProgramas } from './programas/rutas.js'
import { rutasPuntos } from './puntos/rutas.js'
import { routerPuente } from './puente/router.js'
import { rutasSalud } from './salud.js'

/** Arma la app y monta los routers bajo /api. La usan main.ts y los tests. */
export function crearApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '20kb' }))

  const api = express.Router()
  api.use(rutasSalud())
  api.use(rutasExtras())
  api.use(rutasOpenApi())
  api.use('/liquidacion', routerLiquidacion())
  api.use('/puente', routerPuente())
  api.use(rutasProgramas())
  api.use(rutasPuntos())
  api.use(rutasComercios())
  api.use(rutasBeneficiarios())
  api.use(rutasCuentas())
  api.use(rutasCobros())
  api.use((_req, res) => {
    res.status(404).json({ error: { codigo: 'NoEncontrado', mensaje: 'Esa ruta no existe' } })
  })

  app.use('/api', api)
  app.use(manejarErrores)
  return app
}

import express from 'express'
import { config } from './config'
import { rutas as programas } from './programas/rutas'
import { rutas as cuentas } from './cuentas/rutas'
import { rutas as cobros } from './cobros/rutas'
import { router as liquidacion } from './liquidacion/router'
import { rutas as extras } from './extras'

const app = express()
app.use(express.json())

// Mapa completo ruta → archivo: Estructura del proyecto § 4.
app.use(programas) // /programas*, /callback/:id
app.use(cuentas) // /cuentas, /cuentas/callback/:id
app.use(cobros) // /cobros*
app.use('/liquidacion', liquidacion) // simulador (AD-13 / P-02)
app.use(extras) // /config

app.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT}`)
})

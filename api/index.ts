import type { IncomingMessage, ServerResponse } from 'node:http'
import './src/certificados.js'
import { crearApp } from './src/app.js'
import { recuperarAlArrancar } from './src/cobros/orquestacion.js'
import { baseDeDatos } from './src/config.js'
import { log } from './src/comun/log.js'
import { abrirBd } from './src/db/conexion.js'
import { migrar } from './src/db/migrar.js'

/**
 * Entrada para Vercel: la misma app Express de main.ts, sin `listen()` (la plataforma invoca
 * el handler) y sin `iniciarRenovacion()` (un setInterval no sobrevive en serverless; el token
 * se rota on-demand en cada uso, D-35). La base y las migraciones se hacen una vez por
 * instancia fría; si algo falla, se limpia la promesa para reintentar en la siguiente petición.
 */
let listo: Promise<void> | undefined

function preparar(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      const base = baseDeDatos()
      if (base.aviso) log.warn(base.aviso)
      await abrirBd(base)
      const nuevas = await migrar()
      log.info(`Base de datos: ${base.descripcion}`, nuevas.length ? { migracionesAplicadas: nuevas } : undefined)
      recuperarAlArrancar()
        .then((n) => n && log.info('Recuperación al arrancar terminada', { cobrosEnPagando: n }))
        .catch((e) => log.error('Falló la recuperación al arrancar', { error: e }))
    })().catch((e) => {
      listo = undefined
      throw e
    })
  }
  return listo
}

const app = crearApp()

export default async function manejar(pedido: IncomingMessage, respuesta: ServerResponse) {
  try {
    await preparar()
  } catch (e) {
    log.error('La instancia no pudo conectar con la base de datos', { error: e })
    if (!respuesta.headersSent) {
      respuesta.statusCode = 503
      respuesta.setHeader('content-type', 'application/json; charset=utf-8')
      respuesta.end(JSON.stringify({ ok: false, error: 'La base de datos no responde; vuelve a intentar.' }))
    }
    return
  }
  app(pedido, respuesta)
}

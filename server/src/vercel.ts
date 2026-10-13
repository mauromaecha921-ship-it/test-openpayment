import './certificados.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { waitUntil } from '@vercel/functions'
import { crearApp } from './app.js'
import { recuperarAlArrancar } from './cobros/orquestacion.js'
import { log } from './comun/log.js'
import { baseDeDatos, config } from './config.js'
import { abrirBd, conexion } from './db/conexion.js'
import { migrar } from './db/migrar.js'
import { renovarTodos } from './programas/renovacion.js'

/**
 * Entrada de la API en Vercel: una función que sirve todo /api con la misma app de Express que
 * main.ts. No hay proceso prendido, así que lo que main.ts hace al arrancar (abrir la base,
 * migrar, recuperar cobros en Pagando) se hace en el primer pedido de cada instancia, y la
 * renovación de tokens (D-35) se dispara con los pedidos en vez de un setInterval.
 */

/** Clave del candado de PostgreSQL para que una sola instancia renueve a la vez. */
const CANDADO_RENOVACION = 720_035

let listo: Promise<void> | undefined
let ultimaRenovacion = 0

function preparar(): Promise<void> {
  listo ??= (async () => {
    const base = baseDeDatos()
    if (base.tipo !== 'postgres') {
      throw new Error('En Vercel DATABASE_URL tiene que ser una URL de PostgreSQL (Supabase, pooler)')
    }
    await abrirBd(base)
    const nuevas = await migrar()
    log.info(`Base de datos: ${base.descripcion}`, nuevas.length ? { migracionesAplicadas: nuevas } : undefined)
    waitUntil(
      recuperarAlArrancar()
        .then((n) => n && log.info('Recuperación al arrancar terminada', { cobrosEnPagando: n }))
        .catch((e) => log.error('Falló la recuperación al arrancar', { error: e })),
    )
  })().catch((e) => {
    listo = undefined
    throw e
  })
  return listo
}

function renovarSiToca() {
  const ahora = Date.now()
  if (ahora - ultimaRenovacion < config().TOKEN_RENOVAR_CADA_SEG * 1000) return
  ultimaRenovacion = ahora
  waitUntil(
    conexion()
      .conCandado(CANDADO_RENOVACION, renovarTodos)
      .then((r) => r && r.renovados + r.vencidos + r.fallidos && log.info('Renovación de tokens', r))
      .catch((e) => log.warn('Falló la renovación de tokens', { error: e })),
  )
}

const app = crearApp()

export default async function manejar(req: IncomingMessage, res: ServerResponse) {
  try {
    await preparar()
  } catch (e) {
    log.error('La API no pudo arrancar', { error: e })
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: { codigo: 'NoDisponible', mensaje: 'La API no pudo conectarse a la base de datos' } }))
    return
  }
  renovarSiToca()
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1])
}

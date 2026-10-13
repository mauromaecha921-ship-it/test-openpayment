/**
 * Ayuda común de las pruebas de integración: PostgreSQL en memoria (PGlite) con las migraciones
 * de verdad, la semilla base, la app y un programa ya Activo creado por la API (con un callback de
 * hash válido).
 */
import { createHash } from 'node:crypto'
import request from 'supertest'
import { crearApp } from '../src/app.js'
import { baseDeDatos } from '../src/config.js'
import { abrirBd, conexion } from '../src/db/conexion.js'
import { migrar, vaciar } from '../src/db/migrar.js'
import { IDS, sembrarBase } from '../src/db/semillas/base.js'
import * as programas from '../src/db/repositorios/programas.js'
import { AUTH, reiniciarEstado } from './falsos.js'

export { IDS }

function bdAbierta(): boolean {
  try {
    conexion()
    return true
  } catch {
    return false
  }
}

/**
 * Cada archivo de pruebas abre su propia base en memoria y la migra una vez (vitest corre cada
 * archivo en su proceso); entre caso y caso la vacía, que es mucho más rápido que migrar otra vez.
 */
export async function prepararBd() {
  if (!bdAbierta()) {
    await abrirBd(baseDeDatos())
    await migrar()
  } else {
    await vaciar()
  }
  await sembrarBase()
  reiniciarEstado()
}

export const app = () => crearApp()

export async function hashValido(programaId: string, interactRef: string) {
  const p = (await programas.obtener(programaId))!
  const base = `${p.nonce_cliente}\n${p.nonce_cierre}\n${interactRef}\n${AUTH}`
  return createHash('sha256').update(base).digest('base64')
}

export const PROGRAMA = {
  entidad: 'Entidad de prueba',
  nombre: 'Subsidio adulto mayor (simulado)',
  billetera: '$ilp.interledger-test.dev/prueba-programa',
  vigenciaInicio: '2026-01-01T00:00:00.000Z',
  vigenciaFin: '2099-12-31T23:59:59.000Z',
}

/** O1 + O2 por la API: crea, autoriza y hace el callback con hash válido. */
export async function programaActivo(): Promise<string> {
  const a = app()
  const creado = await request(a).post('/api/programas').send(PROGRAMA).expect(201)
  const id = creado.body.id as string
  await request(a).post(`/api/programas/${id}/autorizar`).expect(200)
  const ref = 'interact-ref-de-prueba'
  await request(a)
    .get(`/api/callback/${id}`)
    .query({ interact_ref: ref, hash: await hashValido(id, ref) })
    .expect(302)
  return id
}

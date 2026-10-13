import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { app, hashValido, IDS, prepararBd, PROGRAMA } from '../test/ayuda.js'
import { SECRETOS } from '../test/falsos.js'
import { esperarPagos } from './cobros/orquestacion.js'
import { conexion } from './db/conexion.js'
import * as programas from './db/repositorios/programas.js'

vi.mock('./openPaymentsService.js', async (orig) => (await import('../test/falsos.js')).falsoOP(await orig()))
vi.mock('./liquidacion/cliente.js', async (orig) => (await import('../test/falsos.js')).falsaLiquidacion(await orig()))

/**
 * V-20 / RNF-01 / RNF-09: ninguna respuesta ni evento contiene tokens, nonces, llaves ni PIN.
 * Recorre el flujo completo y revisa cada cuerpo de respuesta y cada fila de evento.
 */
const a = app()
const cuerpos: string[] = []
let nonceCliente = ''

async function guardar<T extends { text: string }>(p: Promise<T>): Promise<T> {
  const r = await p
  cuerpos.push(r.text ?? '')
  return r
}

beforeAll(async () => {
  await prepararBd()
  const id = (await guardar(request(a).post('/api/programas').send(PROGRAMA))).text && JSON.parse(cuerpos.at(-1)!).id
  await guardar(request(a).post(`/api/programas/${id}/autorizar`))
  nonceCliente = (await programas.obtener(id))!.nonce_cliente!
  await guardar(request(a).get(`/api/programas/${id}`))
  await guardar(request(a).get('/api/programas'))
  await request(a).get(`/api/callback/${id}`).query({ interact_ref: 'ref-seguridad', hash: await hashValido(id, 'ref-seguridad') })

  const c = JSON.parse(
    (await guardar(request(a).post('/api/cobros').send({ documento: '900000003', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: 'seguridad-1' })))
      .text,
  )
  await guardar(request(a).post(`/api/cobros/${c.id}/confirmar`).send({ pin: '1234' }))
  await guardar(request(a).post(`/api/cobros/${c.id}/confirmar`).send({ pin: '3333' }))
  await guardar(request(a).post('/api/cobros').send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: 'seguridad-2' }))
  await esperarPagos()
  await guardar(request(a).get(`/api/cobros/${c.id}`))
  await guardar(request(a).post('/api/cuentas').send({ documento: '900000002', billetera: '$ilp.interledger-test.dev/prueba-luis', pin: '2222' }))
  await guardar(request(a).get('/api/cuentas/900000002'))
  await guardar(request(a).get('/api/beneficiarios/900000003/resumen'))
  await guardar(request(a).get('/api/beneficiarios/demo'))
  await guardar(request(a).get(`/api/puntos/${IDS.punto}/cobros`))
  await guardar(request(a).get(`/api/programas/${id}/tablero`))
  await guardar(request(a).get('/api/config'))
  await guardar(request(a).get('/api/salud'))
  await guardar(request(a).post(`/api/programas/${id}/cerrar`).send({ confirmacion: 'CERRAR' }))
})

const prohibidos = () => [...Object.values(SECRETOS), nonceCliente]

describe('cero secretos (V-20)', () => {
  it('ninguna respuesta incluye tokens, nonces ni URLs de gestión o continuación', () => {
    expect(cuerpos.length).toBeGreaterThan(15)
    for (const cuerpo of cuerpos) {
      for (const secreto of prohibidos()) expect(cuerpo).not.toContain(secreto)
      expect(cuerpo).not.toMatch(/token_acceso|url_gestion|uri_continuacion|token_continuacion|nonce_|url_permiso|tokenAcceso|urlGestion/)
    }
  })

  it('ningún evento guarda tokens, nonces, PIN ni la cédula completa', async () => {
    const filas = await conexion().filas<{ detalle: string }>('SELECT detalle::text AS detalle FROM evento')
    expect(filas.length).toBeGreaterThan(10)
    for (const { detalle } of filas) {
      for (const secreto of prohibidos()) expect(detalle).not.toContain(secreto)
      expect(detalle).not.toMatch(/9000000\d\d|"pin"|1234|3333/)
    }
  })

  it('al cerrar, el programa ya no guarda el token', async () => {
    const [p] = await conexion().filas<Record<string, unknown>>('SELECT token_acceso, url_gestion FROM programa')
    expect(p).toEqual({ token_acceso: null, url_gestion: null })
  })
})

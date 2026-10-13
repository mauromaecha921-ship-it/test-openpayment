import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import { AUTH, estado } from '../../test/falsos.js'
import { esperarPagos } from '../cobros/orquestacion.js'
import { reiniciarConfig } from '../config.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import * as op from '../openPaymentsService.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
const LUIS = { documento: '900000002', billetera: '$ilp.interledger-test.dev/prueba-luis', pin: '2222' }

async function hashCuenta(id: string, ref: string) {
  const c = (await cuentas.obtener(id))!
  return createHash('sha256').update(`${c.nonce_cliente}\n${c.nonce_cierre}\n${ref}\n${AUTH}`).digest('base64')
}

beforeEach(async () => {
  await prepararBd()
  vi.mocked(op.continuarVerificacion).mockClear()
})
afterEach(() => {
  reiniciarConfig({ VERIFICACION_CUENTA: 'subject' })
})

describe('enlazar la cuenta (O3, HU-07)', () => {
  it('PIN errado → 422 y no crea cuenta', async () => {
    await request(a).post('/api/cuentas').send({ ...LUIS, pin: '0000' }).expect(422)
    expect((await cuentas.vigenteDe(IDS.luis))).toBeUndefined()
  })

  it('pide el permiso con subject, el callback con hash válido la deja Verificada', async () => {
    const r = (await request(a).post('/api/cuentas').send(LUIS).expect(201)).body
    expect(r.redirect).toMatch(/^https:\/\//)
    expect(r.cuenta.estado).toBe('PorVerificar')
    const id = r.cuenta.id as string

    const cb = await request(a).get(`/api/cuentas/callback/${id}`).query({ interact_ref: 'ref-c', hash: await hashCuenta(id, 'ref-c') })
    expect(cb.headers.location).toBe('http://localhost:5173/beneficiario/cuenta?resultado=verificada')
    const c = (await cuentas.obtener(id))!
    expect(c.estado).toBe('Verificada')
    expect([c.nonce_cliente, c.uri_continuacion, c.token_continuacion]).toEqual([null, null, null])
    expect((await request(a).get('/api/cuentas/900000002')).body.estado).toBe('Verificada')
  })

  it('hash alterado → sigue PorVerificar; sub_id distinto → SinEnlazar', async () => {
    const id = (await request(a).post('/api/cuentas').send(LUIS)).body.cuenta.id as string
    const malo = await request(a).get(`/api/cuentas/callback/${id}`).query({ interact_ref: 'ref-c', hash: 'alterado' })
    expect(malo.headers.location).toMatch(/resultado=invalido$/)
    expect((await cuentas.obtener(id))!.estado).toBe('PorVerificar')

    vi.mocked(op.continuarVerificacion).mockResolvedValueOnce(false)
    const otro = await request(a).get(`/api/cuentas/callback/${id}`).query({ interact_ref: 'ref-c', hash: await hashCuenta(id, 'ref-c') })
    expect(otro.headers.location).toMatch(/resultado=rechazada$/)
    expect((await cuentas.obtener(id))!.estado).toBe('SinEnlazar')
  })

  it('una sola cuenta vigente: enlazar otra deja la anterior como historial', async () => {
    const primera = (await request(a).post('/api/cuentas').send(LUIS)).body.cuenta.id
    const segunda = (await request(a).post('/api/cuentas').send({ ...LUIS, billetera: '$ilp.interledger-test.dev/prueba-luis-2' })).body.cuenta.id
    expect((await cuentas.obtener(primera))!.estado).toBe('SinEnlazar')
    expect((await cuentas.vigenteDe(IDS.luis))!.id).toBe(segunda)
  })

  it('plan B (VERIFICACION_CUENTA=simulada): queda Verificada sin redirect, y Luis cobra a su cuenta', async () => {
    reiniciarConfig({ VERIFICACION_CUENTA: 'simulada' })
    await programaActivo()
    const r = (await request(a).post('/api/cuentas').send(LUIS).expect(201)).body
    expect(r).toMatchObject({ redirect: null, cuenta: { estado: 'Verificada' } })
    expect(op.pedirVerificacionCuenta).not.toHaveBeenCalled()

    const c = (await request(a).post('/api/cobros').send({ documento: '900000002', canal: 'cuenta', llaveIdempotencia: 'luis-a-su-cuenta' })).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
  })
})

describe('token del permiso (HU-06)', () => {
  it('401 al pagar → token.rotate y un solo reintento', async () => {
    await programaActivo()
    vi.mocked(op.crearPagoSaliente).mockRejectedValueOnce(new op.ErrorOP('TokenVencido', 401))
    const c = (await request(a).post('/api/cobros').send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: 'ana-con-rotacion' })).body
    await esperarPagos()
    expect(op.rotarToken).toHaveBeenCalledTimes(1)
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
    expect(estado.gastado).toBe(23000000)
  })

  it('si el reintento también da 401 → Fallido con PermisoVencido', async () => {
    await programaActivo()
    vi.mocked(op.crearPagoSaliente)
      .mockRejectedValueOnce(new op.ErrorOP('TokenVencido', 401))
      .mockRejectedValueOnce(new op.ErrorOP('TokenVencido', 401))
    const c = (await request(a).post('/api/cobros').send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: 'ana-permiso-vencido' })).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.motivo.codigo).toBe('PermisoVencido')
  })

  it('timeout al crear el pago → sigue en Pagando, nunca Fallido', async () => {
    await programaActivo()
    vi.mocked(op.crearPagoSaliente).mockRejectedValueOnce(new op.ErrorOP('SinRespuesta'))
    const c = (await request(a).post('/api/cobros').send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: 'ana-sin-respuesta' })).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagando')
  })
})

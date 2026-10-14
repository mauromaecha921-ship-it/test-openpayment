import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import { estado } from '../../test/falsos.js'
import { esperarPagos } from '../cobros/orquestacion.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import * as op from '../openPaymentsService.js'
import { normalizarLlave } from './contrato.js'
import * as datos from './datos.js'
import { enmascararLlave, enmascararNombre } from './enmascarar.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))
vi.mock('./cliente.js', async (orig) => (await import('../../test/falsos.js')).falsoPuente(await orig()))

const a = app()
// Luis (PIN 2222) y Jorge (PIN 3333) no tienen cuenta en la semilla base
const LUIS = '900000002'
const JORGE = '900000003'
const WALLET_LUIS = 'https://ilp.interledger-test.dev/prueba-luis'
const WALLET_LUIS_NUEVA = 'https://ilp.interledger-test.dev/prueba-luis-nequi'
const WALLET_JORGE = 'https://ilp.interledger-test.dev/prueba-jorge'

/** «Equipo de prueba» haciendo de banco: registra una llave en el puente simulado. */
function llave(tipo: 'cedula' | 'celular' | 'correo' | 'alfanumerica', valor: string, titular: string, nombre: string, billetera: string) {
  return request(a).post('/api/puente/llaves').send({ tipo, valor, documentoTitular: titular, nombreTitular: nombre, billetera })
}

const cobrar = (documento: string) => request(a).post('/api/cobros').send({ documento, canal: 'cuenta', llaveIdempotencia: randomUUID() })

beforeEach(async () => {
  await prepararBd()
  vi.mocked(op.pedirVerificacionCuenta).mockClear()
  vi.mocked(op.crearPagoEntrante).mockClear()
})

describe('formato y enmascarado de llaves (RN-14)', () => {
  it('limpia según el tipo elegido y rechaza lo que no es de ese tipo', () => {
    expect(normalizarLlave('celular', '+57 300 123 4567')).toBe('3001234567')
    expect(normalizarLlave('celular', '1234567890')).toBeNull() // parece una cédula: no se adivina
    expect(normalizarLlave('cedula', '1.234.567.890')).toBe('1234567890')
    expect(normalizarLlave('correo', ' Ana@Correo.co ')).toBe('ana@correo.co')
    expect(normalizarLlave('alfanumerica', 'Sebas123')).toBe('@sebas123')
    expect(normalizarLlave('alfanumerica', '@a')).toBeNull()
  })

  it('enmascara el nombre del titular y la llave', () => {
    expect(enmascararNombre('Ana María Rojas')).toBe('Ana M*** R***')
    expect(enmascararLlave('celular', '3001234567')).toBe('300***4567')
    expect(enmascararLlave('cedula', '900000002')).toBe('*****0002')
    expect(enmascararLlave('correo', 'ana@correo.co')).toBe('a***@correo.co')
    expect(enmascararLlave('alfanumerica', '@sebas123')).toBe('@seb***')
  })
})

describe('banco puente simulado (/api/puente)', () => {
  it('resuelve una llave con el titular enmascarado y responde «¿es de esta cédula?» sin revelarla', async () => {
    await llave('celular', '3001234567', LUIS, 'Luis Fernando Pérez', WALLET_LUIS).expect(201)
    const r = (await request(a).get('/api/puente/llaves/celular/3001234567').expect(200)).body
    expect(r).toEqual({ tipo: 'celular', valor: '3001234567', billetera: WALLET_LUIS, titular: 'Luis F*** P***' })
    expect(JSON.stringify(r)).not.toContain(LUIS)
    expect((await request(a).post('/api/puente/llaves/celular/3001234567/pertenece').send({ documento: LUIS })).body).toEqual({ pertenece: true })
    expect((await request(a).post('/api/puente/llaves/celular/3001234567/pertenece').send({ documento: JORGE })).body).toEqual({ pertenece: false })
    await request(a).get('/api/puente/llaves/celular/3009999999').expect(404)
  })

  it('una llave tipo cédula solo la registra su titular, y una llave ajena no se pisa', async () => {
    await llave('cedula', JORGE, LUIS, 'Luis', WALLET_LUIS).expect(422)
    await llave('alfanumerica', '@luis', LUIS, 'Luis', WALLET_LUIS).expect(201)
    await llave('alfanumerica', '@luis', JORGE, 'Jorge', WALLET_JORGE).expect(409)
    // La misma persona sí puede mover su llave a otra wallet
    await llave('alfanumerica', '@luis', LUIS, 'Luis', WALLET_LUIS_NUEVA).expect(200)
    expect((await datos.obtener('alfanumerica', '@luis'))!.billetera).toBe(WALLET_LUIS_NUEVA)
  })
})

describe('enlazar una llave Bre-B (HU-07, RN-15 y RN-16)', () => {
  it('muestra «¿Eres …?» antes de enlazar', async () => {
    await llave('celular', '3001234567', LUIS, 'Luis Pérez', WALLET_LUIS)
    expect((await request(a).get('/api/cuentas/llaves/celular/300 123 4567').expect(200)).body).toEqual({
      tipoLlave: 'celular',
      llave: '300***4567',
      titular: 'Luis P***',
    })
    expect((await request(a).get('/api/cuentas/llaves/celular/3009999999').expect(404)).body.error.codigo).toBe('LlaveNoExiste')
  })

  it('RN-15: su llave tipo cédula queda Verificada sola, sin PIN ni permiso interactivo', async () => {
    await llave('cedula', LUIS, LUIS, 'Luis', WALLET_LUIS)
    const r = (await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'cedula', llave: LUIS }).expect(201)).body
    expect(r).toMatchObject({ redirect: null, cuenta: { estado: 'Verificada', tipoLlave: 'cedula', llave: '*****0002', billetera: WALLET_LUIS } })
    expect(op.pedirVerificacionCuenta).not.toHaveBeenCalled()
  })

  it('RN-15: la cédula de otra persona como llave → LlaveDeOtraPersona', async () => {
    await llave('cedula', JORGE, JORGE, 'Jorge', WALLET_JORGE)
    const r = await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'cedula', llave: JORGE }).expect(422)
    expect(r.body.error).toEqual({ codigo: 'LlaveDeOtraPersona', mensaje: 'Esa llave no está a tu nombre' })
    expect(await cuentas.vigenteDe(IDS.luis)).toBeUndefined()
  })

  it('RN-16: el @alias de otra persona, aun con el PIN correcto → LlaveDeOtraPersona', async () => {
    await llave('alfanumerica', '@jorge', JORGE, 'Jorge', WALLET_JORGE)
    const r = await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'alfanumerica', llave: 'jorge', pin: '2222' }).expect(422)
    expect(r.body.error.codigo).toBe('LlaveDeOtraPersona')
    expect(await cuentas.vigenteDe(IDS.luis)).toBeUndefined()
  })

  it('RN-16: su propio celular pide el PIN; con el PIN correcto queda Verificada', async () => {
    await llave('celular', '3001234567', LUIS, 'Luis', WALLET_LUIS)
    await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'celular', llave: '3001234567', pin: '0000' }).expect(422)
    const r = (await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'celular', llave: '3001234567', pin: '2222' }).expect(201)).body
    expect(r.cuenta).toMatchObject({ estado: 'Verificada', tipoLlave: 'celular', llave: '300***4567' })
  })

  it('una llave que no existe o mal escrita no enlaza nada', async () => {
    expect((await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'cedula', llave: LUIS }).expect(404)).body.error.codigo).toBe('LlaveNoExiste')
    expect((await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'celular', llave: '1234567890', pin: '2222' }).expect(400)).body.error.codigo).toBe('LlaveInvalida')
  })
})

describe('cobrar a la llave Bre-B (HU-09, RN-17 y RN-18)', () => {
  it('RN-17: sin cuenta, «Cobrar» encuentra su cédula como llave, la enlaza y paga', async () => {
    await programaActivo()
    await llave('cedula', LUIS, LUIS, 'Luis', WALLET_LUIS)
    const c = (await cobrar(LUIS).expect(201)).body
    expect(c.estado).toBe('Pagando')
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
    expect(vi.mocked(op.crearPagoEntrante).mock.calls[0]![0]).toMatchObject({ billetera: WALLET_LUIS })
    expect(await cuentas.vigenteDe(IDS.luis)).toMatchObject({ estado: 'Verificada', tipo_llave: 'cedula', llave: LUIS })
  })

  it('RN-17: sin cuenta y sin llave cédula → 409, sin dejar cobro ni cuenta', async () => {
    await programaActivo()
    const r = await cobrar(LUIS).expect(409)
    expect(r.body.error.codigo).toBe('CuentaNoVerificada')
    expect(r.body.error.mensaje).toContain('llave Bre-B')
    expect(await cuentas.vigenteDe(IDS.luis)).toBeUndefined()
  })

  it('RN-18: si la llave se movió a otra wallet, el pago llega a la nueva', async () => {
    await programaActivo()
    await llave('celular', '3001234567', LUIS, 'Luis', WALLET_LUIS)
    await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'celular', llave: '3001234567', pin: '2222' }).expect(201)
    await llave('celular', '3001234567', LUIS, 'Luis', WALLET_LUIS_NUEVA).expect(200)

    const c = (await cobrar(LUIS).expect(201)).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
    expect(vi.mocked(op.crearPagoEntrante).mock.calls[0]![0]).toMatchObject({ billetera: WALLET_LUIS_NUEVA })
    expect((await cuentas.vigenteDe(IDS.luis))!.billetera).toBe(WALLET_LUIS_NUEVA)
  })

  it('RN-18: si la llave se borró, el cobro queda Rechazado sin crear ningún pago', async () => {
    await programaActivo()
    await llave('celular', '3001234567', LUIS, 'Luis', WALLET_LUIS)
    await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'celular', llave: '3001234567', pin: '2222' }).expect(201)
    await request(a).delete('/api/puente/llaves/celular/3001234567').expect(204)

    const c = (await cobrar(LUIS).expect(201)).body
    expect(c).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'LlaveNoExiste' } })
    expect(op.crearPagoEntrante).not.toHaveBeenCalled()
  })

  it('banco puente caído: con cuenta, Rechazado PuenteNoResponde; sin cuenta, 503', async () => {
    await programaActivo()
    await llave('celular', '3001234567', LUIS, 'Luis', WALLET_LUIS)
    await request(a).post('/api/cuentas').send({ documento: LUIS, tipoLlave: 'celular', llave: '3001234567', pin: '2222' }).expect(201)
    estado.puenteCaido = true

    expect((await cobrar(LUIS).expect(201)).body).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'PuenteNoResponde' } })
    expect((await cobrar(JORGE).expect(503)).body.error.codigo).toBe('PuenteNoResponde')
    expect(op.crearPagoEntrante).not.toHaveBeenCalled()
  })

  it('«Equipo de prueba» con cobraCon=llaveCedula: no enlaza cuenta, y el primer cobro la encuentra sola', async () => {
    await programaActivo()
    const p = (
      await request(a)
        .post('/api/beneficiarios')
        .send({ documento: '900000077', billetera: '$ilp.interledger-test.dev/prueba-nueva', nombre: 'Persona Nueva', cobraCon: 'llaveCedula' })
        .expect(201)
    ).body
    expect(p).toMatchObject({ estadoCuenta: null, billetera: null })
    expect(await datos.obtener('cedula', '900000077')).toMatchObject({ billetera: 'https://ilp.interledger-test.dev/prueba-nueva', nombreTitular: 'Persona Nueva' })

    const c = (await cobrar('900000077').expect(201)).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
  })
})

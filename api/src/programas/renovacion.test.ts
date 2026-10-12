import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, hashValido, prepararBd, programaActivo } from '../../test/ayuda.js'
import { esperarPagos } from '../cobros/orquestacion.js'
import * as programas from '../db/repositorios/programas.js'
import * as op from '../openPaymentsService.js'
import { ErrorOP } from '../openPaymentsService.js'
import { renovarTodos } from './renovacion.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let programaId: string
let n = 0
const llave = () => `llave-renovacion-${++n}`

const cobrarAna = () =>
  request(a).post('/api/cobros').send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: llave() }).expect(201)

/** Simula que la API estuvo apagada: el banco ya no acepta la rotación del token. */
function bancoRechazaRotacion() {
  vi.mocked(op.rotarToken).mockRejectedValueOnce(new ErrorOP('TokenVencido', 401, 'invalid_client', 'invalid access token'))
}

beforeEach(async () => {
  prepararBd()
  vi.mocked(op.rotarToken).mockClear()
  vi.mocked(op.pedirPermisoPrograma).mockClear()
  programaId = await programaActivo()
})

describe('renovación del token en segundo plano (D-35)', () => {
  it('cada vuelta rota el token de los programas activos y el permiso sigue vigente', async () => {
    expect(await renovarTodos()).toEqual({ renovados: 1, vencidos: 0, fallidos: 0 })
    expect(await renovarTodos()).toEqual({ renovados: 1, vencidos: 0, fallidos: 0 })
    expect(op.rotarToken).toHaveBeenCalledTimes(2)
    expect((await request(a).get(`/api/programas/${programaId}`)).body).toMatchObject({ permisoActivo: true, permisoVencido: false })
  })

  it('sin respuesta del banco no marca el permiso como vencido: se reintenta después', async () => {
    vi.mocked(op.rotarToken).mockRejectedValueOnce(new ErrorOP('SinRespuesta'))
    expect(await renovarTodos()).toEqual({ renovados: 0, vencidos: 0, fallidos: 1 })
    expect(programas.obtener(programaId)!.permiso_vencido_en).toBeNull()
  })

  it('si el banco ya no acepta la rotación, el permiso queda vencido y los cobros fallan sin llamar al banco', async () => {
    bancoRechazaRotacion()
    expect(await renovarTodos()).toEqual({ renovados: 0, vencidos: 1, fallidos: 0 })
    expect((await request(a).get(`/api/programas/${programaId}`)).body).toMatchObject({ estado: 'Activo', permisoVencido: true })
    // Las vueltas siguientes ya no lo intentan
    expect(await renovarTodos()).toEqual({ renovados: 0, vencidos: 0, fallidos: 0 })

    vi.mocked(op.crearPagoSaliente).mockClear()
    const c = (await cobrarAna()).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body).toMatchObject({ estado: 'Fallido', motivo: { codigo: 'PermisoVencido' } })
    expect(op.crearPagoSaliente).not.toHaveBeenCalled()
  })
})

describe('«Renovar permiso» (D-35)', () => {
  it('con el permiso vigente no hace falta renovar', async () => {
    expect((await request(a).post(`/api/programas/${programaId}/renovar-permiso`).expect(409)).body.error.codigo).toBe('PermisoVigente')
  })

  it('pide un permiso nuevo por lo que falta del tope y el tablero suma lo que ya salió', async () => {
    // Ana cobra $230.000 con el primer permiso; después la API se apaga y el permiso vence
    await cobrarAna()
    await esperarPagos()
    bancoRechazaRotacion()
    await renovarTodos()

    const r = (await request(a).post(`/api/programas/${programaId}/renovar-permiso`).expect(200)).body
    expect(r.redirect).toMatch(/^https:\/\//)
    // Tope $690.000 − $230.000 ya pagados
    expect(op.pedirPermisoPrograma).toHaveBeenLastCalledWith(expect.objectContaining({ tope: 46000000 }))

    const ref = 'interact-ref-renovacion'
    const vuelta = await request(a).get(`/api/callback/${programaId}`).query({ interact_ref: ref, hash: hashValido(programaId, ref) }).expect(302)
    expect(vuelta.headers.location).toBe(`http://localhost:5173/entidad/programas/${programaId}?renovacion=aprobada`)
    expect((await request(a).get(`/api/programas/${programaId}`)).body).toMatchObject({ estado: 'Activo', permisoActivo: true, permisoVencido: false })

    // El tablero lee el permiso nuevo (sin gasto) y le suma lo que salió con el viejo, sobre el tope original
    const t = (await request(a).get(`/api/programas/${programaId}/tablero`)).body
    expect(t).toMatchObject({ autorizado: '69000000', cobrado: '23000000', fuente: 'banco' })
  })

  it('si la entidad rechaza la renovación en el banco, el permiso sigue vencido', async () => {
    bancoRechazaRotacion()
    await renovarTodos()
    await request(a).post(`/api/programas/${programaId}/renovar-permiso`).expect(200)
    const vuelta = await request(a).get(`/api/callback/${programaId}`).query({ result: 'grant_rejected' }).expect(302)
    expect(vuelta.headers.location).toContain('renovacion=rechazada')
    expect((await request(a).get(`/api/programas/${programaId}`)).body).toMatchObject({ permisoVencido: true })
  })
})

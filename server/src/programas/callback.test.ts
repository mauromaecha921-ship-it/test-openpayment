import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, hashValido, prepararBd, PROGRAMA } from '../../test/ayuda.js'
import { estado } from '../../test/falsos.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import * as op from '../openPaymentsService.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let id: string

beforeEach(async () => {
  await prepararBd()
  vi.mocked(op.continuarPermiso).mockClear()
  id = (await request(a).post('/api/programas').send(PROGRAMA).expect(201)).body.id
  const r = await request(a).post(`/api/programas/${id}/autorizar`).expect(200)
  expect(r.body.redirect).toMatch(/^https:\/\//)
})

const ultimoDetalle = async () => eventos.detalleDe((await eventos.deEntidad('programa', id)).at(-1)!)

describe('callback de la aprobación (HU-04, HU-05)', () => {
  it('O2: autorizar fija el tope (RN-08) y deja el programa esperando', async () => {
    expect((await programas.obtener(id))).toMatchObject({ estado: 'EsperandoAprobacion', tope_total: 69000000 })
    expect(estado.tope).toBe(69000000)
  })

  it('hash válido → Activo y 302 a la web con resultado=aprobado', async () => {
    const r = await request(a).get(`/api/callback/${id}`).query({ interact_ref: 'ref-1', hash: await hashValido(id, 'ref-1') })
    expect(r.status).toBe(302)
    expect(r.headers.location).toBe(`http://localhost:5173/entidad/programas/${id}/aprobar?resultado=aprobado`)
    const p = (await programas.obtener(id))!
    expect(p.estado).toBe('Activo')
    // Se borran los temporales
    expect([p.nonce_cliente, p.nonce_cierre, p.uri_continuacion, p.token_continuacion]).toEqual([null, null, null, null])
    expect(await ultimoDetalle()).toMatchObject({ varianteHash: 'estandar-con-padding', expiresIn: 600 })
  })

  it('hash alterado → no activa, deja evento y redirige con resultado=invalido', async () => {
    const malo = (await hashValido(id, 'ref-1')).replace(/^./, (c) => (c === 'A' ? 'B' : 'A'))
    const r = await request(a).get(`/api/callback/${id}`).query({ interact_ref: 'ref-1', hash: malo })
    expect(r.headers.location).toMatch(/resultado=invalido$/)
    expect((await programas.obtener(id))!.estado).toBe('EsperandoAprobacion')
    expect((await ultimoDetalle()).texto).toMatch(/hash inválido/)
    expect(op.continuarPermiso).not.toHaveBeenCalled()
  })

  it('callback repetido con el programa ya Activo → redirige igual sin cambiar nada', async () => {
    const q = { interact_ref: 'ref-1', hash: await hashValido(id, 'ref-1') }
    await request(a).get(`/api/callback/${id}`).query(q)
    const antes = (await eventos.deEntidad('programa', id)).length
    const r = await request(a).get(`/api/callback/${id}`).query(q)
    expect(r.headers.location).toMatch(/resultado=aprobado$/)
    expect((await eventos.deEntidad('programa', id))).toHaveLength(antes)
    expect(op.continuarPermiso).toHaveBeenCalledTimes(1)
  })

  it('grant_rejected → vuelve a Borrador', async () => {
    const r = await request(a).get(`/api/callback/${id}`).query({ result: 'grant_rejected' })
    expect(r.headers.location).toMatch(/resultado=rechazado$/)
    expect((await programas.obtener(id))!.estado).toBe('Borrador')
  })

  it('cancelar la aprobación (D-09) → grant.cancel y Borrador', async () => {
    await request(a).post(`/api/programas/${id}/cancelar-aprobacion`).expect(200)
    expect(op.cancelarPermisoPendiente).toHaveBeenCalled()
    expect((await programas.obtener(id))!.estado).toBe('Borrador')
  })

  it('la aprobación vence a los 10 minutos (HU-05)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 11 * 60_000)
    try {
      const r = await request(a).get(`/api/programas/${id}`).expect(200)
      expect(r.body.estado).toBe('Borrador')
    } finally {
      vi.useRealTimers()
    }
  })

  it('si grant.continue falla, el programa no se activa', async () => {
    estado.falloAlContinuar = true
    const r = await request(a).get(`/api/callback/${id}`).query({ interact_ref: 'ref-1', hash: await hashValido(id, 'ref-1') })
    expect(r.headers.location).toMatch(/resultado=invalido$/)
    expect((await programas.obtener(id))!.estado).toBe('EsperandoAprobacion')
  })
})

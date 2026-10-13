import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as op from '../openPaymentsService.js'
import { esperarPagos } from './orquestacion.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let programaId: string

beforeEach(async () => {
  await prepararBd()
  programaId = await programaActivo()
  vi.mocked(op.crearPagoSaliente).mockClear()
})

describe('carreras (V-17, HU-14, RNF-11)', () => {
  it('10 POST /cobros simultáneos con la misma cédula → 1 cobro vivo', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(a)
          .post('/api/cobros')
          .send({ documento: '900000003', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: `carrera-${i}` }),
      ),
    )
    expect(respuestas.every((r) => r.status === 201)).toBe(true)
    const estados = respuestas.map((r) => r.body.estado)
    expect(estados.filter((e) => e === 'PorConfirmar')).toHaveLength(1)
    expect(estados.filter((e) => e === 'Rechazado')).toHaveLength(9)
    expect(respuestas.filter((r) => r.body.motivo?.codigo === 'EnProceso')).toHaveLength(9)

    const vivos = (await cobros.dePrograma(programaId)).filter((c) => ['Solicitado', 'PorConfirmar', 'Pagando', 'Pagado'].includes(c.estado))
    expect(vivos).toHaveLength(1)
  })

  it('10 cobros simultáneos a la cuenta de Ana → 1 solo pago', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(a).post('/api/cobros').send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: `carrera-ana-${i}` }),
      ),
    )
    await esperarPagos()
    expect(op.crearPagoSaliente).toHaveBeenCalledTimes(1)
  })

  it('doble confirmación con el PIN correcto → 1 solo pago', async () => {
    const c = (
      await request(a)
        .post('/api/cobros')
        .send({ documento: '900000003', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: 'doble-confirmacion' })
    ).body
    const [r1, r2] = await Promise.all([
      request(a).post(`/api/cobros/${c.id}/confirmar`).send({ pin: '3333' }),
      request(a).post(`/api/cobros/${c.id}/confirmar`).send({ pin: '3333' }),
    ])
    await esperarPagos()
    expect([r1.status, r2.status].sort()).toEqual([200, 202])
    expect(op.crearPagoSaliente).toHaveBeenCalledTimes(1)
    expect((await cobros.obtener(c.id))!.estado).toBe('Pagado')
  })
})

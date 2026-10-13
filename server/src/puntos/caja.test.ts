import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import { esperarPagos } from '../cobros/orquestacion.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let n = 0
const retiro = (documento: string) =>
  request(a).post('/api/cobros').send({ documento, canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: `llave-caja-${++n}` }).expect(201)

beforeEach(async () => {
  await prepararBd()
  await programaActivo()
})

describe('la caja del punto (D-36)', () => {
  it('cuadra lo entregado, lo reembolsado, lo pendiente y los cobros del periodo', async () => {
    // Jorge retira y queda Pagado
    const jorge = (await retiro('900000003')).body
    await request(a).post(`/api/cobros/${jorge.id}/confirmar`).send({ pin: '3333' })
    await esperarPagos()
    // Jorge vuelve: rechazado por ya cobrado. Luis queda esperando su PIN
    expect((await retiro('900000003')).body.estado).toBe('Rechazado')
    expect((await retiro('900000002')).body.estado).toBe('PorConfirmar')

    const r = (await request(a).get(`/api/puntos/${IDS.punto}/resumen`).query({ desde: 'hoy' }).expect(200)).body
    expect(r).toMatchObject({
      periodo: 'hoy',
      totales: [{ moneda: { codigo: 'COP', escala: 2 }, entregado: '23000000', reembolsado: '23000000', pendiente: '0' }],
      cobros: { pagados: 1, enCurso: 1, rechazados: 1 },
      giradoPorAdelantado: '0',
    })
    expect(typeof r.reembolsoSegundos).toBe('number')
    expect(r.punto.id).toBe(IDS.punto)
  })

  it('el historial acepta hoy, 7 días y todo; un periodo raro cae en hoy', async () => {
    await retiro('900000003')
    for (const desde of ['hoy', '7d', 'todo']) {
      expect((await request(a).get(`/api/puntos/${IDS.punto}/cobros`).query({ desde }).expect(200)).body).toHaveLength(1)
    }
    expect((await request(a).get(`/api/puntos/${IDS.punto}/resumen`).query({ desde: 'ayer' }).expect(200)).body.periodo).toBe('hoy')
    await request(a).get('/api/puntos/b0000000-0000-0000-0000-00000000ffff/resumen').expect(404)
  })
})

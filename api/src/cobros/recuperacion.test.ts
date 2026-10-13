import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import { estado } from '../../test/falsos.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as op from '../openPaymentsService.js'
import { esperarPagos, recuperarAlArrancar } from './orquestacion.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

/**
 * V-06 con dobles (Plan backend § 8.6): la API se cae con cobros en Pagando y, al arrancar,
 * una sola pasada los resuelve sin pagar dos veces. Contra la Test Wallet se repite en la Fase 8.
 */
const a = app()

async function retiroPagando(documento: string, pin: string) {
  const c = (await request(a).post('/api/cobros').send({ documento, canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: `recuperar-${documento}` })).body
  await request(a).post(`/api/cobros/${c.id}/confirmar`).send({ pin })
  await esperarPagos()
  return c.id as string
}

beforeEach(async () => {
  await prepararBd()
  await programaActivo()
  vi.mocked(op.crearPagoEntrante).mockClear()
  vi.mocked(op.crearPagoSaliente).mockClear()
})

describe('recuperar al arrancar (V-06, RNF-05, P-08)', () => {
  it('con el pago saliente guardado: se consulta y queda Pagado, sin otro pago', async () => {
    estado.salientesLentos = true
    const id = await retiroPagando('900000003', '3333')
    expect((await cobros.obtener(id))).toMatchObject({ estado: 'Pagando' })
    expect((await cobros.obtener(id))!.url_pago_saliente).not.toBeNull()

    expect(await recuperarAlArrancar()).toBe(1)
    expect((await cobros.obtener(id))!.estado).toBe('Pagado')
    expect(op.crearPagoSaliente).toHaveBeenCalledTimes(1)
  })

  it('sin nada guardado (no se movió dinero): se vuelve a pagar', async () => {
    vi.mocked(op.crearPagoEntrante).mockRejectedValueOnce(new op.ErrorOP('SinRespuesta'))
    const id = await retiroPagando('900000003', '3333')
    expect((await cobros.obtener(id))).toMatchObject({ estado: 'Pagando', url_pago_entrante: null })

    await recuperarAlArrancar()
    expect((await cobros.obtener(id))!.estado).toBe('Pagado')
    expect(op.crearPagoSaliente).toHaveBeenCalledTimes(1)
    expect(estado.gastado).toBe(23000000)
  })

  it('solo con el pago entrante: queda en Pagando con «requiere conciliación» (D-23), una sola vez', async () => {
    vi.mocked(op.crearPagoSaliente).mockRejectedValueOnce(new op.ErrorOP('SinRespuesta'))
    const id = await retiroPagando('900000003', '3333')
    const c = (await cobros.obtener(id))!
    expect(c.estado).toBe('Pagando')
    expect(c.url_pago_entrante).not.toBeNull()
    expect(c.url_pago_saliente).toBeNull()

    await recuperarAlArrancar()
    await recuperarAlArrancar()
    expect((await cobros.obtener(id))!.estado).toBe('Pagando')
    const notas = (await eventos.deEntidad('cobro', id)).filter((e) => eventos.detalleDe(e).conciliacion === true)
    expect(notas).toHaveLength(1)
    // Nunca se reintenta el saliente a ciegas: V-06 dirá si es seguro contra el mismo entrante
    expect(op.crearPagoSaliente).toHaveBeenCalledTimes(1)
  })

  it('sin cobros en Pagando no hace nada', async () => {
    expect(await recuperarAlArrancar()).toBe(0)
  })
})

import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import * as programas from '../db/repositorios/programas.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let n = 0
const resumenLuis = async () => (await request(a).get('/api/beneficiarios/900000002/resumen').expect(200)).body

let programaId: string
beforeEach(async () => {
  await prepararBd()
  programaId = await programaActivo()
})

/** Luis no cobra a tiempo: lo que hoy hace la app (prueba del 13 de octubre). */
describe('alguien que no cobra antes del cierre', () => {
  it('al cerrar, el subsidio desaparece de su resumen y el punto lo rechaza por programa cerrado', async () => {
    expect((await resumenLuis()).pagos).toHaveLength(1)
    await request(a).post(`/api/programas/${programaId}/cerrar`).send({ confirmacion: 'CERRAR' }).expect(200)

    expect((await resumenLuis()).pagos).toEqual([])
    expect((await request(a).get(`/api/puntos/${IDS.punto}/pagos`).query({ documento: '900000002' }).expect(200)).body.pagos).toEqual([])
    const cobro = (
      await request(a).post('/api/cobros').send({ documento: '900000002', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: `llave-tarde-${++n}` }).expect(201)
    ).body
    expect(cobro).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'ProgramaCerrado', mensaje: 'El programa está cerrado y ya no recibe cobros' } })
  })

  it('en un ciclo nuevo solo le aparece el monto del ciclo nuevo: lo no cobrado no se acumula', async () => {
    await request(a).post(`/api/programas/${programaId}/cerrar`).send({ confirmacion: 'CERRAR' }).expect(200)
    const nuevo = await programaActivo()
    const r = await resumenLuis()
    expect(r.pagos.map((p: { programa: { id: string }; monto: string }) => [p.programa.id, p.monto])).toEqual([[nuevo, '23000000']])
  })

  it('si vence la vigencia sin cerrar, todavía le aparece pero no lo puede cobrar', async () => {
    programas.actualizar(programaId, { vigencia_fin: new Date(Date.now() - 60_000).toISOString() })
    expect((await resumenLuis()).pagos).toHaveLength(1)
    expect((await request(a).get(`/api/puntos/${IDS.punto}/pagos`).query({ documento: '900000002' }).expect(200)).body.pagos).toEqual([])
    const cobro = (
      await request(a).post('/api/cobros').send({ programaId, documento: '900000001', canal: 'cuenta', llaveIdempotencia: `llave-tarde-${++n}` }).expect(201)
    ).body
    expect(cobro).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'ProgramaNoRecibe' } })
  })
})

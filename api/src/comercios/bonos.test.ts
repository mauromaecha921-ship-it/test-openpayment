import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, hashValido, IDS, prepararBd, PROGRAMA } from '../../test/ayuda.js'
import { esperarPagos } from '../cobros/orquestacion.js'
import * as op from '../openPaymentsService.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let n = 0
const llave = () => `llave-bono-${++n}`

const SUPER = {
  nit: '900123456',
  razonSocial: 'Supermercado La Esquina S.A.S.',
  ciiu: '4711',
  sede: { nombre: 'La Esquina · Centro', direccion: 'Calle 10 # 11A-23', billetera: '$ilp.interledger-test.dev/super-centro' },
}
const DROGUERIA = {
  nit: '800111222',
  razonSocial: 'Droguería Salud Ya',
  ciiu: '4773',
  sede: { nombre: 'Salud Ya · Norte', billetera: '$ilp.interledger-test.dev/drogueria-norte' },
}

let bono: string
let sedeSuper: string
let sedeDrogueria: string

async function comercio(datos: object, verificar: boolean) {
  const c = (await request(a).post('/api/comercios').send(datos).expect(201)).body
  if (verificar) await request(a).post(`/api/comercios/${c.id}/verificar`).expect(200)
  return c.sedes[0].id as string
}

/** Un bono de $60.000 por persona que aceptan los comercios de alimentos. */
async function bonoAlimentos(): Promise<string> {
  const id = (await request(a).post('/api/programas').send({ ...PROGRAMA, nombre: 'Bono de alimentación', tipo: 'bono', montoPorPersona: '60000', categorias: ['alimentos'] }).expect(201)).body.id
  await request(a).post(`/api/programas/${id}/autorizar`).expect(200)
  const ref = 'ref-bono'
  await request(a).get(`/api/callback/${id}`).query({ interact_ref: ref, hash: await hashValido(id, ref) }).expect(302)
  return id
}

const compra = (documento: string, puntoId: string, totalCompra: string, programaId?: string) =>
  request(a).post('/api/cobros').send({ programaId, documento, canal: 'compra', puntoId, totalCompra, llaveIdempotencia: llave() }).expect(201)

beforeEach(async () => {
  await prepararBd()
  sedeSuper = await comercio(SUPER, true)
  sedeDrogueria = await comercio(DROGUERIA, false)
  bono = await bonoAlimentos()
})

describe('comercios verificados (Plan de ajustes § 11)', () => {
  it('el comercio queda con su categoría, su sede y por verificar hasta que la entidad lo verifica', async () => {
    const lista = (await request(a).get('/api/comercios').expect(200)).body as Array<{ nit: string; categoria: string; verificado: boolean; sedes: unknown[] }>
    expect(lista.find((c) => c.nit === SUPER.nit)).toMatchObject({ categoria: 'alimentos', verificado: true, sedes: [{ tipo: 'compra', direccion: 'Calle 10 # 11A-23' }] })
    expect(lista.find((c) => c.nit === DROGUERIA.nit)).toMatchObject({ categoria: 'salud', verificado: false })
  })

  it('rechaza una actividad sin categoría, un NIT repetido y una wallet ya usada; una cadena suma sedes', async () => {
    await request(a).post('/api/comercios').send({ ...SUPER, nit: '911111111', ciiu: '5611' }).expect(400)
    await request(a).post('/api/comercios').send({ ...SUPER, sede: { ...SUPER.sede, billetera: '$ilp.interledger-test.dev/otra' } }).expect(409)
    await request(a).post('/api/comercios').send({ ...DROGUERIA, nit: '922222222' }).expect(409)
    const id = (await request(a).get('/api/comercios')).body.find((c: { nit: string }) => c.nit === SUPER.nit).id
    const conDos = (await request(a).post(`/api/comercios/${id}/sedes`).send({ nombre: 'La Esquina · Sur', billetera: '$ilp.interledger-test.dev/super-sur' }).expect(201)).body
    expect(conDos.sedes).toHaveLength(2)
  })
})

describe('bonos con destino (HU-21)', () => {
  it('el bono acepta solo las sedes verificadas de sus categorías', async () => {
    expect((await request(a).get(`/api/programas/${bono}`)).body).toMatchObject({ tipo: 'bono', categorias: ['alimentos'], tope: '18000000' })
    const donde = (await request(a).get(`/api/programas/${bono}/comercios`).expect(200)).body
    expect(donde.map((s: { id: string }) => s.id)).toEqual([sedeSuper])
    // En el resumen, el pago dice que es un bono
    const r = (await request(a).get('/api/beneficiarios/900000001/resumen')).body
    expect(r.pagos[0].programa).toMatchObject({ id: bono, tipo: 'bono' })
  })

  it('cada punto ve lo que puede pagar: la sede ve el bono, el punto de retiro y la droguería no', async () => {
    const ver = async (puntoId: string) => (await request(a).get(`/api/puntos/${puntoId}/pagos`).query({ documento: '900000001' }).expect(200)).body.pagos
    expect((await ver(sedeSuper)).map((p: { programa: { id: string } }) => p.programa.id)).toEqual([bono])
    expect(await ver(sedeDrogueria)).toEqual([])
    expect(await ver(IDS.punto)).toEqual([])
  })

  it('una compra de $80.000 con bono de $60.000: el comercio recibe $60.000 tras el PIN', async () => {
    vi.mocked(op.crearPagoEntrante).mockClear()
    const c = (await compra('900000001', sedeSuper, '8000000', bono)).body
    expect(c).toMatchObject({ estado: 'PorConfirmar', canal: 'compra', monto: '6000000', totalCompra: '8000000' })
    expect((await request(a).post(`/api/cobros/${c.id}/confirmar`).send({ pin: '1111' })).status).toBe(202)
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
    expect(op.crearPagoEntrante).toHaveBeenLastCalledWith(
      expect.objectContaining({ billetera: 'https://ilp.interledger-test.dev/super-centro', monto: 6000000 }),
    )
    // Un solo uso: la segunda compra se rechaza
    expect((await compra('900000001', sedeSuper, '1000000', bono)).body).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'YaCobrado' } })
    // El tablero cuenta la compra
    expect((await request(a).get(`/api/programas/${bono}/tablero`)).body.porCanal.compra).toEqual({ cobros: 1, monto: '6000000' })
  })

  it('si la compra es menor que el bono, el bono paga solo la compra', async () => {
    const c = (await compra('900000003', sedeSuper, '5000000', bono)).body
    expect(c).toMatchObject({ monto: '5000000' })
  })

  it('rechazos: comercio no autorizado, y el bono no se cobra a la cuenta ni en retiro', async () => {
    expect((await compra('900000001', sedeDrogueria, '8000000')).body).toMatchObject({
      estado: 'Rechazado',
      motivo: { codigo: 'ComercioNoAutorizado', mensaje: 'Este comercio no acepta este bono' },
    })
    const cuenta = (await request(a).post('/api/cobros').send({ programaId: bono, documento: '900000001', canal: 'cuenta', llaveIdempotencia: llave() }).expect(201)).body
    expect(cuenta.motivo).toMatchObject({ codigo: 'SoloEnComercios', mensaje: 'Este bono solo se usa en comercios autorizados' })
    const retiro = (await request(a).post('/api/cobros').send({ programaId: bono, documento: '900000003', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: llave() }).expect(201)).body
    expect(retiro.motivo.codigo).toBe('SoloEnComercios')
  })

  it('un bono sin categorías no se puede aprobar', async () => {
    const id = (await request(a).post('/api/programas').send({ ...PROGRAMA, tipo: 'bono', categorias: [] }).expect(201)).body.id
    expect((await request(a).post(`/api/programas/${id}/autorizar`).expect(409)).body.error.codigo).toBe('BonoSinCategorias')
  })
})

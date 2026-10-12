import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, hashValido, IDS, prepararBd, PROGRAMA, programaActivo } from '../../test/ayuda.js'
import { esperarPagos } from '../cobros/orquestacion.js'
import * as programas from '../db/repositorios/programas.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let n = 0
const llave = () => `llave-varios-${++n}`

/** Un programa de $10.000 por persona, aprobado por la API como el de programaActivo. */
async function programaPequeno(): Promise<string> {
  const id = (await request(a).post('/api/programas').send({ ...PROGRAMA, nombre: 'Bono pequeño', montoPorPersona: '10000' }).expect(201)).body.id
  await request(a).post(`/api/programas/${id}/autorizar`).expect(200)
  const ref = 'ref-pequeno'
  await request(a).get(`/api/callback/${id}`).query({ interact_ref: ref, hash: hashValido(id, ref) }).expect(302)
  return id
}

const resumenAna = async () => (await request(a).get('/api/beneficiarios/900000001/resumen').expect(200)).body
const pagosEnPunto = (documento: string) => request(a).get(`/api/puntos/${IDS.punto}/pagos`).query({ documento })

let pequeno: string
let grande: string

beforeEach(async () => {
  prepararBd()
  // El falso del banco guarda un solo tope: el último aprobado es el grande y cubre los dos cobros
  pequeno = await programaPequeno()
  grande = await programaActivo()
})

describe('una persona con subsidios en varios programas', () => {
  it('ve todos sus pagos pendientes, no solo el primero', async () => {
    const r = await resumenAna()
    expect(r.pagos.map((p: { programa: { id: string }; monto: string }) => [p.programa.id, p.monto]).sort()).toEqual(
      [
        [grande, '23000000'],
        [pequeno, '1000000'],
      ].sort(),
    )
    expect(r.pago).toEqual(r.pagos[0])
  })

  it('el punto ve los dos y paga el que se elija; cobrar uno no bloquea el otro', async () => {
    const consulta = (await pagosEnPunto('900000001').expect(200)).body
    expect(consulta.persona).toMatchObject({ nombre: 'Ana', tienePin: true })
    expect(consulta.pagos).toHaveLength(2)

    // A su cuenta, el pequeño
    const cuenta = (await request(a).post('/api/cobros').send({ programaId: pequeno, documento: '900000001', canal: 'cuenta', llaveIdempotencia: llave() }).expect(201)).body
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${cuenta.id}`)).body).toMatchObject({ estado: 'Pagado', monto: '1000000' })
    expect((await resumenAna()).pagos.map((p: { programa: { id: string } }) => p.programa.id)).toEqual([grande])

    // En el punto, el grande
    const retiro = (
      await request(a).post('/api/cobros').send({ programaId: grande, documento: '900000001', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: llave() }).expect(201)
    ).body
    expect(retiro).toMatchObject({ estado: 'PorConfirmar', monto: '23000000' })
    expect((await request(a).post(`/api/cobros/${retiro.id}/confirmar`).send({ pin: '1111' })).status).toBe(202)
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${retiro.id}`)).body.estado).toBe('Pagado')

    expect((await resumenAna()).pagos).toEqual([])
    expect((await pagosEnPunto('900000001').expect(200)).body.pagos).toEqual([])
  })

  it('el punto solo ve programas que hoy reciben cobros, y no revela cédulas desconocidas', async () => {
    await request(a).post(`/api/programas/${pequeno}/pausar`).expect(200)
    expect((await pagosEnPunto('900000001').expect(200)).body.pagos).toHaveLength(1)
    // La persona sí lo ve en su resumen, con el aviso de pausa
    expect((await resumenAna()).pagos).toHaveLength(2)
    expect((await pagosEnPunto('12345678').expect(404)).body.error.codigo).toBe('SinPagoDisponible')
    // Con el permiso vencido, el punto tampoco lo ofrece
    programas.actualizar(grande, { permiso_vencido_en: new Date().toISOString() })
    expect((await pagosEnPunto('900000001').expect(200)).body.pagos).toEqual([])
  })
})

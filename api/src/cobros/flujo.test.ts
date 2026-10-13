import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, programaActivo } from '../../test/ayuda.js'
import { estado } from '../../test/falsos.js'
import * as cobros from '../db/repositorios/cobros.js'
import { esperarPagos } from './orquestacion.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let programaId: string
let n = 0
const llave = () => `llave-flujo-${++n}`

function retiro(documento: string) {
  return request(a).post('/api/cobros').send({ documento, canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: llave() })
}

async function confirmar(id: string, pin: string) {
  const r = await request(a).post(`/api/cobros/${id}/confirmar`).send({ pin })
  await esperarPagos()
  return r
}

beforeEach(async () => {
  await prepararBd()
  programaId = await programaActivo()
})

describe('guion de la demo, pasos 2 a 7 (Historias § Fórmulas)', () => {
  it('Ana y Jorge cobran, Jorge no repite, Rosa choca con el tope, se cierra y Luis llega tarde', async () => {
    // Paso 2: el programa quedó Activo con tope = la liquidación (RN-08)
    const p = await request(a).get(`/api/programas/${programaId}`).expect(200)
    expect(p.body).toMatchObject({ estado: 'Activo', tope: '69000000', moneda: { codigo: 'COP', escala: 2 }, vigenciaFin: '2099-12-31' })

    // Paso 3: Ana cobra a su cuenta, sin PIN (P-09)
    const ana = await request(a)
      .post('/api/cobros')
      .send({ documento: '900000001', canal: 'cuenta', llaveIdempotencia: llave() })
      .expect(201)
    expect(ana.body.estado).toBe('Pagando')
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${ana.body.id}`)).body.estado).toBe('Pagado')

    // Paso 4: Jorge retira en el punto: PorConfirmar, PIN errado, PIN bueno, Pagado
    const jorge = (await retiro('900000003').expect(201)).body
    expect(jorge).toMatchObject({ estado: 'PorConfirmar', monto: '23000000', intentosRestantes: 3, referencia: 'SUB-0002' })
    const mal = await confirmar(jorge.id, '0000')
    expect(mal.status).toBe(422)
    expect(mal.body.error.mensaje).toBe('PIN incorrecto, te quedan 2 intentos')
    expect((await confirmar(jorge.id, '3333')).status).toBe(202)
    const pagado = (await request(a).get(`/api/cobros/${jorge.id}`)).body
    expect(pagado.estado).toBe('Pagado')
    expect(pagado.eventos.map((e: { hacia: string }) => e.hacia)).toEqual(['Solicitado', 'PorConfirmar', 'Pagando', 'Pagado'])

    // Paso 5: Jorge intenta otra vez → «Este subsidio ya fue cobrado»
    const otra = (await retiro('900000003').expect(201)).body
    expect(otra).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'YaCobrado', mensaje: 'Este subsidio ya fue cobrado' } })

    // Paso 6: Rosa, $460.000 de retroactivo; el banco lo rechaza por tope (RN-09)
    const rosa = (await retiro('900000004').expect(201)).body
    expect(rosa.monto).toBe('46000000')
    await confirmar(rosa.id, '4444')
    const fallido = (await request(a).get(`/api/cobros/${rosa.id}`)).body
    expect(fallido).toMatchObject({ estado: 'Fallido', motivo: { codigo: 'TopeSuperado' }, persona: { novedad: true } })
    expect(estado.gastado).toBe(46000000) // no se movió dinero de Rosa

    // Tablero: autorizado, cobrado del permiso, lo que no ha salido
    const t = (await request(a).get(`/api/programas/${programaId}/tablero`).expect(200)).body
    expect(t).toMatchObject({
      autorizado: '69000000',
      cobrado: '46000000',
      noHaSalido: '23000000',
      fuente: 'banco',
      cobrosPagados: 2,
      porCanal: { cuenta: { cobros: 1, monto: '23000000' }, retiro: { cobros: 1, monto: '23000000' } },
      giradoPorAdelantado: '0',
      sinCobrar: { cedulas: 1, monto: '23000000' },
      cobrosPagando: 0,
      rechazadosYFallidos: 2,
      cierre: null,
    })
    expect(t.reembolsoSegundos).toBeGreaterThanOrEqual(0)

    // Paso 7: cerrar exige escribir CERRAR; guarda las cifras antes de revocar (D-18)
    await request(a).post(`/api/programas/${programaId}/cerrar`).send({ confirmacion: 'cerrar' }).expect(400)
    const cierre = (await request(a).post(`/api/programas/${programaId}/cerrar`).send({ confirmacion: 'CERRAR' }).expect(200)).body
    expect(cierre).toMatchObject({
      programa: { estado: 'Cerrado', permisoActivo: false },
      cobrado: '46000000',
      noHaSalido: '23000000',
      fuente: 'banco',
      cierre: { autorizado: '69000000', cobrado: '46000000', nuncaSalio: '23000000' },
    })

    // Luis intenta después del cierre (el punto no elige programa, D-21)
    const luis = (await retiro('900000002').expect(201)).body
    expect(luis).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'ProgramaCerrado' } })
  })

  it('canal cuenta de alguien sin ninguna cuenta → 409 CuentaNoVerificada', async () => {
    await request(a)
      .post('/api/cobros')
      .send({ documento: '900000002', canal: 'cuenta', llaveIdempotencia: llave() })
      .expect(409)
  })

  it('tres PIN errados → Rechazado con PinBloqueado y la cédula queda bloqueada 15 minutos', async () => {
    const c = (await retiro('900000003')).body
    await confirmar(c.id, '0000')
    await confirmar(c.id, '0001')
    const tercero = await confirmar(c.id, '0002')
    expect(tercero.body).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'PinBloqueado', mensaje: 'No pudimos confirmar tu identidad' } })
    const otra = (await retiro('900000003')).body
    expect(otra.motivo.codigo).toBe('PinBloqueado')
  })

  it('RN-12: PorConfirmar vence a los 120 s al consultar', async () => {
    const c = (await retiro('900000003')).body
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 121_000)
    try {
      const r = (await request(a).get(`/api/cobros/${c.id}`)).body
      expect(r).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'TiempoAgotado' } })
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancelar cobro (D-09): PorConfirmar → Rechazado sin mover dinero', async () => {
    const c = (await retiro('900000003')).body
    const r = (await request(a).post(`/api/cobros/${c.id}/cancelar`).expect(200)).body
    expect(r).toMatchObject({ estado: 'Rechazado', motivo: { codigo: 'Cancelado' } })
    expect(estado.gastado).toBe(0)
  })

  it('pausar (HU-18): el programa no recibe cobros y se reanuda', async () => {
    await request(a).post(`/api/programas/${programaId}/pausar`).expect(200)
    const c = (await request(a).post('/api/cobros').send({ programaId, documento: '900000003', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: llave() })).body
    expect(c.motivo.codigo).toBe('ProgramaNoRecibe')
    await request(a).post(`/api/programas/${programaId}/reanudar`).expect(200)
    expect((await retiro('900000003')).body.estado).toBe('PorConfirmar')
  })

  it('cerrar con un cobro en Pagando → 409', async () => {
    estado.salientesLentos = true
    const c = (await retiro('900000003')).body
    await confirmar(c.id, '3333')
    expect((await cobros.obtener(c.id))!.estado).toBe('Pagando')
    await request(a).post(`/api/programas/${programaId}/cerrar`).send({ confirmacion: 'CERRAR' }).expect(409)
    // Al consultar se reconcilia (RN-10) y ya se puede cerrar
    expect((await request(a).get(`/api/cobros/${c.id}`)).body.estado).toBe('Pagado')
  })

  it('vigencia con fechas de calendario: el día final cuenta completo (hora de Bogotá)', async () => {
    const r = await request(a)
      .post('/api/programas')
      .send({ entidad: 'Entidad de prueba', nombre: 'Un solo día', billetera: '$ilp.interledger-test.dev/x', vigenciaInicio: '2026-10-16', vigenciaFin: '2026-10-16' })
      .expect(201)
    expect(r.body).toMatchObject({ vigenciaInicio: '2026-10-16', vigenciaFin: '2026-10-16' })
    await request(a)
      .post('/api/programas')
      .send({ entidad: 'Entidad de prueba', nombre: 'Al revés', billetera: '$ilp.interledger-test.dev/x', vigenciaInicio: '2026-10-17', vigenciaFin: '2026-10-16' })
      .expect(400)
  })

  it('resumen de la beneficiaria (HU-08): pago disponible, cuenta y último cobro', async () => {
    const r = (await request(a).get('/api/beneficiarios/900000001/resumen').expect(200)).body
    expect(r).toMatchObject({
      persona: { nombre: 'Ana', documento: '900000001' },
      pago: { programa: { id: programaId }, monto: '23000000', moneda: { codigo: 'COP', escala: 2 } },
      cuenta: { estado: 'Verificada', documento: '900000001' },
      ultimoCobro: null,
    })
  })

  it('cédula que no existe: no deja cobro', async () => {
    const r = await retiro('123456789').expect(404)
    expect(r.body.error.codigo).toBe('SinPagoDisponible')
  })

  it('HU-10: misma llave de idempotencia → el mismo cobro', async () => {
    const cuerpo = { documento: '900000003', canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: 'doble-clic-1' }
    const uno = (await request(a).post('/api/cobros').send(cuerpo)).body
    const dos = (await request(a).post('/api/cobros').send(cuerpo)).body
    expect(dos.id).toBe(uno.id)
  })
})

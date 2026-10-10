import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app, IDS, prepararBd, PROGRAMA, programaActivo } from '../../test/ayuda.js'
import { esperarPagos } from '../cobros/orquestacion.js'
import { ejecutar } from '../db/conexion.js'
import * as op from '../openPaymentsService.js'
import { TOKEN_FALSO } from '../salud.js'

vi.mock('../openPaymentsService.js', async (orig) => (await import('../../test/falsos.js')).falsoOP(await orig()))
vi.mock('../liquidacion/cliente.js', async (orig) => (await import('../../test/falsos.js')).falsaLiquidacion(await orig()))

const a = app()
let n = 0
const llave = () => `llave-registro-${++n}`

// Una persona del equipo: la wallet falsa toma el nombre del último tramo de la URL
const CAMILA = { documento: '1020304050', billetera: '$ilp.interledger-test.dev/camila' }

const registrar = (cuerpo: object) => request(a).post('/api/beneficiarios').send(cuerpo)

beforeEach(() => {
  prepararBd()
})

describe('registro del equipo: cédula y wallet (Plan de ajustes § 2)', () => {
  it('registra con la cuenta Verificada y el nombre de la wallet', async () => {
    const r = (await registrar(CAMILA).expect(201)).body
    expect(r).toMatchObject({
      documento: '1020304050',
      nombre: 'camila',
      billetera: 'https://ilp.interledger-test.dev/camila',
      moneda: { codigo: 'COP', escala: 2 },
      estadoCuenta: 'Verificada',
      tienePin: false,
    })
    const lista = (await request(a).get('/api/beneficiarios').expect(200)).body as Array<{ documento: string }>
    expect(lista.map((p) => p.documento)).toContain('1020304050')
    // También aparece en el selector de la entrada
    const demo = (await request(a).get('/api/beneficiarios/demo').expect(200)).body as Array<{ documento: string }>
    expect(demo.map((p) => p.documento)).toContain('1020304050')
  })

  it('el nombre y el PIN son opcionales', async () => {
    const r = (await registrar({ ...CAMILA, nombre: 'Camila Rojas', pin: '9090' }).expect(201)).body
    expect(r).toMatchObject({ nombre: 'Camila Rojas', tienePin: true })
  })

  it('rechaza cédula repetida, wallet ajena, wallet inexistente y datos mal escritos', async () => {
    await registrar(CAMILA).expect(201)
    expect((await registrar({ ...CAMILA, billetera: '$ilp.interledger-test.dev/otra' }).expect(409)).body.error.codigo).toBe('PersonaExiste')
    // La cédula de Ana ya está en la semilla
    expect((await registrar({ documento: '900000001', billetera: '$ilp.interledger-test.dev/x' }).expect(409)).body.error.codigo).toBe('PersonaExiste')
    // La wallet de Ana ya es de Ana
    const ajena = (await registrar({ documento: '55555555', billetera: '$ilp.interledger-test.dev/prueba-ana' }).expect(409)).body
    expect(ajena.error).toMatchObject({ codigo: 'BilleteraEnUso', mensaje: 'Esa wallet ya está registrada para Ana' })
    await registrar({ documento: '55555555', billetera: '$ilp.interledger-test.dev/no-existe' }).expect(404)
    await registrar({ documento: '12.345.678', billetera: CAMILA.billetera }).expect(400)
    await registrar({ ...CAMILA, documento: '66666666', pin: '12' }).expect(400)
  })

  it('quien se registra antes de aprobar cobra a su cuenta y el dinero sale', async () => {
    await registrar(CAMILA).expect(201)
    const programaId = await programaActivo()
    // El tope incluye a la persona nueva: 4 cédulas sin la novedad de Rosa
    expect((await request(a).get(`/api/programas/${programaId}`)).body.tope).toBe('92000000')

    const cobro = (await request(a).post('/api/cobros').send({ documento: CAMILA.documento, canal: 'cuenta', llaveIdempotencia: llave() }).expect(201)).body
    expect(cobro).toMatchObject({ estado: 'Pagando', monto: '23000000' })
    await esperarPagos()
    expect((await request(a).get(`/api/cobros/${cobro.id}`)).body.estado).toBe('Pagado')
    expect(vi.mocked(op.crearPagoEntrante)).toHaveBeenLastCalledWith(
      expect.objectContaining({ billetera: 'https://ilp.interledger-test.dev/camila' }),
    )
  })

  it('se le puede poner PIN después y así retira en el punto', async () => {
    await registrar(CAMILA).expect(201)
    await programaActivo()
    await request(a).post(`/api/beneficiarios/${CAMILA.documento}/pin`).send({ pin: '12' }).expect(400)
    await request(a).post('/api/beneficiarios/55555555/pin').send({ pin: '1234' }).expect(404)
    await request(a).post(`/api/beneficiarios/${CAMILA.documento}/pin`).send({ pin: '1234' }).expect(200)
    const retiro = await request(a)
      .post('/api/cobros')
      .send({ documento: CAMILA.documento, canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: llave() })
      .expect(201)
    expect(retiro.body.estado).toBe('PorConfirmar')
    expect((await request(a).post(`/api/cobros/${retiro.body.id}/confirmar`).send({ pin: '1234' })).status).toBe(202)
  })

  it('sin PIN no cobra en el punto, y puede cambiar su cuenta sin PIN', async () => {
    await registrar(CAMILA).expect(201)
    await programaActivo()
    const retiro = await request(a)
      .post('/api/cobros')
      .send({ documento: CAMILA.documento, canal: 'retiro', puntoId: IDS.punto, llaveIdempotencia: llave() })
      .expect(422)
    expect(retiro.body.error.codigo).toBe('SinPin')
    await request(a).post('/api/cuentas').send({ documento: CAMILA.documento, billetera: '$ilp.interledger-test.dev/camila-2' }).expect(201)
    // Quien sí tiene PIN lo sigue necesitando
    await request(a).post('/api/cuentas').send({ documento: '900000002', billetera: '$ilp.interledger-test.dev/prueba-luis' }).expect(422)
  })
})

describe('monto por persona y puntos del equipo', () => {
  it('el programa guarda el monto en pesos como unidades mínimas', async () => {
    const p = (await request(a).post('/api/programas').send({ ...PROGRAMA, montoPorPersona: '10000' }).expect(201)).body
    expect(p.montoPorPersona).toBe('1000000')
    expect((await request(a).get(`/api/programas/${p.id}/liquidacion`)).body).toMatchObject({ cedulas: 3, total: '3000000' })
    const editado = (await request(a).patch(`/api/programas/${p.id}`).send({ montoPorPersona: '2500.50' }).expect(200)).body
    expect(editado.montoPorPersona).toBe('250050')
    await request(a).post('/api/programas').send({ ...PROGRAMA, montoPorPersona: '10.000,00' }).expect(400)
    await request(a).post('/api/programas').send({ ...PROGRAMA, montoPorPersona: '0' }).expect(400)
  })

  it('un punto se registra con nombre y wallet; la dirección es opcional', async () => {
    const p = (await request(a).post('/api/puntos').send({ nombre: 'Tienda de Camila', billetera: '$ilp.interledger-test.dev/camila-punto' }).expect(201)).body
    expect(p).toMatchObject({ nombre: 'Tienda de Camila', direccion: 'Sin dirección' })
  })
})

describe('GET /estado (pagos reales o simulados)', () => {
  it('con la llave bien y sin programas de mentira, los pagos son reales', async () => {
    const e = (await request(a).get('/api/estado').expect(200)).body
    expect(e).toMatchObject({ pagosReales: true, faltan: [], programasConTokenFalso: 0 })
    expect(JSON.stringify(e)).not.toMatch(/prueba-cliente|llave-de-prueba/)
  })

  it('un programa con el token falso de la semilla «solo UI» los vuelve simulados', async () => {
    const id = await programaActivo()
    ejecutar('UPDATE programa SET token_acceso = :t WHERE id = :id', { t: TOKEN_FALSO, id })
    const e = (await request(a).get('/api/estado').expect(200)).body
    expect(e.pagosReales).toBe(false)
    expect(e.faltan[0]).toMatch(/npm run db:reset -w api/)
  })

  it('sin la llave configurada dice qué falta', async () => {
    vi.mocked(op.diagnosticoLlave).mockResolvedValueOnce({ configurado: false, coincide: null, detalle: 'Faltan en api/.env: OP_KEY_ID' })
    const e = (await request(a).get('/api/estado').expect(200)).body
    expect(e).toMatchObject({ pagosReales: false, faltan: ['Faltan en api/.env: OP_KEY_ID'] })
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prepararBd } from '../../test/ayuda.js'
import { reiniciarConfig } from '../config.js'
import { conexion } from '../db/conexion.js'
import * as programas from '../db/repositorios/programas.js'
import * as datos from './datos.js'

// Un programa que no existe: el monto sale de LIQUIDACION_MONTO_BASE y no hay corte de tope
const SIN_PROGRAMA = '00000000-0000-0000-0000-000000000000'

beforeEach(async () => {
  await prepararBd()
})

afterEach(() => {
  reiniciarConfig({ LIQUIDACION_MONTO_BASE: '23000000' })
})

function programa(montoPorPersona: number | null = null) {
  return programas.crear({
    entidad: 'Entidad de prueba',
    nombre: 'Programa de prueba',
    tipo: 'subsidio',
    destino: 'libre',
    billetera_programa: 'https://ilp.interledger-test.dev/prueba-programa',
    codigo_moneda: 'COP',
    escala_moneda: 2,
    vigencia_inicio: '2026-01-01T00:00:00.000Z',
    vigencia_fin: '2099-12-31T23:59:59.000Z',
    monto_por_persona: montoPorPersona,
  })
}

describe('liquidación simulada en el esquema piloto_gobierno (Plan backend § 5, Plan Supabase y pnpm § 3)', () => {
  it('3 cédulas y $690.000: la novedad de Rosa no cuenta para el tope', async () => {
    expect(await datos.resumen(SIN_PROGRAMA)).toEqual({ cedulas: 3, total: '69000000' })
    expect(await datos.pago(SIN_PROGRAMA, '900000004')).toEqual({ documento: '900000004', disponible: true, monto: '46000000', novedad: true })
    expect(await datos.pago(SIN_PROGRAMA, '123')).toEqual({ disponible: false })
  })

  it('el monto base se baja por configuración (plan general § 10)', async () => {
    reiniciarConfig({ LIQUIDACION_MONTO_BASE: '230000' })
    expect((await datos.resumen(SIN_PROGRAMA)).total).toBe('690000')
    expect(await datos.pago(SIN_PROGRAMA, '900000004')).toMatchObject({ monto: '460000' })
  })

  it('el monto por persona del programa manda sobre el monto base', async () => {
    const p = await programa(1_000_000) // $10.000
    expect(await datos.resumen(p.id)).toEqual({ cedulas: 3, total: '3000000' })
    expect(await datos.pago(p.id, '900000001')).toMatchObject({ monto: '1000000', novedad: false })
  })

  it('el PIN se guarda con hash y se valida', async () => {
    expect(await datos.validarPin('900000003', '3333')).toBe(true)
    expect(await datos.validarPin('900000003', '1111')).toBe(false)
    expect(await datos.validarPin('123', '1111')).toBe(false)
    const [guardado] = await conexion().filas<{ pin_hash: string }>("SELECT pin_hash FROM piloto_gobierno.persona WHERE documento = '900000003'")
    expect(guardado!.pin_hash).not.toContain('3333')
  })

  it('el gobierno tiene el nombre; Tatú solo sabe si hay PIN, nunca cuál es', async () => {
    expect(await datos.personas(['900000001', '900000003', '123'])).toEqual([
      { documento: '900000001', nombre: 'Ana', tienePin: true },
      { documento: '900000003', nombre: 'Jorge', tienePin: true },
    ])
  })

  it('una persona inscrita sin PIN existe, pero ningún PIN le sirve; inscribir otra vez la actualiza', async () => {
    await datos.inscribir('12345678', 'Camila')
    expect(await datos.personas(['12345678'])).toEqual([{ documento: '12345678', nombre: 'Camila', tienePin: false }])
    expect(await datos.validarPin('12345678', '0000')).toBe(false)
    await datos.inscribir('12345678', 'Camila Rojas', '4321')
    expect(await datos.personas(['12345678'])).toEqual([{ documento: '12345678', nombre: 'Camila Rojas', tienePin: true }])
    expect(await datos.ponerPin('99999999', '1111')).toBe(false)
  })

  it('quien se registra después de fijar el tope es novedad para ese programa (RN-08)', async () => {
    const p = await programa()
    // Las marcas de tiempo van en milisegundos: las pausas evitan empates con la semilla
    await new Promise((ok) => setTimeout(ok, 5))
    // db/003: el corte es aprobacion_solicitada_en (antes, el evento hacia EsperandoAprobacion)
    await programas.actualizar(p.id, { estado: 'EsperandoAprobacion', tope_total: 69000000, aprobacion_solicitada_en: new Date().toISOString() })
    await new Promise((ok) => setTimeout(ok, 5))
    await datos.inscribir('12345678', 'Camila', '5555')

    expect(await datos.pago(p.id, '12345678')).toMatchObject({ disponible: true, novedad: true })
    expect(await datos.resumen(p.id)).toEqual({ cedulas: 3, total: '69000000' })
    // Para un programa todavía en Borrador sí cuenta
    expect((await datos.resumen((await programa()).id)).cedulas).toBe(4)
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prepararBd } from '../../test/ayuda.js'
import { reiniciarConfig } from '../config.js'
import { uno } from '../db/conexion.js'
import * as programas from '../db/repositorios/programas.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as datos from './datos.js'

// Un programa que no existe: el monto sale de LIQUIDACION_MONTO_BASE y no hay corte de tope
const SIN_PROGRAMA = '00000000-0000-0000-0000-000000000000'

beforeEach(() => {
  prepararBd()
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

describe('liquidación simulada en la BD (Plan backend § 5 y Plan de ajustes § 2)', () => {
  it('3 cédulas y $690.000: la novedad de Rosa no cuenta para el tope', () => {
    expect(datos.resumen(SIN_PROGRAMA)).toEqual({ cedulas: 3, total: '69000000' })
    expect(datos.pago(SIN_PROGRAMA, '900000004')).toEqual({ documento: '900000004', disponible: true, monto: '46000000', novedad: true })
    expect(datos.pago(SIN_PROGRAMA, '123')).toEqual({ disponible: false })
  })

  it('el monto base se baja por configuración (plan general § 10)', () => {
    reiniciarConfig({ LIQUIDACION_MONTO_BASE: '230000' })
    expect(datos.resumen(SIN_PROGRAMA).total).toBe('690000')
    expect(datos.pago(SIN_PROGRAMA, '900000004')).toMatchObject({ monto: '460000' })
  })

  it('el monto por persona del programa manda sobre el monto base', () => {
    const p = programa(1_000_000) // $10.000
    expect(datos.resumen(p.id)).toEqual({ cedulas: 3, total: '3000000' })
    expect(datos.pago(p.id, '900000001')).toMatchObject({ monto: '1000000', novedad: false })
  })

  it('el PIN se guarda con hash y se valida', () => {
    expect(datos.validarPin('900000003', '3333')).toBe(true)
    expect(datos.validarPin('900000003', '1111')).toBe(false)
    expect(datos.validarPin('123', '1111')).toBe(false)
    const guardado = uno<{ pin_hash: string }>("SELECT pin_hash FROM liquidacion_persona WHERE documento = '900000003'")!
    expect(guardado.pin_hash).not.toContain('3333')
  })

  it('una persona sin PIN existe, pero ningún PIN le sirve', () => {
    datos.registrar('12345678')
    expect(datos.existe('12345678')).toBe(true)
    expect(datos.tienePin('12345678')).toBe(false)
    expect(datos.validarPin('12345678', '0000')).toBe(false)
  })

  it('quien se registra después de fijar el tope es novedad para ese programa (RN-08)', async () => {
    const p = programa()
    // Las marcas de tiempo van en milisegundos: las pausas evitan empates con la semilla
    await new Promise((ok) => setTimeout(ok, 5))
    programas.actualizar(p.id, { estado: 'EsperandoAprobacion', tope_total: 69000000 })
    eventos.registrar({ tipo: 'programa', id: p.id, desde: 'Borrador', hacia: 'EsperandoAprobacion', detalle: {} })
    await new Promise((ok) => setTimeout(ok, 5))
    datos.registrar('12345678', '5555')

    expect(datos.pago(p.id, '12345678')).toMatchObject({ disponible: true, novedad: true })
    expect(datos.resumen(p.id)).toEqual({ cedulas: 3, total: '69000000' })
    // Para un programa todavía en Borrador sí cuenta
    expect(datos.resumen(programa().id).cedulas).toBe(4)
  })
})

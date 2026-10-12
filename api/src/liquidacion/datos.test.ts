import { beforeEach, describe, expect, it } from 'vitest'
import { cargarNovedad, consultar, marcarPagado, reiniciar, resumen } from './datos'

// HU-02 · Consultar la liquidación de la entidad (servicio simulado, P-10).
describe('liquidación simulada (HU-02)', () => {
  beforeEach(() => reiniciar())

  it('resume 3 cédulas con un tope de $690.000 (RN-08)', () => {
    const r = resumen()
    expect(r.programa).toBe('Subsidio jóvenes (simulado)')
    expect(r.cedulas).toBe(3)
    expect(r.total).toEqual({ value: '69000000', assetCode: 'COP', assetScale: 2 })
  })

  it('responde por cédula solo si tiene un pago disponible y por cuánto (RN-01)', () => {
    const ana = consultar('1000000001')
    expect(ana).toMatchObject({ documento: '1000000001', disponible: true, yaPagado: false })
    expect(ana?.monto).toEqual({ value: '23000000', assetCode: 'COP', assetScale: 2 })
  })

  it('una cédula que no está en la liquidación no tiene pago disponible', () => {
    expect(consultar('9999999999')).toBeNull()
  })

  it('una cédula ya pagada deja de estar disponible', () => {
    marcarPagado('1000000001')
    expect(consultar('1000000001')).toMatchObject({ disponible: false, yaPagado: true, monto: null })
    // Las otras cédulas siguen disponibles.
    expect(consultar('1000000002')?.disponible).toBe(true)
  })

  it('una novedad cargada después de aprobar queda disponible para cobrar (RN-09)', () => {
    const novedad = cargarNovedad({ documento: '1000000004', nombre: 'Retroactivo', monto: 46_000_000 })
    expect(novedad).toMatchObject({ documento: '1000000004', disponible: true, yaPagado: false })
    expect(novedad.monto).toEqual({ value: '46000000', assetCode: 'COP', assetScale: 2 })
    expect(resumen().cedulas).toBe(4)
  })

  it('recargar una novedad existente actualiza el monto sin duplicar la cédula', () => {
    cargarNovedad({ documento: '1000000001', nombre: 'Ana', monto: 46_000_000 })
    expect(consultar('1000000001')?.monto).toEqual({ value: '46000000', assetCode: 'COP', assetScale: 2 })
    expect(resumen().cedulas).toBe(3)
  })
})

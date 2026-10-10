import { describe, expect, it } from 'vitest'
import { aDecimal, aTexto, deTexto, desdeDecimal, formatear, montoOP } from './montos.js'

describe('montos en unidades mínimas (RN-11)', () => {
  it('texto ↔ entero', () => {
    expect(deTexto('23000000')).toBe(23000000)
    expect(aTexto(23000000)).toBe('23000000')
    expect(() => deTexto('230000.00')).toThrow()
    expect(() => deTexto('-1')).toThrow()
    expect(() => deTexto('9007199254740993')).toThrow() // más que un entero seguro
  })

  it('escala 2: $230.000 = 23000000', () => {
    expect(desdeDecimal('230000', 2)).toBe(23000000n)
    expect(desdeDecimal('230000.5', 2)).toBe(23000050n)
    expect(aDecimal(23000000, 2)).toBe('230000.00')
    expect(aDecimal(5, 2)).toBe('0.05')
    expect(() => desdeDecimal('1.234', 2)).toThrow()
  })

  it('escala 0', () => {
    expect(desdeDecimal('230000', 0)).toBe(230000n)
    expect(aDecimal(230000, 0)).toBe('230000')
    expect(() => desdeDecimal('1.5', 0)).toThrow()
  })

  it('montos grandes sin perder precisión (nunca float)', () => {
    const grande = '123456789012345678901234567890'
    expect(desdeDecimal(`${grande}.12`, 2).toString()).toBe(`${grande}12`)
    expect(aDecimal(BigInt(`${grande}12`), 2)).toBe(`${grande}.12`)
    expect(aDecimal(10n ** 30n + 5n, 18)).toBe('1000000000000.000000000000000005')
  })

  it('formato colombiano para pantallas', () => {
    expect(formatear(23000000, 2)).toBe('$230.000')
    expect(formatear(69000050, 2)).toBe('$690.000,50')
  })

  it('el monto que espera Open Payments', () => {
    expect(montoOP(23000000, { codigo: 'COP', escala: 2 })).toEqual({ value: '23000000', assetCode: 'COP', assetScale: 2 })
  })
})

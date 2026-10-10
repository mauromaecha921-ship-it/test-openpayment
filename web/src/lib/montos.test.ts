import { describe, expect, it } from 'vitest'

import { aPesos, formatMonto, sumarMontos } from './montos'

describe('formatMonto', () => {
  it('COP con escala 2, sin centavos como en los wireframes', () => {
    expect(formatMonto('23000000', 'COP', 2)).toBe('$230.000')
    expect(formatMonto('69000000', 'COP', 2)).toBe('$690.000')
    expect(formatMonto('0', 'COP', 2)).toBe('$0')
  })

  it('COP muestra los centavos cuando no son cero', () => {
    expect(formatMonto('23000050', 'COP', 2)).toBe('$230.000,50')
  })

  it('USD conserva sus decimales', () => {
    expect(formatMonto('1250', 'USD', 2)).toBe('$12,50')
    expect(formatMonto('5', 'USD', 2)).toBe('$0,05')
    expect(formatMonto('100000', 'USD', 2)).toBe('$1.000,00')
  })

  it('escala 0', () => {
    expect(formatMonto('230000', 'COP', 0)).toBe('$230.000')
    expect(formatMonto('7', 'USD', 0)).toBe('$7')
  })

  it('montos más grandes que Number.MAX_SAFE_INTEGER, sin float', () => {
    expect(formatMonto('123456789012345678901', 'COP', 2)).toBe('$1.234.567.890.123.456.789,01')
    expect(formatMonto('900719925474099300', 'COP', 2)).toBe('$9.007.199.254.740.993')
  })

  it('negativos y ceros a la izquierda', () => {
    expect(formatMonto('-23000000', 'COP', 2)).toBe('-$230.000')
    expect(formatMonto('000150', 'USD', 2)).toBe('$1,50')
    expect(formatMonto('-0', 'COP', 2)).toBe('$0')
  })

  it('rechaza lo que no es un entero en unidades mínimas', () => {
    expect(() => formatMonto('230.000', 'COP', 2)).toThrow()
    expect(() => formatMonto('1e5', 'COP', 2)).toThrow()
    expect(() => formatMonto('100', 'COP', -1)).toThrow()
  })
})

describe('sumarMontos', () => {
  it('suma con BigInt', () => {
    expect(sumarMontos('23000000', '23000000')).toBe('46000000')
    expect(sumarMontos('9007199254740993', '1')).toBe('9007199254740994')
  })
})

describe('aPesos', () => {
  it('pasa de unidades mínimas a pesos, sin ceros de sobra', () => {
    expect(aPesos('1000000', 2)).toBe('10000')
    expect(aPesos('250050', 2)).toBe('2500.50')
    expect(aPesos('5', 0)).toBe('5')
  })
})

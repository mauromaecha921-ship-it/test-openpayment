import { describe, expect, it } from 'vitest'
import { despuesDeSolicitado, ESTADOS_COBRO, esFinal, exigirTransicion, puedeTransicionar, type EstadoCobro } from './estados.js'

// RNF-07: todas las transiciones, válidas e inválidas (36 pares)
const VALIDAS = new Set([
  'Solicitado>PorConfirmar',
  'Solicitado>Pagando',
  'Solicitado>Rechazado',
  'PorConfirmar>Pagando',
  'PorConfirmar>Rechazado',
  'Pagando>Pagado',
  'Pagando>Fallido',
])

describe('máquina del cobro', () => {
  const pares = ESTADOS_COBRO.flatMap((d) => ESTADOS_COBRO.map((h) => [d, h] as [EstadoCobro, EstadoCobro]))

  it.each(pares)('%s → %s', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(VALIDAS.has(`${desde}>${hacia}`))
  })

  it('los finales no salen a ningún lado', () => {
    expect(ESTADOS_COBRO.filter(esFinal)).toEqual(['Pagado', 'Rechazado', 'Fallido'])
  })

  it('el canal cuenta salta PorConfirmar; retiro y compra esperan el PIN', () => {
    expect(despuesDeSolicitado('cuenta')).toBe('Pagando')
    expect(despuesDeSolicitado('retiro')).toBe('PorConfirmar')
    expect(despuesDeSolicitado('compra')).toBe('PorConfirmar')
  })

  it('exigirTransicion lanza con un salto imposible', () => {
    expect(() => exigirTransicion('Fallido', 'Pagado')).toThrow(/no permitida/)
    expect(() => exigirTransicion('Pagando', 'Pagado')).not.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { candidatos, verificarHash } from './hash.js'

// Vector oficial (Hallazgos § 3.5, docs identity/hash-verification)
const VECTOR = {
  nonceCliente: 'VJLO6A4CATR0KRO',
  nonceCierre: 'MBDOFXG4Y5CVJCX821LH',
  interactRef: '4IFWWIKYB2PQ6U56NL1',
  urlPermiso: 'https://server.example.com/tx',
}

describe('hash del callback (HU-04, RNF-01, V-05)', () => {
  it('acepta las 3 variantes del vector oficial', () => {
    expect(verificarHash('x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY=', VECTOR)?.variante).toBe('estandar-con-padding')
    expect(verificarHash('x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY', VECTOR)?.variante).toBe('estandar-sin-padding')
    expect(verificarHash('x-gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY', VECTOR)?.variante).toBe('base64url')
  })

  it('hash alterado → rechazado', () => {
    expect(verificarHash('x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffZ=', VECTOR)).toBeNull()
    expect(verificarHash('', VECTOR)).toBeNull()
    expect(verificarHash('x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY=', { ...VECTOR, interactRef: 'otro' })).toBeNull()
  })

  it('grant_url con y sin / final', () => {
    // El vector se calculó sin barra; guardada con barra igual coincide
    const conBarra = { ...VECTOR, urlPermiso: 'https://server.example.com/tx/' }
    expect(verificarHash('x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY=', conBarra)?.grantUrl).toBe('https://server.example.com/tx')
    expect(candidatos(VECTOR)).toHaveLength(6)
    expect(new Set(candidatos(VECTOR).map((c) => c.grantUrl))).toEqual(
      new Set(['https://server.example.com/tx', 'https://server.example.com/tx/']),
    )
  })
})

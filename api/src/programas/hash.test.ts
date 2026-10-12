import { describe, expect, it } from 'vitest'
import { CallbackRechazadoError, HashNoCoincideError, verificarHashCallback } from './hash'

const vector = {
  nonce: 'VJLO6A4CATR0KRO',
  finishNonce: 'MBDOFXG4Y5CVJCX821LH',
  interactRef: '4IFWWIKYB2PQ6U56NL1',
  grantUrl: 'https://server.example.com/tx',
}

describe('verificación del hash del callback (HU-04)', () => {
  it('rechaza un hash alterado (RNF-01: test bloqueante)', () => {
    expect(() =>
      verificarHashCallback({
        ...vector,
        hashRecibido: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).toThrow(HashNoCoincideError)
  })

  it('acepta el hash con las 3 variantes base64 (Hallazgos § 3.5)', () => {
    const raw = 'x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY='
    const sinPadding = 'x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY'
    const urlSafe = 'x-gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY'

    expect(() => verificarHashCallback({ ...vector, hashRecibido: raw })).not.toThrow()
    expect(() => verificarHashCallback({ ...vector, hashRecibido: sinPadding })).not.toThrow()
    expect(() => verificarHashCallback({ ...vector, hashRecibido: urlSafe })).not.toThrow()
  })

  it('maneja grant_rejected y grant_invalid', () => {
    expect(() => verificarHashCallback({ ...vector }, 'grant_rejected')).toThrow(
      CallbackRechazadoError,
    )
    expect(() => verificarHashCallback({ ...vector }, 'grant_invalid')).toThrow(
      CallbackRechazadoError,
    )
  })
})

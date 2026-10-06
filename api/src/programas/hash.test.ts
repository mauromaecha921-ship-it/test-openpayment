import { describe, it } from 'vitest'

describe('verificación del hash del callback (HU-04)', () => {
  it.todo('rechaza un hash alterado (RNF-01: test bloqueante)')
  it.todo('acepta el hash con las 3 variantes base64 (Hallazgos § 3.5)')
  it.todo('maneja grant_rejected y grant_invalid')
})

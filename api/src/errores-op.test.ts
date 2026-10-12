import { OpenPaymentsClientError } from '@interledger/open-payments'
import { describe, expect, it } from 'vitest'
import { traducir } from './openPaymentsService.js'

const error = (status: number, description: string) => new OpenPaymentsClientError('Error de prueba', { status, code: String(status), description })

describe('traducir errores de Open Payments (D-34)', () => {
  it('403 «Inactive Token» es token vencido, no tope: así conToken lo rota y reintenta', () => {
    expect(traducir(error(403, 'Inactive Token'), 'pagoSaliente').tipo).toBe('TokenVencido')
    expect(traducir(error(403, 'Inactive Token'), 'otra').tipo).toBe('TokenVencido')
  })

  it('401 sigue siendo token vencido y otro 403 al pagar sigue siendo el tope', () => {
    expect(traducir(error(401, 'Unauthorized'), 'otra').tipo).toBe('TokenVencido')
    expect(traducir(error(403, 'Insufficient grant'), 'pagoSaliente').tipo).toBe('TopeSuperado')
  })
})

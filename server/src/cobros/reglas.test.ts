import { describe, expect, it } from 'vitest'
import * as r from './reglas.js'

const ahora = new Date('2026-10-16T15:00:00.000Z')

describe('RN-01 · pago disponible en la liquidación', () => {
  it('sin pago o no disponible → SinPagoDisponible', () => {
    expect(r.rn01PagoDisponible(null)).toBe('SinPagoDisponible')
    expect(r.rn01PagoDisponible({ disponible: false })).toBe('SinPagoDisponible')
    expect(r.rn01PagoDisponible({ disponible: true })).toBeNull()
  })
})

describe('RN-02 · un solo cobro vivo o pagado (D-08)', () => {
  it('Pagado → YaCobrado; vivo → EnProceso; nada → pasa', () => {
    expect(r.rn02CobroExistente('Pagado')).toBe('YaCobrado')
    expect(r.rn02CobroExistente('PorConfirmar')).toBe('EnProceso')
    expect(r.rn02CobroExistente('Pagando')).toBe('EnProceso')
    expect(r.rn02CobroExistente(null)).toBeNull()
  })
})

describe('RN-03 · canal según el destino', () => {
  it('libre: cuenta y retiro sí, compra no', () => {
    expect(r.rn03CanalPermitido({ destino: 'libre', canal: 'cuenta' })).toBeNull()
    expect(r.rn03CanalPermitido({ destino: 'libre', canal: 'retiro' })).toBeNull()
    expect(r.rn03CanalPermitido({ destino: 'libre', canal: 'compra' })).toBe('ProgramaNoRecibe')
  })
  it('restringido: solo compra en comercio autorizado', () => {
    expect(r.rn03CanalPermitido({ destino: 'restringido', canal: 'compra', puntoAutorizado: true })).toBeNull()
    expect(r.rn03CanalPermitido({ destino: 'restringido', canal: 'compra', puntoAutorizado: false })).toBe('ComercioNoAutorizado')
    expect(r.rn03CanalPermitido({ destino: 'restringido', canal: 'cuenta' })).toBe('SoloEnComercios')
  })
})

describe('RN-04 · cuenta Verificada y en la misma moneda', () => {
  const cop = { codigo: 'COP', escala: 2 }
  it('sin cuenta o sin verificar → CuentaNoVerificada', () => {
    expect(r.rn04CuentaLista({ cuenta: null, monedaCuenta: null, monedaPrograma: cop })).toBe('CuentaNoVerificada')
    expect(r.rn04CuentaLista({ cuenta: { estado: 'PorVerificar' }, monedaCuenta: cop, monedaPrograma: cop })).toBe('CuentaNoVerificada')
  })
  it('otra moneda u otra escala → CuentaNoVerificada', () => {
    const v = { estado: 'Verificada' }
    expect(r.rn04CuentaLista({ cuenta: v, monedaCuenta: { codigo: 'USD', escala: 2 }, monedaPrograma: cop })).toBe('CuentaNoVerificada')
    expect(r.rn04CuentaLista({ cuenta: v, monedaCuenta: { codigo: 'COP', escala: 0 }, monedaPrograma: cop })).toBe('CuentaNoVerificada')
    expect(r.rn04CuentaLista({ cuenta: v, monedaCuenta: cop, monedaPrograma: cop })).toBeNull()
  })
})

describe('RN-05 · el monto lo calcula el backend', () => {
  it('subsidio: el valor completo', () => {
    expect(r.rn05Monto({ tipo: 'subsidio', valorDisponible: 23000000, totalCompra: 100 })).toBe(23000000)
  })
  it('bono: min(valor, total de la compra)', () => {
    expect(r.rn05Monto({ tipo: 'bono', valorDisponible: 23000000, totalCompra: 5000000 })).toBe(5000000)
    expect(r.rn05Monto({ tipo: 'bono', valorDisponible: 23000000, totalCompra: 90000000 })).toBe(23000000)
    expect(() => r.rn05Monto({ tipo: 'bono', valorDisponible: 23000000 })).toThrow()
  })
})

describe('RN-06 · Activo y en vigencia', () => {
  const vigencia = { vigenciaInicio: '2026-10-01T00:00:00.000Z', vigenciaFin: '2026-12-31T23:59:59.000Z', ahora }
  it('Cerrado → ProgramaCerrado; Pausado o Borrador → ProgramaNoRecibe', () => {
    expect(r.rn06ProgramaRecibe({ estado: 'Cerrado', ...vigencia })).toBe('ProgramaCerrado')
    expect(r.rn06ProgramaRecibe({ estado: 'Pausado', ...vigencia })).toBe('ProgramaNoRecibe')
    expect(r.rn06ProgramaRecibe({ estado: 'Borrador', ...vigencia })).toBe('ProgramaNoRecibe')
    expect(r.rn06ProgramaRecibe({ estado: 'Activo', ...vigencia })).toBeNull()
  })
  it('fuera de vigencia → ProgramaNoRecibe', () => {
    expect(r.rn06ProgramaRecibe({ estado: 'Activo', ...vigencia, ahora: new Date('2027-01-01T00:00:00Z') })).toBe('ProgramaNoRecibe')
    expect(r.rn06ProgramaRecibe({ estado: 'Activo', ...vigencia, ahora: new Date('2026-09-30T00:00:00Z') })).toBe('ProgramaNoRecibe')
  })
})

describe('RN-07 · PIN con intentos y bloqueo', () => {
  it('correcto, incorrecto con intentos restantes, y bloqueado al tercero', () => {
    expect(r.rn07EvaluarPin({ valido: true, intentosPrevios: 2, maxIntentos: 3 })).toEqual({ resultado: 'correcto' })
    expect(r.rn07EvaluarPin({ valido: false, intentosPrevios: 0, maxIntentos: 3 })).toEqual({ resultado: 'incorrecto', intentos: 1, restantes: 2 })
    expect(r.rn07EvaluarPin({ valido: false, intentosPrevios: 1, maxIntentos: 3 })).toEqual({ resultado: 'incorrecto', intentos: 2, restantes: 1 })
    expect(r.rn07EvaluarPin({ valido: false, intentosPrevios: 2, maxIntentos: 3 })).toEqual({ resultado: 'bloqueado', intentos: 3 })
  })
  it('bloqueado mientras no pase bloqueado_hasta (tabla bloqueo_pin de db/003)', () => {
    const enCinco = new Date(ahora.getTime() + 5 * 60_000).toISOString()
    const haceUno = new Date(ahora.getTime() - 60_000).toISOString()
    expect(r.rn07Bloqueada({ bloqueadoHasta: enCinco, ahora })).toBe(true)
    expect(r.rn07Bloqueada({ bloqueadoHasta: haceUno, ahora })).toBe(false)
    expect(r.rn07Bloqueada({ bloqueadoHasta: null, ahora })).toBe(false)
  })
})

describe('RN-11 · montos en unidades mínimas', () => {
  it('solo enteros positivos en texto', () => {
    expect(r.rn11MontoValido({ monto: '23000000', escala: 2 })).toBe(true)
    expect(r.rn11MontoValido({ monto: '0', escala: 2 })).toBe(false)
    expect(r.rn11MontoValido({ monto: '230000.00', escala: 2 })).toBe(false)
    expect(r.rn11MontoValido({ monto: '-5', escala: 2 })).toBe(false)
  })
})

describe('RN-12 · PorConfirmar vence a los 120 s', () => {
  const desde = '2026-10-16T14:58:00.000Z'
  it('vence solo si pasó el tiempo y sigue en PorConfirmar', () => {
    expect(r.rn12Vencio({ estado: 'PorConfirmar', desde, ahora, ttlSeg: 120 })).toBe(false) // justo 120 s
    expect(r.rn12Vencio({ estado: 'PorConfirmar', desde, ahora: new Date(ahora.getTime() + 1), ttlSeg: 120 })).toBe(true)
    expect(r.rn12Vencio({ estado: 'Pagando', desde, ahora: new Date(ahora.getTime() + 60_000), ttlSeg: 120 })).toBe(false)
    expect(r.confirmarAntesDe(desde, 120)).toBe('2026-10-16T15:00:00.000Z')
  })
})

describe('RN-10 · cuándo un pago se completó (D-15)', () => {
  it('failed → Fallido; envió todo → Pagado; entrante completado → Pagado; si no, sigue', () => {
    expect(r.rn10Resultado({ saliente: { fallido: true, debitado: '10', enviado: '0' } })).toBe('Fallido')
    expect(r.rn10Resultado({ saliente: { fallido: false, debitado: '10', enviado: '10' } })).toBe('Pagado')
    expect(r.rn10Resultado({ saliente: { fallido: false, debitado: '10', enviado: '3' } })).toBe('Pagando')
    expect(
      r.rn10Resultado({
        saliente: { fallido: false, debitado: '10', enviado: '9' },
        entrante: { completado: true, recibido: '9' },
      }),
    ).toBe('Pagado')
    expect(r.rn10Resultado({ saliente: null, entrante: { completado: false, recibido: '0', esperado: '10' } })).toBe('Pagando')
  })
})

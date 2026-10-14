// Datos de prueba de la API simulada: los mismos de la liquidación simulada del Plan backend § 5
// y de db/002_datos_prueba.sql. Todo es ficticio.

import type { Moneda } from '@/api/tipos'

export const COP: Moneda = { codigo: 'COP', escala: 2 }

export interface PersonaLiquidacion {
  documento: string
  nombre: string
  etiqueta: string
  /** Múltiplo del monto por persona del programa (Rosa recibe el doble). */
  veces: number
  /** null: se registró sin PIN y solo cobra a su cuenta. */
  pin: string | null
  /** Retroactivo cargado después de aprobar: no cuenta para el tope (RN-08). */
  novedad: boolean
  /** Aparece en el selector de rol (Jorge y Rosa no usan la app). */
  usaApp: boolean
  /** Solo las registradas por el equipo: si llegaron después de fijar el tope, son novedad. */
  registrada?: string
  /** Valor propio en unidades mínimas (carga por Excel); si falta, el del programa por `veces`. */
  valorPropio?: string
}

/** $230.000: el monto por persona de los programas que no dicen otro. */
export const MONTO_BASE = '23000000'

export const PERSONAS: PersonaLiquidacion[] = [
  { documento: '900000001', nombre: 'Ana', etiqueta: 'C.C. de prueba 1', veces: 1, pin: '1111', novedad: false, usaApp: true },
  { documento: '900000002', nombre: 'Luis', etiqueta: 'C.C. de prueba 2', veces: 1, pin: '2222', novedad: false, usaApp: true },
  { documento: '900000003', nombre: 'Jorge', etiqueta: 'C.C. de prueba 3', veces: 1, pin: '3333', novedad: false, usaApp: false },
  { documento: '71234567', nombre: 'Jorge P.', etiqueta: 'C.C. ··· 567', veces: 1, pin: '3333', novedad: false, usaApp: false },
  { documento: '900000004', nombre: 'Rosa', etiqueta: 'C.C. de prueba 4', veces: 2, pin: '4444', novedad: true, usaApp: false },
]

export const HOST_TEST_WALLET = 'ilp.interledger-test.dev'

export const WALLET_ANA = `https://${HOST_TEST_WALLET}/tatu-ana`
export const WALLET_PUNTO = `https://${HOST_TEST_WALLET}/tatu-punto1`
export const WALLET_PROGRAMA = `https://${HOST_TEST_WALLET}/tatu-programa`

export const PUNTO_INICIAL = {
  id: 'b0000000-0000-0000-0000-000000000001',
  nombre: 'Tienda Marta — corresponsal',
  direccion: 'Calle 1 # 2-3',
  billetera: WALLET_PUNTO,
}

export const CONFIG = {
  pollIntervaloMs: 1000,
  confirmacionTtlSeg: 120,
  pinMaxIntentos: 3,
  pinBloqueoMin: 15,
  aprobacionTtlMin: 10,
}

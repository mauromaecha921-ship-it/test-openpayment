// Cédulas de prueba, montos y PIN de prueba del simulador (Arquitectura § 4.1):
//
//   - 3 cédulas de $230.000 (tope del programa: $690.000): Ana y otra persona
//     con cuenta; Jorge sin celular, cobra en el punto.
//   - 1 cédula con retroactivo de $460.000 que se carga DESPUÉS de aprobar el
//     permiso, para que el banco rechace ese cobro por tope (InsufficientGrant,
//     RN-09).
//   - Bono (extra HU-21, tras EXTRA_BONO): 2 cédulas de $60.000.
//
// PIN de prueba: lo valida este servicio; la plataforma NO lo guarda (AD-14,
// RNF-06). Bloqueo tras 3 PIN fallidos: pendiente P-12 → se implementa en HU-11.
//
// El estado vive en memoria: es un simulador, no una base de datos.
import type { ConsultaCedula, Monto, ResumenLiquidacion } from './contrato'

export const PROGRAMA = 'Subsidio jóvenes (simulado)'
export const MONEDA = { assetCode: 'COP', assetScale: 2 }

interface FilaCedula {
  documento: string
  nombre: string
  monto: number
  yaPagado: boolean
}

const SEMILLA: readonly FilaCedula[] = [
  { documento: '1000000001', nombre: 'Ana', monto: 23_000_000, yaPagado: false },
  { documento: '1000000002', nombre: 'Carlos', monto: 23_000_000, yaPagado: false },
  { documento: '1000000003', nombre: 'Jorge', monto: 23_000_000, yaPagado: false },
]

let filas: FilaCedula[] = SEMILLA.map((fila) => ({ ...fila }))

const aMonto = (value: number): Monto => ({ value: String(value), ...MONEDA })

/** Cuántas cédulas tiene el programa y el total, que es el tope del permiso (RN-08). */
export function resumen(): ResumenLiquidacion {
  const total = filas.reduce((suma, fila) => suma + fila.monto, 0)
  return { programa: PROGRAMA, cedulas: filas.length, total: aMonto(total) }
}

/** Responde por cédula solo si tiene un pago disponible y por cuánto (RN-01). */
export function consultar(documento: string): ConsultaCedula | null {
  const fila = filas.find((c) => c.documento === documento)
  if (!fila) return null
  const disponible = !fila.yaPagado
  return {
    documento: fila.documento,
    nombre: fila.nombre,
    programa: PROGRAMA,
    disponible,
    yaPagado: fila.yaPagado,
    monto: disponible ? aMonto(fila.monto) : null,
  }
}

/**
 * Carga una novedad retroactiva después de aprobar el permiso. La plataforma no
 * la frena por el tope: lo hace cumplir el banco (RN-09).
 */
export function cargarNovedad(datos: { documento: string; nombre: string; monto: number }): ConsultaCedula {
  const fila: FilaCedula = {
    documento: datos.documento,
    nombre: datos.nombre,
    monto: datos.monto,
    yaPagado: false,
  }
  const indice = filas.findIndex((c) => c.documento === datos.documento)
  if (indice >= 0) filas[indice] = fila
  else filas.push(fila)

  return {
    documento: fila.documento,
    nombre: fila.nombre,
    programa: PROGRAMA,
    disponible: true,
    yaPagado: false,
    monto: aMonto(fila.monto),
  }
}

/** Marca una cédula como pagada (el operador de la liquidación refleja el cobro). */
export function marcarPagado(documento: string): ConsultaCedula | null {
  const fila = filas.find((c) => c.documento === documento)
  if (!fila) return null
  fila.yaPagado = true
  return consultar(documento)
}

/** Vuelve a la semilla de la demo (lo usan los tests). */
export function reiniciar(): void {
  filas = SEMILLA.map((fila) => ({ ...fila }))
}

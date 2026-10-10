/**
 * Montos (RN-11): siempre enteros en unidades mínimas según assetScale, como Open Payments.
 * $230.000 con escala 2 = 23000000. Las conversiones van con BigInt, nunca con float.
 */

export interface Moneda {
  codigo: string
  escala: number
}

const SOLO_DIGITOS = /^\d+$/

/** Texto de unidades mínimas («23000000») → número entero seguro para la BD. */
export function deTexto(valor: string): number {
  if (!SOLO_DIGITOS.test(valor)) throw new Error('El monto debe ser un entero en unidades mínimas')
  const n = BigInt(valor)
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El monto es demasiado grande')
  return Number(n)
}

/** Número entero de la BD → texto de unidades mínimas, como lo pide Open Payments. */
export function aTexto(unidades: number | bigint): string {
  const n = BigInt(unidades)
  if (n < 0n) throw new Error('El monto no puede ser negativo')
  return n.toString()
}

/** «230000», «230000.5» o «230000.50» con escala 2 → 23000000n. Rechaza más decimales que la escala. */
export function desdeDecimal(valor: string, escala: number): bigint {
  validarEscala(escala)
  const m = /^(\d+)(?:\.(\d+))?$/.exec(valor.trim())
  if (!m) throw new Error('Monto inválido')
  const [, entero = '0', fraccion = ''] = m
  if (fraccion.length > escala) throw new Error(`El monto tiene más de ${escala} decimales`)
  return BigInt(entero + fraccion.padEnd(escala, '0'))
}

/** 23000000 con escala 2 → «230000.00». */
export function aDecimal(unidades: number | bigint | string, escala: number): string {
  validarEscala(escala)
  const texto = BigInt(unidades).toString()
  if (escala === 0) return texto
  const relleno = texto.padStart(escala + 1, '0')
  return `${relleno.slice(0, -escala)}.${relleno.slice(-escala)}`
}

/** 23000000 COP escala 2 → «$230.000» (formato colombiano, sin centavos si son cero). */
export function formatear(unidades: number | bigint | string, escala: number): string {
  const [entero = '0', fraccion = ''] = aDecimal(unidades, escala).split('.')
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return fraccion && /[1-9]/.test(fraccion) ? `$${miles},${fraccion}` : `$${miles}`
}

/** El monto tal como lo espera Open Payments. */
export function montoOP(unidades: number | bigint, moneda: Moneda) {
  return { value: aTexto(unidades), assetCode: moneda.codigo, assetScale: moneda.escala }
}

function validarEscala(escala: number) {
  if (!Number.isInteger(escala) || escala < 0 || escala > 18) throw new Error('Escala inválida')
}

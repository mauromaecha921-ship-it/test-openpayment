// Los montos llegan como texto en unidades mínimas, con su moneda y su escala (como en Open
// Payments). Se formatean con BigInt, nunca con float (RN-11). La web nunca calcula un monto para
// un cobro: eso lo hace el backend (RN-05).

export interface Moneda {
  codigo: string
  escala: number
}

function separarMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * formatMonto("23000000", "COP", 2) → "$230.000"
 *
 * COP se muestra sin centavos cuando son cero, como en los wireframes; las demás monedas, con todos
 * sus decimales. El código de la moneda lo agrega el componente `Monto` cuando no es COP.
 */
export function formatMonto(valor: string, codigo: string, escala: number): string {
  if (!/^-?\d+$/.test(valor)) throw new Error(`Monto inválido: ${valor}`)
  if (!Number.isInteger(escala) || escala < 0) throw new Error(`Escala inválida: ${escala}`)

  const negativo = valor.startsWith('-')
  const digitos = (negativo ? valor.slice(1) : valor).replace(/^0+(?=\d)/, '')
  const minimo = BigInt(digitos)
  const divisor = 10n ** BigInt(escala)
  const entero = (minimo / divisor).toString()
  const fraccion = escala > 0 ? (minimo % divisor).toString().padStart(escala, '0') : ''

  const sinCentavos = codigo === 'COP' && /^0*$/.test(fraccion)
  const cuerpo = separarMiles(entero) + (fraccion && !sinCentavos ? `,${fraccion}` : '')
  return `${negativo && minimo !== 0n ? '-' : ''}$${cuerpo}`
}

export function formatMontoDe(valor: string, moneda: Moneda): string {
  return formatMonto(valor, moneda.codigo, moneda.escala)
}

/** «1000000» con escala 2 → «10000»; «250050» → «2500.50». Para llenar un campo en pesos. */
export function aPesos(valor: string, escala: number): string {
  const minimo = BigInt(valor)
  const divisor = 10n ** BigInt(escala)
  const fraccion = escala > 0 ? (minimo % divisor).toString().padStart(escala, '0') : ''
  return `${minimo / divisor}${/[1-9]/.test(fraccion) ? `.${fraccion}` : ''}`
}

/** «80000» o «80000.50» en pesos → unidades mínimas con la escala («8000000»); null si no es un monto. */
export function aUnidades(pesos: string, escala: number): string | null {
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(pesos.trim())
  if (!m || (m[2] ?? '').length > escala) return null
  return BigInt(m[1]! + (m[2] ?? '').padEnd(escala, '0')).toString()
}

/** Suma de montos en unidades mínimas, sin pasar por float. */
export function sumarMontos(...valores: string[]): string {
  return valores.reduce((total, v) => total + BigInt(v), 0n).toString()
}

import type { Moneda } from '@/api/tipos'
import { formatMontoDe } from '@/lib/montos'

/** Monto formateado; muestra el código cuando la moneda no es COP. */
export function Monto({ valor, moneda }: { valor: string | null; moneda: Moneda }) {
  return <>{textoMonto(valor, moneda)}</>
}

/** "—" cuando la API no trae el monto (un rechazo que se cortó antes de calcularlo). */
export function textoMonto(valor: string | null, moneda: Moneda): string {
  if (valor === null) return '—'
  const t = formatMontoDe(valor, moneda)
  return moneda.codigo === 'COP' ? t : `${t} ${moneda.codigo}`
}

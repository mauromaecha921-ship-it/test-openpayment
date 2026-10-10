import type { Cobro } from '@/api/tipos'
import { formatSegundos } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Solicitado → Pagando → Pagado · n s (canal cuenta) o PIN confirmado → Pagando → Pagado (retiro).
 * Las barras llenas marcan los pasos ya alcanzados.
 */
export function PasosDelPago({ cobro }: { cobro: Pick<Cobro, 'canal' | 'estado' | 'segundosHastaPagado'> }) {
  const alcanzado = cobro.estado === 'Pagado' ? 3 : cobro.estado === 'Pagando' ? 2 : 1
  const pasos = [
    cobro.canal === 'retiro' ? 'PIN confirmado' : 'Solicitado',
    'Pagando',
    cobro.estado === 'Pagado' && cobro.segundosHastaPagado !== null ? `Pagado · ${formatSegundos(cobro.segundosHastaPagado)}` : 'Pagado',
  ]
  return (
    <ol aria-label="Pasos del pago" className="m-0 flex list-none gap-1.5 p-0 text-sm text-muted-foreground">
      {pasos.map((texto, i) => (
        <li
          key={i}
          aria-current={i + 1 === alcanzado ? 'step' : undefined}
          className={cn(
            'flex-1 border-t-4 pt-1.5',
            i < alcanzado ? 'border-foreground' : 'border-border',
            i + 1 === alcanzado && 'font-bold text-foreground',
          )}
        >
          {texto}
        </li>
      ))}
    </ol>
  )
}

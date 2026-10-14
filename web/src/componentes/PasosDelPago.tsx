import { Check } from 'lucide-react'

import type { Cobro } from '@/api/tipos'
import { formatSegundos } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Solicitado → Pagando → Pagado · n s (canal cuenta) o PIN confirmado → Pagando → Pagado (retiro),
 * dentro del bloque Noche de «Pagando…» como en el prototipo: ✓ en los pasos hechos y el paso en
 * curso con anillo ámbar.
 */
export function PasosDelPago({ cobro }: { cobro: Pick<Cobro, 'canal' | 'estado' | 'segundosHastaPagado'> }) {
  const alcanzado = cobro.estado === 'Pagado' ? 3 : cobro.estado === 'Pagando' ? 2 : 1
  const pasos = [
    cobro.canal === 'retiro' ? 'PIN confirmado' : 'Solicitado',
    'Pagando',
    cobro.estado === 'Pagado' && cobro.segundosHastaPagado !== null ? `Pagado · ${formatSegundos(cobro.segundosHastaPagado)}` : 'Pagado',
  ]
  return (
    <ol aria-label="Pasos del pago" className="m-0 flex list-none flex-col gap-2.5 p-0 text-base">
      {pasos.map((texto, i) => {
        const hecho = i + 1 < alcanzado || (i + 1 === alcanzado && cobro.estado === 'Pagado')
        const actual = i + 1 === alcanzado && !hecho
        return (
          <li key={i} aria-current={actual ? 'step' : undefined} className={cn('flex items-center gap-3', actual ? 'font-bold' : 'text-noche-tenue', hecho && 'text-bloque-texto')}>
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                hecho && 'border-bloque-texto bg-bloque-texto text-bloque',
                actual && 'border-ambar',
                !hecho && !actual && 'border-noche-tenue',
              )}
            >
              {hecho && <Check className="size-4" strokeWidth={3} />}
              {actual && <span className="size-2.5 rounded-full bg-ambar" />}
            </span>
            {texto}
          </li>
        )
      })}
    </ol>
  )
}

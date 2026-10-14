import { Check } from 'lucide-react'

import type { Cobro } from '@/api/tipos'
import { formatSegundos } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Prototipo B5: Solicitado → Pagando → Pagado dentro del bloque Noche. Círculos de 28 px: ✓ en
 * arena el hecho, anillo ámbar con punto el que va, anillo apagado el que falta.
 */
export function PasosDelPago({ cobro }: { cobro: Pick<Cobro, 'canal' | 'estado' | 'segundosHastaPagado'> }) {
  const alcanzado = cobro.estado === 'Pagado' ? 3 : cobro.estado === 'Pagando' ? 2 : 1
  const pasos = [
    cobro.canal === 'retiro' ? 'PIN confirmado' : 'Solicitado',
    'Pagando',
    cobro.estado === 'Pagado' && cobro.segundosHastaPagado !== null ? `Pagado · ${formatSegundos(cobro.segundosHastaPagado)}` : 'Pagado',
  ]
  return (
    <ol aria-label="Pasos del pago" className="m-0 mt-1.5 flex list-none flex-col gap-3 p-0">
      {pasos.map((texto, i) => {
        const hecho = i + 1 < alcanzado || (i + 1 === alcanzado && cobro.estado === 'Pagado')
        const actual = i + 1 === alcanzado && !hecho
        return (
          <li key={i} aria-current={actual ? 'step' : undefined} className={cn('flex items-center gap-3 text-[17px]', actual && 'font-extrabold', !hecho && !actual && 'text-noche-tenue')}>
            {hecho ? (
              <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-full bg-bloque-texto text-bloque">
                <Check className="size-4" strokeWidth={3} />
              </span>
            ) : actual ? (
              <span aria-hidden className="box-border flex size-7 flex-none items-center justify-center rounded-full border-[3px] border-ambar">
                <span className="size-2.5 rounded-full bg-ambar" />
              </span>
            ) : (
              <span aria-hidden className="box-border size-7 flex-none rounded-full border-2 border-anillo-bloque" />
            )}
            {texto}
          </li>
        )
      })}
    </ol>
  )
}

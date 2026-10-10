import { Check } from 'lucide-react'
import { Fragment } from 'react'

import type { EstadoPrograma } from '@/api/tipos'
import { cn } from '@/lib/utils'

const PASOS = ['Borrador', 'Esperando aprobación', 'Activo', 'Cerrado']

function pasoActual(estado: EstadoPrograma): number {
  switch (estado) {
    case 'Borrador':
      return 1
    case 'EsperandoAprobacion':
      return 2
    case 'Activo':
    case 'Pausado':
      return 3
    case 'Cerrado':
      return 4
  }
}

/** Borrador → Esperando aprobación → Activo → Cerrado, con el paso actual resaltado. */
export function PasosPrograma({ estado }: { estado: EstadoPrograma }) {
  const actual = pasoActual(estado)
  return (
    <ol aria-label="Estado del programa" className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-sm">
      {PASOS.map((nombre, i) => {
        const n = i + 1
        const hecho = n < actual
        const esActual = n === actual
        return (
          <Fragment key={nombre}>
            {i > 0 && <li aria-hidden className="h-px w-5 bg-control" />}
            <li
              className={cn('flex items-center gap-1.5', esActual ? 'font-bold' : hecho ? 'text-foreground' : 'text-tenue')}
              aria-current={esActual ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-[13px]',
                  esActual ? 'bg-primary text-primary-foreground' : 'border border-control',
                )}
              >
                {hecho ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : n}
              </span>
              {nombre}
              {hecho && <span className="sr-only"> (hecho)</span>}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}

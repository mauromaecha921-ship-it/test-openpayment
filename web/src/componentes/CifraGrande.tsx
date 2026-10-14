import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Etiqueta, monto grande (36 a 40 px, nunca menos de 24 px) y texto de apoyo. `noche`: la cifra que
 * importa va en tarjeta Noche, como en el prototipo; `ambar` la pinta en ámbar (lo que sigue en la
 * cuenta, lo que puso el punto por adelantado).
 */
export function CifraGrande({
  etiqueta,
  children,
  apoyo,
  noche = false,
  ambar = false,
  className,
}: {
  etiqueta: string
  children: ReactNode
  apoyo?: ReactNode
  noche?: boolean
  ambar?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 rounded-2xl px-6 py-[22px]',
        noche ? 'bloque' : 'border border-border bg-card',
        className,
      )}
    >
      <h2 className={cn('m-0 text-base font-bold', noche ? 'text-bloque-texto' : 'text-foreground')}>{etiqueta}</h2>
      <span className={cn('cifra text-[34px] [overflow-wrap:anywhere] sm:text-[40px]', ambar && 'text-ambar')}>{children}</span>
      {apoyo && <span className={cn('text-sm', noche ? 'text-noche-tenue' : 'text-tenue')}>{apoyo}</span>}
    </section>
  )
}

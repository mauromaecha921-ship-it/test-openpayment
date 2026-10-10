import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Etiqueta, monto grande (36 a 40 px, nunca menos de 24 px) y texto de apoyo. */
export function CifraGrande({
  etiqueta,
  children,
  apoyo,
  destacada = false,
  azul = false,
  className,
}: {
  etiqueta: string
  children: ReactNode
  apoyo?: ReactNode
  destacada?: boolean
  azul?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 rounded-xl bg-card',
        destacada ? 'border-2 border-foreground px-[23px] py-[21px]' : 'border border-border px-6 py-[22px]',
        className,
      )}
    >
      <h2 className="m-0 text-base font-normal text-muted-foreground">{etiqueta}</h2>
      <span className={cn('text-[36px] leading-[1.1] font-bold [overflow-wrap:anywhere] sm:text-[40px]', azul && 'text-enlace')}>{children}</span>
      {apoyo && <span className="text-sm text-tenue">{apoyo}</span>}
    </section>
  )
}

import { cn } from '@/lib/utils'

const PASOS = ['Cédula', 'Pago', 'PIN', 'Resultado'] as const

export type PasoPunto = (typeof PASOS)[number]

/** Cédula · Pago · PIN · Resultado: dónde va el cobro en el punto, como en el prototipo. */
export function PasosCobroPunto({ paso }: { paso: PasoPunto }) {
  const actual = PASOS.indexOf(paso)
  return (
    <ol aria-label="Pasos del cobro" className="m-0 flex list-none gap-1.5 p-0 text-[13px] text-muted-foreground">
      {PASOS.map((texto, i) => (
        <li
          key={texto}
          aria-current={i === actual ? 'step' : undefined}
          className={cn('flex-1 border-t-4 pt-1.5', i <= actual ? 'border-foreground' : 'border-border', i === actual && 'font-bold text-foreground')}
        >
          {texto}
        </li>
      ))}
    </ol>
  )
}

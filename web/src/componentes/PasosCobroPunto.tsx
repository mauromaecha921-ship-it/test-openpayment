import { cn } from '@/lib/utils'

const PASOS = ['Cédula', 'Pago', 'PIN', 'Resultado'] as const

export type PasoPunto = (typeof PASOS)[number]

/** Cédula · Pago · PIN · Resultado: barra de pasos estilizada según los wireframes del punto de retiro. */
export function PasosCobroPunto({ paso }: { paso: PasoPunto }) {
  const actual = PASOS.indexOf(paso)
  return (
    <nav aria-label="Pasos del cobro" className="w-full">
      <ol className="m-0 flex list-none items-start gap-2 p-0">
        {PASOS.map((texto, i) => {
          const esActivo = i === actual
          const esPasado = i < actual
          return (
            <li
              key={texto}
              aria-current={esActivo ? 'step' : undefined}
              className="flex flex-1 flex-col gap-1.5"
            >
              <div
                className={cn(
                  'h-[3px] w-full rounded-full transition-all duration-300',
                  esActivo || esPasado ? 'bg-foreground' : 'bg-[#e2d8c4] dark:bg-[#2c3b5c]',
                )}
              />
              <span
                className={cn(
                  'text-[13px] leading-tight',
                  esActivo
                    ? 'font-bold text-foreground'
                    : esPasado
                      ? 'font-medium text-foreground/80'
                      : 'text-muted-foreground',
                )}
              >
                {texto}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

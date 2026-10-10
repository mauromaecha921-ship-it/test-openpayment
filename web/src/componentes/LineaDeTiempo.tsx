import type { EventoCobro } from '@/api/tipos'
import { formatHora, NOMBRE_ESTADO_COBRO } from '@/lib/textos'
import { cn } from '@/lib/utils'

/** Cada transición del cobro, en orden, con hora (hh:mm:ss) y texto (wireframe 05). */
export function LineaDeTiempo({ eventos }: { eventos: EventoCobro[] }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {eventos.map((ev, i) => {
        const ultimo = i === eventos.length - 1
        const titulo = ev.desde ? `${NOMBRE_ESTADO_COBRO[ev.desde]} → ${NOMBRE_ESTADO_COBRO[ev.hacia]}` : NOMBRE_ESTADO_COBRO[ev.hacia]
        return (
          <li key={i} className="flex gap-4">
            <div aria-hidden className="flex flex-col items-center">
              <span className={cn('size-3.5 shrink-0 rounded-full border-2 border-foreground', ultimo ? 'bg-foreground' : 'bg-background')} />
              {!ultimo && <span className="w-0.5 flex-1 bg-border" />}
            </div>
            <div className={cn('flex flex-1 flex-col gap-1', !ultimo && 'pb-[22px]')}>
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{titulo}</strong>
                <time dateTime={ev.creado} className="text-sm text-tenue">
                  {formatHora(ev.creado)}
                </time>
              </div>
              <span className="text-[15px] text-muted-foreground">{ev.texto}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

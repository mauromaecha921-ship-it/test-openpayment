import { Check, Hand } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import type { Cobro } from '@/api/tipos'

import { PasosDelPago } from './PasosDelPago'
import { llegaRodando, marcarPagando, TatuEnrolla } from './TatuEnrolla'

/** Segundos que lleva el cobro en Pagando, contados desde `desde` (ISO). */
function useSegundosDesde(desde: string | null) {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!desde) return
    const calcular = () => setS(Math.max(0, (Date.now() - Date.parse(desde)) / 1000))
    calcular()
    const t = setInterval(calcular, 500)
    return () => clearInterval(t)
  }, [desde])
  return s
}

/**
 * «Pagando…» del prototipo: en el punto (P4) con «✓ PIN confirmado» y el aviso de no entregar el
 * efectivo; en la cuenta (B5) con los pasos. En una tarjeta del tema (clara u oscura según el modo). La barra de carga es el tatú: de pie se enrolla y rueda
 * mientras se paga, y la pantalla del resultado termina su animación (TatuResultado). Pasados 10 s
 * avisa que tarda más de lo normal (P-18, RNF-02).
 */
export function EsperaPagando({
  desde,
  paraPunto,
  cobro,
  children,
}: {
  desde: string | null
  paraPunto: boolean
  cobro: Pick<Cobro, 'id' | 'canal' | 'estado' | 'segundosHastaPagado'>
  /** «Estamos pagando $230.000 desde la cuenta del programa a…». */
  children?: ReactNode
}) {
  const segundos = useSegundosDesde(desde)
  const tarda = segundos > 10
  // Si se vio rodando mientras se pedía el pago, sigue rodando (no vuelve a pararse); y el resultado
  // de este cobro llega con el tatú rodando
  const [inicio] = useState<'rodando' | 'de-pie'>(() => (llegaRodando(cobro.id) ? 'rodando' : 'de-pie'))
  useEffect(() => marcarPagando(cobro.id), [cobro.id])

  return (
    <>
      <div className="mt-1.5 flex flex-col gap-4 rounded-[22px] border-[1.5px] border-border bg-card px-5 py-[22px]">
        <div className="flex min-w-0 flex-col gap-4">
          {paraPunto && (
            <span className="inline-flex items-center gap-2 text-base font-semibold">
              <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
              PIN confirmado
            </span>
          )}
          <p className="cifra m-0 text-[36px]">Pagando…</p>
        </div>
        <TatuEnrolla estado="pagando" inicio={inicio} className="w-44 self-center" />
        {children && <p className="m-0 text-[17px] leading-[1.4]">{children}</p>}
        {paraPunto ? <span className="text-[15px] text-muted-foreground">Suele tardar unos segundos.</span> : <PasosDelPago cobro={cobro} />}
      </div>

      {paraPunto && (
        <div role="status" className="flex items-center gap-3 rounded-[18px] border-[2.5px] border-foreground bg-card p-4">
          <Hand aria-hidden className="size-7 flex-none" strokeWidth={2} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[21px] font-extrabold">No entregues efectivo todavía</span>
            <span className="text-[15px] text-muted-foreground">Espera a que la pantalla diga Pagado.</span>
          </div>
        </div>
      )}

      {tarda && (
        <p role="alert" className="m-0 rounded-[14px] bg-pagando-fondo px-4 py-3 text-base font-semibold text-pagando">
          Está tardando más de lo normal.{paraPunto ? ' No entregues el efectivo todavía.' : ' Seguimos esperando la confirmación del banco.'}
        </p>
      )}
    </>
  )
}

/**
 * Mientras se pide el pago a la cuenta (unos segundos): el tatú de los pagos ya rueda. Después, la
 * pantalla del cobro sigue rodando si quedó en curso, o termina en el logo rojo si se rechazó.
 */
export function PidiendoPago() {
  return (
    <div role="status" className="flex flex-col gap-4 rounded-[22px] border-[1.5px] border-border bg-card px-5 py-[22px]">
      <p className="cifra m-0 text-[30px]">Pidiendo el pago…</p>
      <TatuEnrolla estado="pagando" className="w-44 self-center" />
      <span className="text-[15px] text-muted-foreground">Suele tardar unos segundos.</span>
    </div>
  )
}

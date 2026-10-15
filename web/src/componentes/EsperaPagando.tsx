import { Hand } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import type { Cobro } from '@/api/tipos'

import { Bloque } from './Comun'
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
 * «Pagando…» en el bloque Noche del prototipo, con el tatú de los pagos (TatuEnrolla: de pie, se
 * enrolla y rueda; la pantalla del resultado termina su animación) y los pasos del pago. Pasados 10 s, avisa que tarda más de lo normal (P-18, RNF-02). En el punto, debajo,
 * siempre recuerda que no se entrega el efectivo todavía.
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
  /** Qué se está pagando y a dónde («Estamos pagando $230.000 a…»). */
  children?: ReactNode
}) {
  const segundos = useSegundosDesde(desde)
  const tarda = segundos > 10
  // Si se vio rodando mientras se pedía el pago, sigue rodando; y el resultado llega rodando
  const [inicio] = useState<'rodando' | 'de-pie'>(() => (llegaRodando(cobro.id) ? 'rodando' : 'de-pie'))
  useEffect(() => marcarPagando(cobro.id), [cobro.id])

  return (
    <>
      <Bloque tono="noche" className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="titular m-0 text-[34px] sm:text-[40px]">Pagando…</p>
            {children && <p className="m-0 text-[17px] leading-snug">{children}</p>}
          </div>
          <TatuEnrolla estado="pagando" inicio={inicio} sobreColor className="w-28 shrink-0 sm:w-32" />
        </div>
        <PasosDelPago cobro={cobro} />
        <p className="m-0 border-t border-noche-suave pt-3 text-[15px] text-noche-tenue">Suele tardar unos segundos.</p>
      </Bloque>

      {paraPunto && (
        <p className="m-0 flex items-center gap-3.5 rounded-2xl border-2 border-foreground bg-card px-4 py-3.5">
          <Hand aria-hidden className="size-7 shrink-0" />
          <span className="flex flex-col">
            <strong className="titular text-xl">No entregues efectivo todavía</strong>
            <span className="text-[15px] text-muted-foreground">Espera a que la pantalla diga «Pagado».</span>
          </span>
        </p>
      )}

      {tarda && (
        <p role="alert" className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 text-base text-pagando">
          Está tardando más de lo normal.{paraPunto ? ' No entregues el efectivo todavía.' : ' Seguimos esperando la confirmación del banco.'}
        </p>
      )}
    </>
  )
}

/**
 * Mientras se pide el pago (unos segundos): el tatú de los pagos ya rueda. Después, la pantalla del
 * cobro sigue rodando si quedó en curso, o termina enrollado en rojo si se rechazó.
 */
export function PidiendoPago() {
  return (
    <Bloque tono="noche" role="status" className="gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="titular m-0 text-[30px] sm:text-[34px]">Pidiendo el pago…</p>
        <TatuEnrolla estado="pagando" sobreColor className="w-28 shrink-0 sm:w-32" />
      </div>
      <p className="m-0 border-t border-noche-suave pt-3 text-[15px] text-noche-tenue">Suele tardar unos segundos.</p>
    </Bloque>
  )
}

import { useEffect, useState } from 'react'

import { TatuAnimado } from './TatuAnimado'

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
 * «Pagando…», con el tatú rodando y la cerradura latiendo (variante B de /demo/tatu). Pasados 10 s, avisa que tarda más de lo normal (P-18, RNF-02). En el punto, siempre
 * recuerda que no se entrega el efectivo todavía.
 */
export function EsperaPagando({ desde, paraPunto }: { desde: string | null; paraPunto: boolean }) {
  const segundos = useSegundosDesde(desde)
  const tarda = segundos > 10

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <TatuAnimado estado="pagando" variante="cerradura" className="size-28" />
      <p className="m-0 text-[28px] leading-tight font-bold">Pagando…</p>
      {paraPunto && <p className="m-0 text-lg font-bold">No entregues el efectivo todavía.</p>}
      {tarda && (
        <p role="alert" className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 text-base text-pagando">
          Está tardando más de lo normal.{paraPunto ? ' No entregues el efectivo todavía.' : ' Seguimos esperando la confirmación del banco.'}
        </p>
      )}
    </div>
  )
}

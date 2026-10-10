import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

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
 * «Pagando…». Pasados 10 s, avisa que tarda más de lo normal (P-18, RNF-02). En el punto, siempre
 * recuerda que no se entrega el efectivo todavía.
 */
export function EsperaPagando({ desde, paraPunto }: { desde: string | null; paraPunto: boolean }) {
  const segundos = useSegundosDesde(desde)
  const tarda = segundos > 10

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-24 items-center justify-center rounded-full border-4 border-pagando bg-pagando-fondo text-pagando">
        <LoaderCircle aria-hidden className="size-12 animate-spin motion-reduce:animate-none" strokeWidth={2.5} />
      </span>
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

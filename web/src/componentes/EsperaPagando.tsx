import { Check, Hand } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import type { Cobro } from '@/api/tipos'

import { PasosDelPago } from './PasosDelPago'
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
 * «Pagando…» del prototipo: en el punto (P4) con «✓ PIN confirmado», la barra ámbar y el aviso de no
 * entregar el efectivo; en la cuenta (B5) con los pasos. Lleva el tatú rodando (las esperas son
 * suyas). Pasados 10 s avisa que tarda más de lo normal (P-18, RNF-02).
 */
export function EsperaPagando({
  desde,
  paraPunto,
  cobro,
  children,
}: {
  desde: string | null
  paraPunto: boolean
  cobro: Pick<Cobro, 'canal' | 'estado' | 'segundosHastaPagado'>
  /** «Estamos pagando $230.000 desde la cuenta del programa a…». */
  children?: ReactNode
}) {
  const segundos = useSegundosDesde(desde)
  const tarda = segundos > 10
  // La barra avanza con el tiempo hasta el 90 %: suele tardar unos 5 s
  const avance = Math.min(90, 15 + (segundos / 6) * 75)

  return (
    <>
      <div className="bloque mt-1.5 flex flex-col gap-4 rounded-[22px] px-5 py-[22px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-4">
            {paraPunto && (
              <span className="inline-flex items-center gap-2 text-base font-semibold">
                <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
                PIN confirmado
              </span>
            )}
            <p className="cifra m-0 text-[36px]">Pagando…</p>
          </div>
          <TatuAnimado estado="pagando" variante="cerradura" sobreOscuro className="size-16 flex-none" />
        </div>
        {children && <p className="m-0 text-[17px] leading-[1.4]">{children}</p>}
        {paraPunto ? (
          <>
            <div aria-hidden className="h-2 overflow-hidden rounded-lg bg-pista-bloque">
              <div className="h-2 rounded-lg bg-ambar transition-[width] duration-500" style={{ width: `${avance}%` }} />
            </div>
            <span className="text-[15px] text-noche-tenue">Suele tardar unos segundos.</span>
          </>
        ) : (
          <PasosDelPago cobro={cobro} />
        )}
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

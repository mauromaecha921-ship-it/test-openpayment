import { Check, LoaderCircle } from 'lucide-react'

import type { CobroResumen } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga, ListaDatos } from '@/componentes/Comun'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { formatFechaHora } from '@/lib/textos'

import { useResumen } from './useResumen'

/** «Tu subsidio ya fue cobrado» con cuánto, cuándo, dónde y la referencia (wireframe 13). */
export function TarjetaCobrado({ cobro: c }: { cobro: CobroResumen }) {
  const pagado = c.estado === 'Pagado'
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border-2 border-foreground p-5">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {pagado ? <Check className="size-5" strokeWidth={3} /> : <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />}
        </span>
        <h2 className="m-0 text-xl font-bold">{pagado ? 'Tu subsidio ya fue cobrado' : 'Tu cobro se está pagando'}</h2>
      </div>
      <ListaDatos
        filas={[
          ['Cuánto', <strong key="m">{textoMonto(c.monto, c.moneda)}</strong>],
          ['Cuándo', formatFechaHora(c.actualizado)],
          [
            'Dónde',
            c.canal === 'cuenta' ? (
              <span key="d">
                A tu cuenta {c.cuenta && <BilleteraCorta url={c.cuenta.billetera} />}
              </span>
            ) : (
              (c.punto?.nombre ?? 'En un punto')
            ),
          ],
          ['Referencia', <span key="r" className="mono">{c.referencia}</span>],
        ]}
      />
      <span className="text-[15px] text-muted-foreground">{c.programa.nombre}</span>
    </section>
  )
}

export default function Historial() {
  const { datos: r, error, recargar } = useResumen()
  return (
    <MarcoBeneficiario>
      <Titulo className="text-[26px] md:text-[32px]">Historial</Titulo>
      {!r && error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!r && !error && <Cargando />}
      {r && (r.ultimoCobro ? <TarjetaCobrado cobro={r.ultimoCobro} /> : <p className="m-0 text-muted-foreground">Todavía no has cobrado ningún subsidio.</p>)}
      <p className="m-0 text-muted-foreground">Cuando tengas un pago nuevo, lo verás en Inicio.</p>
    </MarcoBeneficiario>
  )
}

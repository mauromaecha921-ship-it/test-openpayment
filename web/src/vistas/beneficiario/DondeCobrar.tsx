import { Clock, Store } from 'lucide-react'

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { ErrorCarga, Volver } from '@/componentes/Comun'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { formatFecha } from '@/lib/textos'

import { useResumen } from './useResumen'

export default function DondeCobrar() {
  const { datos: r } = useResumen()
  const puntos = usePolling(() => api.get<Punto[]>('/puntos'), null, false)
  // Con varios subsidios, el punto pregunta cuál pagar: aquí no se muestra un monto fijo
  const unico = r?.pagos.length === 1 ? r.pago : null
  const monto = unico ? textoMonto(unico.monto, unico.moneda) : null

  return (
    <MarcoBeneficiario ancho="ancho">
      <Volver to="/beneficiario">Volver</Volver>
      <Titulo className="text-[26px] md:text-[32px]">Cobra en un punto</Titulo>

      {/* En PC: los pasos a la izquierda y los puntos a la derecha. */}
      <div className="grid items-start gap-[18px] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
      <div className="flex min-w-0 flex-col gap-[18px]">
      <section aria-labelledby="titulo-como" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <h2 id="titulo-como" className="m-0 text-lg font-bold">Así cobras</h2>
      <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[17px]">
        {['Lleva tu cédula original.', (r?.pagos.length ?? 0) > 1 ? 'En el punto digitan tu número y eliges cuál de tus subsidios cobrar.' : 'En el punto digitan tu número.', `Confirmas con tu PIN y recibes ${monto ?? 'tu subsidio'} en efectivo.`].map((t, i, todos) => (
          <li key={i} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${i === todos.length - 1 ? 'bg-ambar text-noche' : 'bg-foreground text-background'}`}
            >
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
      </section>
      {unico && (
        <p className="m-0 flex items-center gap-2">
          <Clock aria-hidden className="size-[18px] shrink-0" />
          Puedes cobrar hasta el {formatFecha(unico.vigenciaFin)}.
        </p>
      )}
      </div>

      <section className="flex min-w-0 flex-col gap-[18px]" aria-labelledby="titulo-puntos">
      <h2 id="titulo-puntos" className="mt-1.5 mb-0 text-xl font-bold md:mt-0">Puntos cerca</h2>
      {puntos.error && <ErrorCarga mensaje={puntos.error} reintentar={() => void puntos.recargar()} />}
      {puntos.datos?.map((p) => (
        <article key={p.id} className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ambar text-noche">
            <Store className="size-[22px]" />
          </span>
          <div className="flex flex-col gap-1">
            <strong className="text-lg">{p.nombre}</strong>
            {p.direccion && <span className="text-muted-foreground">{p.direccion}</span>}
            <span className="text-[15px] text-muted-foreground">Entrega el valor completo{monto ? `: ${monto}` : ''}</span>
          </div>
        </article>
      ))}
      {puntos.datos?.length === 0 && <p className="m-0 text-muted-foreground">Todavía no hay puntos registrados.</p>}
      </section>
      </div>
    </MarcoBeneficiario>
  )
}

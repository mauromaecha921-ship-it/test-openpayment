import { Store } from 'lucide-react'

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { ErrorCarga } from '@/componentes/Comun'
import { textoMonto } from '@/componentes/Monto'
import { CabeceraCelular, NumeroCirculo, PantallaCelular } from '@/componentes/Proto'
import { formatDiaMes } from '@/lib/textos'

import { useResumen } from './useResumen'

/** Prototipo B7 «Cobrar en un punto»: los pasos y los puntos de retiro. */
export default function DondeCobrar() {
  const { datos: r } = useResumen()
  const puntos = usePolling(async () => (await api.get<Punto[]>('/puntos')).filter((p) => p.tipo !== 'compra'), null)
  // Con varios subsidios, el punto pregunta cuál pagar: aquí no se muestra un monto fijo
  const unico = r?.pagos.length === 1 ? r.pago : null
  const monto = unico ? textoMonto(unico.monto, unico.moneda) : null
  const pasos = [
    'Lleva tu cédula original.',
    (r?.pagos.length ?? 0) > 1 ? 'El cajero digita tu número y eliges qué subsidio cobrar.' : 'El cajero digita tu número.',
    'Confirmas con tu PIN y recibes el efectivo.',
  ]

  return (
    <PantallaCelular>
      <CabeceraCelular
        volver={unico ? `/beneficiario/subsidio/${unico.programa.id}` : '/beneficiario'}
        etiquetaVolver="Volver al subsidio"
        titulo="Cobrar en un punto"
        subtitulo={unico ? `${unico.programa.nombre} · ${monto}` : undefined}
      />
      <h1 className="sr-only">Cobrar en un punto</h1>
      <section aria-labelledby="titulo-como" className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-border bg-card p-4">
        <h2 id="titulo-como" className="m-0 text-lg font-extrabold">
          Así cobras
        </h2>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {pasos.map((t, i) => (
            <li key={i} className="flex items-center gap-3 text-base">
              <NumeroCirculo n={i + 1} tono={i === pasos.length - 1 ? 'ambar' : 'noche'} />
              {t}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="titulo-puntos" className="flex flex-col">
        <h2 id="titulo-puntos" className="m-0 mb-1.5 text-[17px] font-extrabold">
          Puntos de retiro
        </h2>
        {puntos.error && <ErrorCarga mensaje={puntos.error} reintentar={() => void puntos.recargar()} />}
        {puntos.datos?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-t border-border py-3.5">
            <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-xl bg-ambar text-noche">
              <Store className="size-[22px]" strokeWidth={2} />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[17px] font-bold">{p.nombre.split(' — ')[0]}</span>
              {p.direccion && <span className="text-[15px] text-muted-foreground">{p.direccion}</span>}
            </div>
          </div>
        ))}
        {puntos.datos?.length === 0 && <p className="m-0 border-t border-border py-3.5 text-muted-foreground">Todavía no hay puntos registrados.</p>}
      </section>

      <p className="m-0 mt-auto text-[15px] leading-[1.45] text-muted-foreground">
        Te entregan el valor completo{monto ? `: ${monto}` : ''}.{unico ? ` Cóbralo antes del ${formatDiaMes(unico.vigenciaFin)}.` : ''}
      </p>
    </PantallaCelular>
  )
}

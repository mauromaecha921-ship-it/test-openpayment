import { ChevronRight, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { api } from '@/api/client'
import type { CajaPunto, CobroResumen, PeriodoCaja } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { CifraGrande } from '@/componentes/CifraGrande'
import { Cargando, CargandoEnLinea, ErrorCarga } from '@/componentes/Comun'
import { EstadoCobro } from '@/componentes/EstadoCobro'
import { MarcoPunto } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { useRol } from '@/contexto/Rol'
import { formatFechaHora, formatSegundos, plural } from '@/lib/textos'
import { cn } from '@/lib/utils'

const PERIODOS: Array<[PeriodoCaja, string]> = [
  ['hoy', 'Hoy'],
  ['7d', 'Últimos 7 días'],
  ['todo', 'Todo'],
]

type Filtro = 'todos' | 'pagados' | 'rechazados'
const FILTROS: Array<[Filtro, string]> = [
  ['todos', 'Todos'],
  ['pagados', 'Pagados'],
  ['rechazados', 'Rechazados y fallidos'],
]

function Botonera<T extends string>({ opciones, valor, cambiar, etiqueta }: { opciones: Array<[T, string]>; valor: T; cambiar: (v: T) => void; etiqueta: string }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          onClick={() => cambiar(v)}
          className={cn('min-h-10 rounded-lg px-3.5 text-[15px]', valor === v ? 'bg-background font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

/**
 * D-36 · Mi caja: cuánto efectivo entregó el punto, cuánto le reembolsaron (todo, porque solo se
 * entrega al ver «Pagado») y en cuánto tiempo, más el historial con filtros. Se actualiza cada 5 s.
 */
export default function MiCaja() {
  const { puntoId } = useRol()
  const [periodo, setPeriodo] = useState<PeriodoCaja>('hoy')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const caja = usePolling(() => api.get<CajaPunto>(`/puntos/${puntoId}/resumen?desde=${periodo}`), 5000, true, { clave: `${puntoId}-${periodo}` })
  const lista = usePolling(() => api.get<CobroResumen[]>(`/puntos/${puntoId}/cobros?desde=${periodo}`), 5000, true, { clave: `${puntoId}-${periodo}` })

  const c = caja.datos
  const total = c?.totales[0]
  // § 11: una sede de comercio no entrega efectivo; recibe el pago de los bonos
  const comercio = c?.punto.tipo === 'compra'
  const cobros = (lista.datos ?? []).filter((x) =>
    filtro === 'pagados' ? x.estado === 'Pagado' : filtro === 'rechazados' ? x.estado === 'Rechazado' || x.estado === 'Fallido' : true,
  )

  return (
    <MarcoPunto ancho="ancho">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Titulo className="text-[28px] md:text-[32px]">Mi caja</Titulo>
        <Botonera opciones={PERIODOS} valor={periodo} cambiar={setPeriodo} etiqueta="Periodo" />
      </div>

      {!c && caja.error && <ErrorCarga mensaje={caja.error} reintentar={() => void caja.recargar()} />}
      {!c && !caja.error && <Cargando />}

      {c && (
        <>
          <div className="flex flex-wrap gap-4">
            <CifraGrande
              etiqueta={comercio ? 'Vendiste con bonos' : 'Entregaste en efectivo'}
              apoyo={comercio ? plural(c.cobros.pagados, 'compra con bono', 'compras con bono') : plural(c.cobros.pagados, 'retiro pagado', 'retiros pagados')}
            >
              {total ? textoMonto(total.entregado, total.moneda) : '$0'}
            </CifraGrande>
            <CifraGrande
              etiqueta={comercio ? 'Te pagaron los bonos' : 'Te reembolsaron'}
              noche
              apoyo={
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck aria-hidden className="size-4" />
                  {comercio ? 'Cada bono ya está en tu wallet' : 'Todo lo que entregaste ya está en tu wallet'}
                </span>
              }
            >
              {total ? textoMonto(total.reembolsado, total.moneda) : '$0'}
            </CifraGrande>
            {!comercio && (
              <CifraGrande etiqueta="Pusiste por adelantado" apoyo="Nunca giras plata antes de que te paguen" noche ambar>
                {total ? textoMonto(c.giradoPorAdelantado, total.moneda) : '$0'}
              </CifraGrande>
            )}
          </div>

          {total && total.pendiente !== '0' && (
            <p role="status" className="m-0 flex items-start gap-2 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 font-bold text-pagando">
              <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              {textoMonto(total.pendiente, total.moneda)} en camino a tu wallet: no entregues {comercio ? 'esa compra' : 'ese efectivo'} hasta ver «Pagado».
            </p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="size-4" />
              {c.reembolsoSegundos === null ? 'Todavía no hay reembolsos en este periodo' : `Reembolso en promedio: ${formatSegundos(c.reembolsoSegundos)} después del PIN`}
            </span>
            <span>
              {plural(c.cobros.rechazados, 'rechazado')} · {plural(c.cobros.enCurso, 'en curso', 'en curso')}
            </span>
            <span>
              Tu wallet: <BilleteraCorta url={c.punto.billetera} />
            </span>
          </div>
        </>
      )}

      <section aria-labelledby="titulo-historial" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-historial" className="m-0 text-xl font-bold">
            Historial
          </h2>
          <Botonera opciones={FILTROS} valor={filtro} cambiar={setFiltro} etiqueta="Filtrar por estado" />
        </div>
        <p className="m-0 text-sm text-tenue">Cada pago aparece en tu Test Wallet con su referencia (SUB-…).</p>
        {lista.error && !lista.datos && <ErrorCarga mensaje={lista.error} reintentar={() => void lista.recargar()} />}
        {cobros.length ? (
          <ul className="m-0 grid list-none gap-2 p-0 lg:grid-cols-2">
            {cobros.map((x) => (
              <li key={x.id}>
                <Link
                  to={`/punto/cobros/${x.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-foreground no-underline hover:bg-muted hover:text-foreground"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <strong>{x.persona.nombre ?? x.persona.etiqueta}</strong>
                      {x.monto && <span className="text-muted-foreground">{textoMonto(x.monto, x.moneda)}</span>}
                      <span className="mono text-sm text-tenue">{x.referencia}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <EstadoCobro estado={x.estado} motivo={x.motivo} />
                      <time dateTime={x.creado} className="text-sm text-tenue">
                        {formatFechaHora(x.creado)}
                      </time>
                    </span>
                    <span className="text-sm text-tenue">{x.programa.nombre}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border px-4 py-5 text-center text-tenue">
            {lista.datos ? 'No hay cobros en este periodo.' : <CargandoEnLinea />}
          </div>
        )}
      </section>
    </MarcoPunto>
  )
}

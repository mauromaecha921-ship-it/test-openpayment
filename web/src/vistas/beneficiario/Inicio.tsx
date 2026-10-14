import { ChevronRight, Clock, Wallet } from 'lucide-react'
import { Link } from 'react-router'

import { api } from '@/api/client'
import type { PagoPendiente, Programa } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { CuentaDestino } from '@/componentes/CuentaDestino'
import { textoMonto } from '@/componentes/Monto'
import { CabeceraCelular, Chip, ChipCobro, PantallaCelular } from '@/componentes/Proto'
import { formatDiaMes, formatFechaHora } from '@/lib/textos'
import { cn } from '@/lib/utils'

import { useResumen } from './useResumen'

/** El bono con destino no se cobra: se usa en un comercio (§ 11, fuera del prototipo). */
function rutaDelPago(p: PagoPendiente) {
  return p.programa.tipo === 'bono' ? `/beneficiario/bono/${p.programa.id}` : `/beneficiario/subsidio/${p.programa.id}`
}

/** Prototipo B0 «Mis subsidios»: lo que tiene por cobrar, su cuenta y lo ya cobrado. */
export default function Inicio() {
  const { datos: r, error, recargar } = useResumen()
  // La entidad de cada programa (el resumen solo trae el nombre del programa)
  const programas = usePolling(() => api.get<Programa[]>('/programas'), null)
  const entidad = (id: string) => programas.datos?.find((p) => p.id === id)?.entidad

  return (
    <PantallaCelular className="gap-3.5">
      <CabeceraCelular volver="/" etiquetaVolver="Volver a elegir rol" marca />
      {!r && error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!r && !error && <Cargando />}
      {r && (
        <>
          <div className="-mt-1.5 text-[15px] text-muted-foreground">Hola, {r.persona.nombre}</div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px]">Tienes por cobrar</span>
            <h1 className="cifra m-0 text-[30px]">{r.pagos.length === 1 ? '1 subsidio' : `${r.pagos.length} subsidios`}</h1>
          </div>

          {r.pagos.map((p, i) => {
            const primero = i === 0
            return (
              <Link
                key={p.programa.id}
                to={rutaDelPago(p)}
                className={cn(
                  'flex flex-col gap-1.5 rounded-[20px] border-[1.5px] p-[18px] no-underline',
                  primero ? 'bloque border-bloque text-bloque-texto hover:text-bloque-texto' : 'border-border bg-card text-foreground hover:text-foreground',
                )}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[17px] font-bold">{p.programa.nombre}</span>
                  <ChevronRight aria-hidden className="size-[22px] flex-none" strokeWidth={2.4} />
                </div>
                {entidad(p.programa.id) && <span className="text-[15px] opacity-85">{entidad(p.programa.id)}</span>}
                <span className="cifra mt-0.5 text-[40px] [overflow-wrap:anywhere]">{textoMonto(p.monto, p.moneda)}</span>
                {p.programa.estado === 'Pausado' ? (
                  <Chip tono="pagando" className="mt-0.5">
                    La entidad pausó los cobros por un momento
                  </Chip>
                ) : (
                  <span className={cn('inline-flex items-center gap-1.5 text-[15px]', primero ? 'text-ambar' : 'text-muted-foreground')}>
                    <Clock aria-hidden className="size-4" strokeWidth={2} />
                    {p.programa.tipo === 'bono' ? 'Úsalo antes del' : 'Cóbralo antes del'} {formatDiaMes(p.vigenciaFin)}
                  </span>
                )}
              </Link>
            )
          })}

          <Link to="/beneficiario/cuenta" className="flex min-h-14 items-center gap-3 rounded-[14px] bg-muted px-3.5 py-2 text-foreground no-underline hover:text-foreground">
            <Wallet aria-hidden className="size-[22px] flex-none" strokeWidth={2} />
            <span className="flex-1 text-base">
              {r.cuenta?.estado === 'Verificada' ? (
                <>
                  <b>
                    Tu cuenta <CuentaDestino cuenta={r.cuenta} />
                  </b>{' '}
                  · verificada
                </>
              ) : r.cuenta?.estado === 'PorVerificar' ? (
                <>
                  <b>Tu cuenta</b> · por verificar en tu billetera
                </>
              ) : (
                <>
                  <b>Enlaza tu cuenta</b> · o cobra con tu cédula como llave Bre-B
                </>
              )}
            </span>
            <ChevronRight aria-hidden className="size-5 flex-none" strokeWidth={2} />
          </Link>

          <section aria-labelledby="titulo-cobrados" className="mt-auto flex flex-col">
            <h2 id="titulo-cobrados" className="m-0 text-[17px] font-extrabold">
              Ya cobrados
            </h2>
            {r.ultimoCobro ? (
              <Link
                to={`/beneficiario/cobros/${r.ultimoCobro.id}`}
                className="mt-2 flex items-center gap-3 border-t border-border py-3 text-foreground no-underline hover:text-foreground"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-base font-bold">{r.ultimoCobro.programa.nombre}</span>
                  <span className="text-sm text-muted-foreground">
                    {r.ultimoCobro.referencia} · {formatFechaHora(r.ultimoCobro.actualizado)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-base font-bold">{textoMonto(r.ultimoCobro.monto, r.ultimoCobro.moneda)}</span>
                  <ChipCobro estado={r.ultimoCobro.estado} />
                </span>
              </Link>
            ) : (
              <div className="mt-2 rounded-[14px] border-[1.5px] border-dashed border-border p-3.5 text-center text-[15px] text-muted-foreground">
                Aquí verás los subsidios que cobres, con su referencia.
              </div>
            )}
            <Link to="/beneficiario/historial" className="mt-2 self-start text-[15px] font-semibold text-azul">
              Ver mi historial
            </Link>
          </section>
        </>
      )}
    </PantallaCelular>
  )
}

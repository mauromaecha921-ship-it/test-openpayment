import { ShoppingBag } from 'lucide-react'
import { useParams } from 'react-router'

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, ErrorCarga, Volver } from '@/componentes/Comun'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { formatFecha } from '@/lib/textos'

import { useResumen } from './useResumen'

/**
 * § 11 · Dónde usar un bono con destino: las sedes de comercios verificados de las categorías que
 * acepta. La persona paga su compra con el bono, con su cédula y su PIN, y el resto por fuera.
 */
export default function DondeUsarBono() {
  const { programaId } = useParams()
  const { datos: r } = useResumen()
  const sedes = usePolling(() => api.get<Punto[]>(`/programas/${programaId}/comercios`), null, false, { clave: programaId })
  const pago = r?.pagos.find((p) => p.programa.id === programaId)
  const valor = pago ? textoMonto(pago.monto, pago.moneda) : 'tu bono'

  const pasos = [
    'Ve a un comercio de la lista y haz tu compra.',
    'En la caja di que vas a pagar con tu bono y entrega tu cédula.',
    `Confirma con tu PIN: el bono cubre hasta ${valor} y el resto lo pagas como siempre.`,
  ]

  return (
    <MarcoBeneficiario ancho="ancho">
      <Volver to="/beneficiario">Volver</Volver>
      <Titulo className="text-[26px] md:text-[32px]">Dónde usar tu bono</Titulo>

      <div className="grid items-start gap-[18px] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {pago && (
            <section className="flex flex-col gap-1 rounded-2xl border-2 border-foreground p-5">
              <span className="text-lg">Tu bono</span>
              <span className="text-[40px] leading-[1.05] font-bold">{valor}</span>
              <span className="text-[15px] text-muted-foreground">{pago.programa.nombre}</span>
              <span className="text-[15px]">Úsalo hasta el {formatFecha(pago.vigenciaFin)}, en una sola compra. No se entrega en efectivo.</span>
            </section>
          )}
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[17px]">
            {pasos.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-[15px] font-bold">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          {r && !r.persona.tienePin && (
            <p className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 text-pagando">
              Para usar el bono necesitas un PIN. Pídelo a quien te registró.
            </p>
          )}
        </div>

        <section className="flex min-w-0 flex-col gap-[18px]" aria-labelledby="titulo-comercios">
          <h2 id="titulo-comercios" className="m-0 text-xl font-bold">
            Comercios que lo aceptan
          </h2>
          {sedes.error && <ErrorCarga mensaje={sedes.error} reintentar={() => void sedes.recargar()} />}
          {!sedes.datos && !sedes.error && <Cargando />}
          {sedes.datos?.length === 0 && <p className="m-0 text-muted-foreground">Todavía no hay comercios verificados que acepten este bono.</p>}
          {sedes.datos?.map((s) => (
            <article key={s.id} className="flex items-start gap-3.5 rounded-[14px] border border-control p-4">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <ShoppingBag className="size-[22px]" />
              </span>
              <div className="flex flex-col gap-1">
                <strong className="text-lg">{s.nombre}</strong>
                {s.direccion && <span className="text-muted-foreground">{s.direccion}</span>}
                {s.comercio && (
                  <span className="text-[15px] text-muted-foreground">
                    {s.comercio.razonSocial} · {s.comercio.categoriaNombre}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </MarcoBeneficiario>
  )
}

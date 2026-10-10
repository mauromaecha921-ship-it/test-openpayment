import { Check } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { api } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Cobro, EventoCobro } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga, ListaDatos } from '@/componentes/Comun'
import { EsperaPagando } from '@/componentes/EsperaPagando'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { PasosDelPago } from '@/componentes/PasosDelPago'
import { TarjetaRechazo } from '@/componentes/TarjetaRechazo'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { esEstadoFinal } from '@/lib/pantallas'
import { formatFechaHora } from '@/lib/textos'

export function inicioPagando(eventos: EventoCobro[]): string | null {
  return eventos.find((e) => e.hacia === 'Pagando')?.creado ?? null
}

/** Wireframe 11: se consulta cada POLL_INTERVALO_MS hasta Pagado, Fallido o Rechazado. */
export default function CobroPagado() {
  const { id = '' } = useParams()
  const config = useConfig()
  const consulta = usePolling(() => api.get<Cobro>(`/cobros/${id}`), config.pollIntervaloMs, (c) => !c || !esEstadoFinal(c.estado), { clave: id })
  const c = consulta.datos

  return (
    <MarcoBeneficiario nav={false}>
      {!c && consulta.error && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {!c && !consulta.error && <Cargando />}
      <div aria-live="polite" className="flex flex-1 flex-col gap-[18px]">
        {c && (c.estado === 'Pagando' || c.estado === 'Solicitado' || c.estado === 'PorConfirmar') && (
          <>
            <h1 className="sr-only">Pagando</h1>
            <EsperaPagando desde={inicioPagando(c.eventos) ?? c.creado} paraPunto={false} />
            <PasosDelPago cobro={c} />
            <p className="m-0 text-center text-muted-foreground">Puedes quedarte en esta pantalla: se actualiza sola.</p>
          </>
        )}

        {c?.estado === 'Pagado' && (
          <>
            <div role="status" className="flex flex-col items-center gap-2.5 pt-1 text-center">
              <span aria-hidden className="flex size-24 items-center justify-center rounded-full bg-pagado text-primary-foreground">
                <Check className="size-12" strokeWidth={3} />
              </span>
              <Titulo className="text-[32px]">Pagado</Titulo>
              <p className="m-0 text-xl">{textoMonto(c.monto, c.moneda)} llegaron a tu cuenta</p>
            </div>
            <PasosDelPago cobro={c} />
            <ListaDatos
              className="rounded-[14px] border border-border px-[18px] py-1"
              filas={[
                ['Referencia', <span key="r" className="mono">{c.referencia}</span>],
                ['Cuenta', c.cuenta ? <BilleteraCorta key="c" url={c.cuenta.billetera} /> : '—'],
                ['Cuándo', formatFechaHora(c.actualizado)],
              ]}
            />
            <p className="m-0 text-muted-foreground">En tu billetera aparece como un ingreso con la referencia {c.referencia}.</p>
            <Button asChild size="lg" className="mt-auto min-h-[60px] text-xl md:mt-2">
              <Link to="/beneficiario/historial">Listo</Link>
            </Button>
          </>
        )}

        {c && (c.estado === 'Rechazado' || c.estado === 'Fallido') && (
          <>
            <TarjetaRechazo
              cobro={c}
              paraPunto={false}
              datos={
                <ListaDatos
                  className="rounded-[14px] border border-border px-[18px] py-1"
                  filas={[
                    ['Programa', c.programa.nombre],
                    ['Cobro', c.estado],
                  ]}
                />
              }
            />
            <Button asChild size="lg" className="mt-auto min-h-[60px] text-xl md:mt-2">
              <Link to="/beneficiario">Volver al inicio</Link>
            </Button>
          </>
        )}
      </div>
    </MarcoBeneficiario>
  )
}

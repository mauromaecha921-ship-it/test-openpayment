import { Link, useParams } from 'react-router'

import { api } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Cobro, EventoCobro } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Bloque, Cargando, ErrorCarga, ListaDatos } from '@/componentes/Comun'
import { EsperaPagando } from '@/componentes/EsperaPagando'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { TatuPagado } from '@/componentes/TatuAnimado'
import { TarjetaRechazo } from '@/componentes/TarjetaRechazo'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { esEstadoFinal } from '@/lib/pantallas'
import { formatFechaHora, formatSegundos } from '@/lib/textos'

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
            <EsperaPagando desde={inicioPagando(c.eventos) ?? c.creado} paraPunto={false} cobro={c}>
              Estamos enviando {textoMonto(c.monto, c.moneda)} a tu cuenta.
            </EsperaPagando>
            <p className="m-0 text-muted-foreground">Puedes quedarte en esta pantalla: se actualiza sola.</p>
          </>
        )}

        {c?.estado === 'Pagado' && (
          <>
            <Bloque tono="pagado" role="status" className="gap-1.5">
              <TatuPagado medallon className="mb-2 size-[88px]" />
              <Titulo className="text-[40px] sm:text-[44px]">Pagado</Titulo>
              <p className="m-0 text-lg font-bold">{textoMonto(c.monto, c.moneda)} llegaron a tu cuenta</p>
              <span className="text-[15px]">
                Referencia <span className="mono">{c.referencia}</span>
                {c.segundosHastaPagado !== null && ` · en ${formatSegundos(c.segundosHastaPagado)}`}
              </span>
            </Bloque>
            <ListaDatos
              className="rounded-2xl border border-border bg-card px-[18px] py-1"
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
                  className="rounded-2xl border border-border bg-card px-[18px] py-1"
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

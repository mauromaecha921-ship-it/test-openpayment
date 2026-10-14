import { useParams } from 'react-router'

import { api } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Cobro } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { EsperaPagando } from '@/componentes/EsperaPagando'
import { textoMonto } from '@/componentes/Monto'
import { BotonEnlace, CabeceraCelular, Caja, ChipCobro, CirculoCheck, FilaDato, PantallaCelular, TituloPantalla } from '@/componentes/Proto'
import { esEstadoFinal, inicioPagando } from '@/lib/pantallas'
import { explicacionMotivo, formatHora, formatSegundos } from '@/lib/textos'

/** Prototipo B5 y B6 (wireframe 11): se consulta cada POLL_INTERVALO_MS hasta Pagado, Fallido o Rechazado. */
export default function CobroPagado() {
  const { id = '' } = useParams()
  const config = useConfig()
  const consulta = usePolling(() => api.get<Cobro>(`/cobros/${id}`), config.pollIntervaloMs, (c) => !c || !esEstadoFinal(c.estado), { clave: id })
  const c = consulta.datos
  const enCurso = c && (c.estado === 'Pagando' || c.estado === 'Solicitado' || c.estado === 'PorConfirmar')
  const destino = c?.cuenta ? <BilleteraCorta url={c.cuenta.billetera} /> : c?.punto ? c.punto.nombre.split(' — ')[0] : null

  return (
    <PantallaCelular>
      <CabeceraCelular
        volver="/beneficiario"
        etiquetaVolver={enCurso ? 'Volver a mis subsidios; el pago sigue en curso' : 'Volver a mis subsidios'}
        titulo={c?.canal === 'retiro' ? 'Cobro en un punto' : 'Cobro a tu cuenta'}
        subtitulo={c?.programa.nombre}
      />
      {!c && consulta.error && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {!c && !consulta.error && <Cargando />}
      <div aria-live="polite" className="flex flex-1 flex-col gap-4">
        {c && enCurso && (
          <>
            <h1 className="sr-only">Pagando</h1>
            <div className="mt-1 flex flex-col gap-4">
              <EsperaPagando desde={inicioPagando(c.eventos) ?? c.creado} paraPunto={false} cobro={c}>
                Estamos enviando {textoMonto(c.monto, c.moneda)} a tu {c.cuenta ? 'billetera' : 'cuenta'} {destino}.
              </EsperaPagando>
            </div>
            <p className="m-0 text-base leading-[1.45] text-muted-foreground">Suele tardar unos segundos. Si sales, el pago sigue y verás el resultado en tus subsidios.</p>
          </>
        )}

        {c?.estado === 'Pagado' && (
          <>
            <div role="status" className="mt-1.5 flex flex-col gap-1.5 rounded-[22px] bg-pagado-relleno px-5 py-[22px] text-white">
              <CirculoCheck />
              <TituloPantalla className="mt-2 text-[40px] leading-[1.05]">Pagado</TituloPantalla>
              <span className="text-xl leading-[1.35] font-semibold">
                {textoMonto(c.monto, c.moneda)} {c.canal === 'retiro' ? 'te los entregaron en efectivo' : 'llegaron a tu cuenta'}
              </span>
              <span className="mt-0.5 text-base">Referencia {c.referencia}</span>
            </div>
            <Caja>
              {destino && <FilaDato etiqueta={c.cuenta ? 'Billetera' : 'Punto'}>{destino}</FilaDato>}
              <FilaDato etiqueta="Programa">{c.programa.nombre}</FilaDato>
              <FilaDato etiqueta="Hora">{formatHora(c.actualizado, false)}</FilaDato>
              {c.segundosHastaPagado !== null && <FilaDato etiqueta="Tiempo">{formatSegundos(c.segundosHastaPagado)}</FilaDato>}
            </Caja>
            {c.cuenta && <p className="m-0 text-base leading-[1.45] text-muted-foreground">Ya lo puedes ver en tu billetera con esta misma referencia.</p>}
            <BotonEnlace to="/beneficiario" className="mt-auto">
              Volver a mis subsidios
            </BotonEnlace>
          </>
        )}

        {c && (c.estado === 'Rechazado' || c.estado === 'Fallido') && (
          <>
            <div role="alert" className="flex flex-col items-start gap-3.5">
              <ChipCobro estado={c.estado} motivo={c.motivo} conMotivo grande />
              <TituloPantalla className="text-[27px]">{c.motivo?.mensaje ?? (c.estado === 'Fallido' ? 'El pago falló' : 'El cobro fue rechazado')}</TituloPantalla>
              <p className="m-0 text-[17px] leading-[1.45]">{explicacionMotivo(c.motivo?.codigo, c.estado)}</p>
            </div>
            <Caja>
              <FilaDato etiqueta="Programa">{c.programa.nombre}</FilaDato>
              <FilaDato etiqueta="Cobro">{c.estado}</FilaDato>
            </Caja>
            <BotonEnlace to="/beneficiario" className="mt-auto">
              Volver a mis subsidios
            </BotonEnlace>
          </>
        )}
      </div>
    </PantallaCelular>
  )
}

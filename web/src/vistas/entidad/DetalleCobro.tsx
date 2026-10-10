import { useParams } from 'react-router'

import { api } from '@/api/client'
import type { Cobro } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga, ListaDatos, Tarjeta, Volver } from '@/componentes/Comun'
import { EstadoCobro } from '@/componentes/EstadoCobro'
import { LineaDeTiempo } from '@/componentes/LineaDeTiempo'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { useRol } from '@/contexto/Rol'
import { esEstadoFinal } from '@/lib/pantallas'
import { formatSegundos } from '@/lib/textos'

import { personaTexto } from './Tablero'

export default function DetalleCobro() {
  const { id = '' } = useParams()
  const rol = useRol()
  const consulta = usePolling(() => api.get<Cobro>(`/cobros/${id}`), 2000, (x) => !x || !esEstadoFinal(x.estado), { clave: id })
  const c = consulta.datos
  const vivo = c && !esEstadoFinal(c.estado)
  const volverA = `/entidad/programas/${c?.programa.id ?? rol.programaId ?? ''}`

  return (
    <MarcoEntidad>
      <Volver to={volverA}>Volver al tablero</Volver>
      {consulta.error && !c && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {!c && !consulta.error && <Cargando />}
      {c && (
        <>
          <div className="flex flex-wrap items-center gap-3" aria-live={vivo ? 'polite' : undefined}>
            <Titulo className="text-[28px] sm:text-[32px]">
              Cobro <span className="mono font-medium">{c.estado === 'Rechazado' ? '—' : c.referencia}</span>
            </Titulo>
            <EstadoCobro estado={c.estado} motivo={c.motivo} grande />
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <Tarjeta className="flex-[999_1_560px]">
              <h2 className="m-0 text-xl font-bold">Línea de tiempo</h2>
              <LineaDeTiempo eventos={c.eventos} />
            </Tarjeta>
            <Tarjeta as="aside" className="flex-[1_1_320px] gap-3.5">
              <h2 className="m-0 text-xl font-bold">Datos del cobro</h2>
              <ListaDatos
                className="text-[15px]"
                filas={[
                  ['Persona', personaTexto(c)],
                  ['Canal', c.canal === 'retiro' ? 'Retiro en un punto' : 'A la cuenta'],
                  ['Dónde', c.canal === 'retiro' ? (c.punto?.nombre ?? '—') : c.cuenta ? <BilleteraCorta key="c" url={c.cuenta.billetera} /> : '—'],
                  ['Monto', <strong key="m">{textoMonto(c.monto, c.moneda)}</strong>],
                  ['Referencia', <span key="r" className="mono">{c.referencia}</span>],
                  c.motivo && ['Motivo', c.motivo.mensaje],
                  c.segundosHastaPagado !== null && [
                    c.canal === 'retiro' ? 'Reembolso al punto' : 'Tiempo hasta Pagado',
                    `${formatSegundos(c.segundosHastaPagado)} después ${c.canal === 'retiro' ? 'del PIN' : 'de pedirlo'}`,
                  ],
                ]}
              />
            </Tarjeta>
          </div>
        </>
      )}
    </MarcoEntidad>
  )
}

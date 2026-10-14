import { Check, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import { Cargando, ErrorCarga, MensajeError } from '@/componentes/Comun'
import { PantallaEntidad } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import { Boton, BotonVolver } from '@/componentes/Proto'
import { plural } from '@/lib/textos'

import { useTablero } from './useTablero'

/** La API pide la palabra; la casilla del prototipo la manda al marcarse (HU-17, doble confirmación). */
const PALABRA = 'CERRAR'

/** Prototipo E4: el modal sobre el fondo gris, con lo cobrado, lo que se queda y la casilla. */
export default function CerrarPrograma() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const consulta = useTablero(id)
  const t = consulta.datos
  const [entiendo, setEntiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)

  const volver = () => navegar(`/entidad/programas/${id}`)

  useEffect(() => {
    if (t) titulo.current?.focus()
  }, [Boolean(t)])

  if (t && t.programa.estado !== 'Activo' && t.programa.estado !== 'Pausado') {
    return <Navigate to={`/entidad/programas/${id}`} replace />
  }

  const cerrar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await api.post(`/programas/${id}/cerrar`, { confirmacion: PALABRA })
      navegar(`/entidad/programas/${id}`, { replace: true })
    } catch (e) {
      setError(mensajeDeError(e))
      await consulta.recargar()
    } finally {
      setEnviando(false)
    }
  }

  const hayPagando = (t?.cobrosPagando ?? 0) > 0

  return (
    <PantallaEntidad quien={t?.programa.entidad} sinContenedor>
      <div className="flex flex-1 items-center justify-center bg-cerrado px-6 py-12 max-sm:px-4" onKeyDown={(e) => e.key === 'Escape' && volver()}>
        {consulta.error && !t && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
        {!t && !consulta.error && <Cargando />}
        {t && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cerrar"
            className="box-border flex w-full max-w-[560px] flex-col gap-[18px] rounded-3xl bg-card p-7 text-foreground shadow-[0_24px_60px_rgba(10,16,30,0.35)] max-sm:p-5"
          >
            <div className="flex items-center gap-3">
              <BotonVolver onClick={volver}>Volver</BotonVolver>
            </div>
            <h1 id="titulo-cerrar" ref={titulo} tabIndex={-1} className="titulo-proto m-0 text-[28px] outline-none">
              ¿Cerrar el programa?
            </h1>
            <p className="m-0 text-[17px] leading-[1.45]">Revocamos el permiso en tu banco y nadie podrá volver a cobrar. Esto no se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div className="rounded-[14px] bg-background px-4 py-3.5">
                <div className="text-[15px] text-muted-foreground">Cobrado</div>
                <div className="cifra text-[28px] [overflow-wrap:anywhere]">{textoMonto(t.cobrado, t.programa.moneda)}</div>
              </div>
              <div className="bloque rounded-[14px] px-4 py-3.5">
                <div className="text-[15px]">Se queda en tu cuenta</div>
                <div className="cifra text-[28px] text-ambar [overflow-wrap:anywhere]">{textoMonto(t.noHaSalido, t.programa.moneda)}</div>
              </div>
            </div>
            {hayPagando ? (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-pagando-fondo px-3 py-2.5 text-base font-bold text-pagando">
                <Clock aria-hidden className="size-[18px] flex-none" />
                Hay {plural(t.cobrosPagando, 'cobro')} pagándose. Espera a que terminen para cerrar.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-base">
                <Check aria-hidden className="size-[18px] text-pagado" strokeWidth={2.5} />
                No hay cobros en curso.
              </div>
            )}
            {t.sinCobrar && t.sinCobrar.cedulas > 0 && (
              <p className="m-0 text-[15px] text-muted-foreground">
                {plural(t.sinCobrar.cedulas, 'cédula')} todavía no {t.sinCobrar.cedulas === 1 ? 'ha' : 'han'} cobrado. Después del cierre, cualquier
                intento se rechaza.
              </p>
            )}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[17px] font-semibold">
              <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} className="size-[22px] accent-foreground" />
              Entiendo que no se puede deshacer
            </label>
            <MensajeError>{error}</MensajeError>
            <div className="flex flex-wrap justify-end gap-3">
              <Boton variante="contorno" medio onClick={volver}>
                Cancelar
              </Boton>
              <Boton variante="peligro" medio onClick={() => void cerrar()} disabled={!entiendo || hayPagando || enviando}>
                {enviando ? 'Cerrando…' : 'Cerrar programa'}
              </Boton>
            </div>
          </div>
        )}
      </div>
    </PantallaEntidad>
  )
}

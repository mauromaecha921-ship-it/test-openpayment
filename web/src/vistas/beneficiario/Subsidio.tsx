import { Clock, Link2, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Cobro } from '@/api/tipos'
import { Cargando, ErrorCarga, MensajeError } from '@/componentes/Comun'
import { CuentaDestino } from '@/componentes/CuentaDestino'
import { textoMonto } from '@/componentes/Monto'
import { Boton, BotonEnlace, CabeceraCelular, PantallaCelular } from '@/componentes/Proto'
import { useRol } from '@/contexto/Rol'
import { formatDiaMes } from '@/lib/textos'

import { useResumen } from './useResumen'

/** Prototipo B1 (con cuenta verificada) y B2 (sin cuenta): un subsidio y cómo cobrarlo. */
export default function Subsidio() {
  const { programaId = '' } = useParams()
  const navegar = useNavigate()
  const { documento } = useRol()
  const { datos: r, error, recargar } = useResumen()
  const [enviando, setEnviando] = useState(false)
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  const llave = useMemo(() => crypto.randomUUID(), [programaId])
  const pago = r?.pagos.find((p) => p.programa.id === programaId)
  const verificada = r?.cuenta?.estado === 'Verificada' ? r.cuenta : null

  const cobrar = async () => {
    if (!documento) return
    setEnviando(true)
    setErrorCobro(null)
    try {
      const c = await api.post<Cobro>('/cobros', { documento, canal: 'cuenta', programaId, llaveIdempotencia: llave })
      navegar(`/beneficiario/cobros/${c.id}`)
    } catch (e) {
      setErrorCobro(mensajeDeError(e))
      setEnviando(false)
    }
  }

  return (
    <PantallaCelular>
      <CabeceraCelular volver="/beneficiario" etiquetaVolver="Volver a mis subsidios" titulo={pago?.programa.nombre ?? 'Subsidio'} subtitulo={pago ? 'Disponible' : undefined} />
      {!r && error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!r && !error && <Cargando />}
      {r && !pago && <p className="m-0 text-muted-foreground">Este subsidio ya no está por cobrar.</p>}
      {pago && (
        <>
          <h1 className="sr-only">{pago.programa.nombre}</h1>
          <div className="bloque flex flex-col gap-1 rounded-[22px] p-5">
            <span className="text-base">{pago.programa.nombre}</span>
            <span className="cifra text-[50px] [overflow-wrap:anywhere] max-[380px]:text-[42px]">{textoMonto(pago.monto, pago.moneda)}</span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-ambar">
              <Clock aria-hidden className="size-4" />
              Cóbralo antes del {formatDiaMes(pago.vigenciaFin)}
            </span>
          </div>
          {verificada ? (
            <>
              <span className="mt-1 text-[17px] font-extrabold">¿Cómo quieres cobrarlo?</span>
              <Boton onClick={() => void cobrar()} disabled={enviando || pago.programa.estado !== 'Activo'}>
                {enviando ? 'Pidiendo el pago…' : `Cobrar ${textoMonto(pago.monto, pago.moneda)} a mi cuenta`}
              </Boton>
              <div className="-mt-1 flex items-start gap-2.5 text-base leading-[1.4]">
                <ShieldCheck aria-hidden className="mt-px size-5 flex-none text-azul" />
                <span>
                  Llega en segundos a tu cuenta <CuentaDestino cuenta={verificada} />, ya verificada. No necesitas PIN.
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-xl bg-activo-fondo text-activo">
                  <Link2 className="size-[22px]" />
                </span>
                <span className="text-lg leading-[1.25] font-extrabold">Enlaza tu cuenta para cobrar aquí</span>
              </div>
              <span className="text-base leading-[1.4] text-muted-foreground">Lo haces una sola vez. Después cobras con un toque, sin ir a ningún lado.</span>
              <BotonEnlace to="/beneficiario/cuenta">Enlazar mi cuenta</BotonEnlace>
              <BotonEnlace to={`/beneficiario/cobrar?programa=${programaId}`} variante="contorno">
                Cobrar con mi cédula como llave Bre-B
              </BotonEnlace>
            </div>
          )}
          <MensajeError>{errorCobro}</MensajeError>
          <BotonEnlace to="/beneficiario/puntos" variante="contorno">
            Prefiero cobrar en un punto
          </BotonEnlace>
          <p className="m-0 mt-auto text-[15px] leading-[1.45] text-muted-foreground">En un punto te entregan el valor completo en efectivo con tu cédula y tu PIN.</p>
        </>
      )}
    </PantallaCelular>
  )
}

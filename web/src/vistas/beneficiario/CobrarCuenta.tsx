import { Check, IdCard, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import type { Cobro } from '@/api/tipos'
import { Aviso, Cargando, ErrorCarga, MensajeError, Volver } from '@/componentes/Comun'
import { CuentaDestino } from '@/componentes/CuentaDestino'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'

import { useResumen } from './useResumen'

/**
 * Wireframe 10: un solo botón y sin PIN, porque la cuenta ya probó ser de la persona (RNF-03). Sin
 * cuenta enlazada, se cobra a la cédula como llave Bre-B (Plan Bre-B, RN-17): si el banco la
 * encuentra, la API la enlaza sola; si no, se ofrece enlazar otra llave o ir a un punto.
 */
export default function CobrarCuenta() {
  const navegar = useNavigate()
  const { documento } = useRol()
  const { datos: r, error, recargar } = useResumen()
  // Con varios subsidios, el que se eligió en Inicio (?programa=); si ya no está pendiente, vuelve a Inicio
  const [busqueda] = useSearchParams()
  const elegido = busqueda.get('programa')
  const pago = r && (elegido ? (r.pagos.find((p) => p.programa.id === elegido) ?? null) : r.pago)
  const [enviando, setEnviando] = useState(false)
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  const [sinLlave, setSinLlave] = useState(false)
  // Una llave por intento: se reutiliza en el doble clic y en los reintentos (HU-10).
  const llave = useMemo(() => crypto.randomUUID(), [])

  if (r && !pago) return <Navigate to="/beneficiario" replace />
  // Una wallet que espera la aprobación en el banco no se salta: hay que terminarla o cambiarla
  if (r && r.cuenta?.estado === 'PorVerificar') return <Navigate to="/beneficiario/cuenta" replace />
  const conCuenta = r?.cuenta?.estado === 'Verificada' ? r.cuenta : null

  const cobrar = async () => {
    if (!pago || !documento) return
    setEnviando(true)
    setErrorCobro(null)
    try {
      const c = await api.post<Cobro>('/cobros', { programaId: pago.programa.id, documento, canal: 'cuenta', llaveIdempotencia: llave })
      navegar(`/beneficiario/cobros/${c.id}`, { replace: true })
    } catch (e) {
      // RN-17: su cédula no es una llave Bre-B y no tiene cuenta enlazada
      if (!conCuenta && e instanceof ErrorApi && e.codigo === 'CuentaNoVerificada') setSinLlave(true)
      else setErrorCobro(mensajeDeError(e))
      setEnviando(false)
    }
  }

  const monto = pago ? textoMonto(pago.monto, pago.moneda) : ''

  return (
    <MarcoBeneficiario nav={false}>
      <Volver to="/beneficiario">Volver</Volver>
      <Titulo className="text-[26px] md:text-[32px]">Cobrar a mi cuenta</Titulo>
      {!r && error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!r && !error && <Cargando />}
      {r && pago && (
        <>
          <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="bloque flex flex-col gap-1 px-[22px] py-5">
              <span className="text-[17px] font-bold">Vas a recibir</span>
              <span className="cifra text-[40px] [overflow-wrap:anywhere] min-[380px]:text-[46px]">{monto}</span>
            </div>
            <dl className="m-0 flex flex-col gap-3 px-[22px] py-5">
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-tenue">De</dt>
                <dd className="m-0">{pago.programa.nombre}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-tenue">A tu cuenta</dt>
                <dd className="m-0 flex flex-wrap items-center gap-2">
                  {conCuenta ? (
                    <>
                      <CuentaDestino cuenta={conCuenta} completa />
                      <span className="inline-flex items-center gap-1 rounded-full border border-foreground px-2 py-0.5 text-[13px]">
                        <Check aria-hidden className="size-3" strokeWidth={3} />
                        Verificada
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[13px] font-bold">Bre-B</span>
                      La cuenta donde registraste tu cédula como llave
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {sinLlave ? (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-foreground bg-card p-5">
              <IdCard aria-hidden className="size-8" />
              <strong className="text-[21px] leading-tight">Tu cédula no está registrada como llave Bre-B</strong>
              <p className="m-0 text-muted-foreground">Puedes enlazar otra llave (tu celular, tu correo o tu @llave) o cobrar en efectivo en un punto.</p>
              <Button asChild size="lg">
                <Link to="/beneficiario/cuenta">Enlazar otra llave</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-[17px]">
                <Link to="/beneficiario/puntos">Cobrar en un punto</Link>
              </Button>
            </div>
          ) : (
            <>
              <Aviso icono={<ShieldCheck aria-hidden />}>
                {conCuenta
                  ? 'No necesitas PIN: tu cuenta ya probó ser tuya.'
                  : 'No necesitas enlazar nada ni poner PIN: buscamos tu cédula en Bre-B y el pago llega a la cuenta donde la registraste.'}
              </Aviso>
              <MensajeError>{errorCobro}</MensajeError>

              <div className="mt-auto flex flex-col gap-3 md:mt-2">
                <Button size="lg" className="min-h-[60px] text-xl" onClick={() => void cobrar()} disabled={enviando || pago.programa.estado !== 'Activo'}>
                  {enviando ? 'Pidiendo el pago…' : conCuenta ? `Cobrar ${monto}` : `Cobrar ${monto} a mi cédula`}
                </Button>
                <Button asChild variant="outline" size="lg" className="text-[17px]">
                  <Link to="/beneficiario/puntos">Prefiero cobrar en un punto</Link>
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </MarcoBeneficiario>
  )
}

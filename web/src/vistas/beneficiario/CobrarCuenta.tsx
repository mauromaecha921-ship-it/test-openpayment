import { Check, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Cobro } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Aviso, Cargando, ErrorCarga, MensajeError, Volver } from '@/componentes/Comun'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'

import { useResumen } from './useResumen'

/** Wireframe 10: un solo botón y sin PIN, porque la cuenta ya probó ser de la persona (RNF-03). */
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
  // Una llave por intento: se reutiliza en el doble clic y en los reintentos (HU-10).
  const llave = useMemo(() => crypto.randomUUID(), [])

  if (r && !pago) return <Navigate to="/beneficiario" replace />
  if (r && r.cuenta?.estado !== 'Verificada') return <Navigate to="/beneficiario/cuenta" replace />

  const cobrar = async () => {
    if (!pago || !documento) return
    setEnviando(true)
    setErrorCobro(null)
    try {
      const c = await api.post<Cobro>('/cobros', { programaId: pago.programa.id, documento, canal: 'cuenta', llaveIdempotencia: llave })
      navegar(`/beneficiario/cobros/${c.id}`, { replace: true })
    } catch (e) {
      setErrorCobro(mensajeDeError(e))
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
      {r && pago && r.cuenta && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border border-control p-[22px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[17px] text-muted-foreground">Vas a recibir</span>
              <span className="text-[44px] leading-[1.05] font-bold [overflow-wrap:anywhere] min-[380px]:text-[48px]">{monto}</span>
            </div>
            <dl className="m-0 flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-tenue">De</dt>
                <dd className="m-0">{pago.programa.nombre}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-tenue">A tu cuenta</dt>
                <dd className="m-0 flex flex-wrap items-center gap-2">
                  <BilleteraCorta url={r.cuenta.billetera} completa />
                  <span className="inline-flex items-center gap-1 rounded-full border border-foreground px-2 py-0.5 text-[13px]">
                    <Check aria-hidden className="size-3" strokeWidth={3} />
                    Verificada
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <Aviso icono={<ShieldCheck aria-hidden />}>No necesitas PIN: tu cuenta ya probó ser tuya.</Aviso>
          <MensajeError>{errorCobro}</MensajeError>

          <div className="mt-auto flex flex-col gap-3 md:mt-2">
            <Button size="lg" className="min-h-[60px] text-xl" onClick={() => void cobrar()} disabled={enviando || pago.programa.estado !== 'Activo'}>
              {enviando ? 'Pidiendo el pago…' : `Cobrar ${monto}`}
            </Button>
            <Button asChild variant="outline" size="lg" className="text-[17px]">
              <Link to="/beneficiario/puntos">Prefiero cobrar en un punto</Link>
            </Button>
          </div>
        </>
      )}
    </MarcoBeneficiario>
  )
}

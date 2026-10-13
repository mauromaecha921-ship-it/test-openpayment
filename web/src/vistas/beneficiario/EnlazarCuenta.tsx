import { Check, Clock, Lock, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import type { Cuenta, CuentaCreada, EstadoCuenta } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { Cargando, ErrorCarga, MensajeError, Pastilla, Volver } from '@/componentes/Comun'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'
import { NOMBRE_ESTADO_CUENTA } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { prepararPestana } from '@/lib/ventana'

import { useResumen } from './useResumen'

const DIEZ_MINUTOS = 10 * 60_000

/** null cuando la persona todavía no tiene cuenta (404). */
async function leerCuenta(documento: string): Promise<Cuenta | null> {
  try {
    return await api.get<Cuenta>(`/cuentas/${documento}`)
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 404) return null
    throw e
  }
}

export default function EnlazarCuenta() {
  const { documento } = useRol()
  const [busqueda, setBusqueda] = useSearchParams()
  const resultado = busqueda.get('resultado')

  const consulta = usePolling(() => leerCuenta(documento ?? ''), 2000, (c) => c?.estado === 'PorVerificar', {
    clave: documento,
    maxMs: DIEZ_MINUTOS,
  })
  const cuenta = consulta.datos
  // Quien se registró sin PIN en «Equipo de prueba» no lo necesita para cambiar su cuenta
  const { datos: resumen } = useResumen()
  const pidePin = resumen?.persona.tienePin !== false

  const [cambiando, setCambiando] = useState(false)
  const [billetera, setBilletera] = useState('')
  const [pin, setPin] = useState('')
  const [redirect, setRedirect] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cuenta?.estado === 'Verificada') setCambiando(false)
  }, [cuenta?.estado])

  const estado: EstadoCuenta = cambiando ? 'SinEnlazar' : (cuenta?.estado ?? 'SinEnlazar')
  const paso = estado === 'Verificada' ? 3 : estado === 'PorVerificar' ? 2 : 1

  const enlazar = async () => {
    if (pidePin && !/^\d{4}$/.test(pin)) return setError('El PIN tiene 4 dígitos.')
    if (!billetera.trim()) return setError('Escribe la dirección de tu billetera.')
    const pestana = prepararPestana()
    setEnviando(true)
    setError(null)
    if (resultado) setBusqueda({}, { replace: true })
    try {
      const r = await api.post<CuentaCreada>('/cuentas', { documento, billetera: billetera.trim(), pin: pidePin ? pin : undefined })
      if (r.redirect) {
        setRedirect(r.redirect)
        pestana.ir(r.redirect)
      } else {
        pestana.cerrar() // verificación simulada (plan B de HU-07): ya quedó Verificada
      }
      consulta.setDatos(r.cuenta)
      setCambiando(false)
    } catch (e) {
      pestana.cerrar()
      setError(mensajeDeError(e))
    } finally {
      setPin('') // el PIN se envía una vez y se borra
      setEnviando(false)
    }
  }

  const reintentar = () => {
    setRedirect(null)
    setCambiando(true)
    if (resultado) setBusqueda({}, { replace: true })
  }

  const mensajeResultado =
    resultado === 'rechazada'
      ? 'No aprobaste en tu billetera; puedes intentarlo de nuevo.'
      : resultado === 'invalido'
        ? 'No pudimos confirmar la respuesta de tu billetera; intenta de nuevo.'
        : null

  return (
    <MarcoBeneficiario>
      <Volver to="/beneficiario">Inicio</Volver>
      <div className="flex items-center justify-between gap-2">
        <Titulo className="text-[26px] md:text-[32px]">Enlaza tu cuenta</Titulo>
        {cuenta !== undefined && <Pastilla>{NOMBRE_ESTADO_CUENTA[estado]}</Pastilla>}
      </div>
      <ol aria-label="Pasos" className="m-0 flex list-none gap-1.5 p-0 text-[13px] text-muted-foreground">
        {['Tus datos', 'Tu billetera', 'Lista'].map((t, i) => (
          <li key={t} aria-current={i + 1 === paso ? 'step' : undefined} className={cn('flex-1 border-t-4 pt-1.5', i < paso ? 'border-foreground' : 'border-border', i + 1 === paso && 'font-bold text-foreground')}>
            {i + 1} · {t}
          </li>
        ))}
      </ol>

      {mensajeResultado && estado !== 'Verificada' && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border-2 border-foreground px-4 py-3">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {mensajeResultado}
        </p>
      )}
      {consulta.error && cuenta === undefined && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {cuenta === undefined && !consulta.error && <Cargando />}

      <div aria-live="polite" className="flex flex-col gap-4">
        {cuenta !== undefined && estado === 'SinEnlazar' && (
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault()
              void enlazar()
            }}
          >
            <Campo etiqueta="Tu cédula" value={documento ?? ''} readOnly inputMode="numeric" claseInput="bg-muted text-xl" ayuda="Es la cédula con la que entraste." />
            <Campo
              etiqueta="Dirección de tu billetera"
              mono
              placeholder="$ilp.interledger-test.dev/…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={billetera}
              onChange={(e) => setBilletera(e.target.value)}
            />
            {pidePin && (
              <Campo
                etiqueta="Tu PIN"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                pattern="\d{4}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                claseInput="w-40 text-[22px] tracking-[8px] md:text-[22px]"
                ayuda="Así nadie puede enlazar su cuenta a tu cédula."
              />
            )}
            <MensajeError>{error}</MensajeError>
            <Button type="submit" size="lg" disabled={enviando}>
              {enviando ? 'Enlazando…' : 'Enlazar'}
            </Button>
            {cambiando && cuenta?.estado === 'Verificada' && (
              <Button type="button" variant="outline" size="lg" className="text-[17px]" onClick={() => setCambiando(false)}>
                Seguir con mi cuenta actual
              </Button>
            )}
            <p className="m-0 flex gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden className="size-[18px] shrink-0" />
              Solo guardamos la dirección de tu billetera, nunca tus claves.
            </p>
          </form>
        )}

        {estado === 'PorVerificar' && cuenta && (
          <>
            <div className="flex flex-col gap-2.5 rounded-[14px] border-2 border-dashed border-control p-5">
              <Clock aria-hidden className="size-8" />
              <strong className="text-[21px]">Aprueba en tu billetera</strong>
              <p className="m-0 text-muted-foreground">
                Te llevamos a tu billetera para confirmar que la cuenta <BilleteraCorta url={cuenta.billetera} /> es tuya. Si no apruebas en 10 minutos,
                puedes intentarlo de nuevo.
              </p>
            </div>
            {redirect && (
              <Button size="lg" onClick={() => window.open(redirect, '_blank', 'noopener')}>
                Abrir mi billetera
              </Button>
            )}
            <Button variant="outline" size="lg" className="text-[17px]" onClick={reintentar}>
              Intentar de nuevo
            </Button>
          </>
        )}

        {estado === 'Verificada' && cuenta && (
          <div role="status" className="flex flex-col items-center gap-4 pt-3 text-center">
            <span aria-hidden className="flex size-[88px] items-center justify-center rounded-full bg-pagado-relleno text-primary-foreground">
              <Check className="size-12" strokeWidth={2.5} />
            </span>
            <strong className="text-2xl leading-tight">Tu cuenta está lista para recibir pagos</strong>
            <BilleteraCorta url={cuenta.billetera} completa className="text-muted-foreground" />
            <Button asChild size="lg" className="w-full">
              <Link to="/beneficiario">Volver a mi subsidio</Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full text-[17px]" onClick={() => setCambiando(true)}>
              Enlazar otra cuenta
            </Button>
          </div>
        )}
      </div>
    </MarcoBeneficiario>
  )
}

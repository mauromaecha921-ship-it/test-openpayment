import { AtSign, Check, Clock, IdCard, Link2, Lock, Mail, Smartphone, TriangleAlert, UserCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import type { Cuenta, CuentaCreada, EstadoCuenta, LlaveConsultada, TipoLlave } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { Cargando, ErrorCarga, MensajeError, Pastilla, Volver } from '@/componentes/Comun'
import { CuentaDestino } from '@/componentes/CuentaDestino'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'
import { NOMBRE_ESTADO_CUENTA, NOMBRE_TIPO_LLAVE, textoLlave } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { prepararPestana } from '@/lib/ventana'

import { useResumen } from './useResumen'

const DIEZ_MINUTOS = 10 * 60_000

/** Los 4 tipos de llave Bre-B, con lo que se le pide a la persona en cada uno (RN-14). */
const TIPOS: { tipo: TipoLlave; icono: ReactNode; etiqueta: string; placeholder: string; inputMode: 'numeric' | 'tel' | 'email' | 'text' }[] = [
  { tipo: 'cedula', icono: <IdCard />, etiqueta: 'Tu cédula como llave', placeholder: '', inputMode: 'numeric' },
  { tipo: 'celular', icono: <Smartphone />, etiqueta: 'Tu celular', placeholder: '300 123 4567', inputMode: 'tel' },
  { tipo: 'correo', icono: <Mail />, etiqueta: 'Tu correo', placeholder: 'nombre@correo.com', inputMode: 'email' },
  { tipo: 'alfanumerica', icono: <AtSign />, etiqueta: 'Tu @llave', placeholder: '@tunombre', inputMode: 'text' },
]

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
  // Llave Bre-B (Plan Bre-B): tipo, valor y el «¿Eres …?» que devuelve el banco
  const [tipo, setTipo] = useState<TipoLlave>('cedula')
  const [valor, setValor] = useState('')
  const [consultada, setConsultada] = useState<LlaveConsultada | null>(null)
  // Opción avanzada: una wallet Open Payments escrita a mano
  const [billetera, setBilletera] = useState('')
  const [pin, setPin] = useState('')
  const [redirect, setRedirect] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cuenta?.estado === 'Verificada') setCambiando(false)
  }, [cuenta?.estado])

  const estado: EstadoCuenta = cambiando ? 'SinEnlazar' : (cuenta?.estado ?? 'SinEnlazar')
  const paso = estado === 'Verificada' ? 3 : estado === 'PorVerificar' || consultada ? 2 : 1
  const llave = tipo === 'cedula' ? (documento ?? '') : valor.trim()
  // La llave tipo cédula prueba sola que es de la persona (RN-15); las demás piden el PIN (RN-16)
  const pinLlave = pidePin && tipo !== 'cedula'

  const elegirTipo = (t: TipoLlave) => {
    setTipo(t)
    setValor('')
    setConsultada(null)
    setError(null)
  }

  const buscar = async () => {
    if (!llave) return setError('Escribe tu llave.')
    setEnviando(true)
    setError(null)
    if (resultado) setBusqueda({}, { replace: true })
    try {
      setConsultada(await api.get<LlaveConsultada>(`/cuentas/llaves/${tipo}/${encodeURIComponent(llave)}`))
    } catch (e) {
      setError(
        e instanceof ErrorApi && e.codigo === 'LlaveNoExiste'
          ? tipo === 'cedula'
            ? 'Tu cédula no está registrada como llave Bre-B. Regístrala en tu banco o usa otra llave.'
            : 'No encontramos esa llave en Bre-B. Revisa que la escribiste bien y que elegiste el tipo correcto.'
          : mensajeDeError(e),
      )
    } finally {
      setEnviando(false)
    }
  }

  const enlazarLlave = async () => {
    if (pinLlave && !/^\d{4}$/.test(pin)) return setError('El PIN tiene 4 dígitos.')
    setEnviando(true)
    setError(null)
    try {
      const r = await api.post<CuentaCreada>('/cuentas', { documento, tipoLlave: tipo, llave, pin: pinLlave ? pin : undefined })
      consulta.setDatos(r.cuenta)
      setConsultada(null)
      setValor('')
      setCambiando(false)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setPin('') // el PIN se envía una vez y se borra
      setEnviando(false)
    }
  }

  const enlazarWallet = async () => {
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
      setPin('')
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

  const campoPin = (ayuda: string) => (
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
      ayuda={ayuda}
    />
  )
  const actual = TIPOS.find((t) => t.tipo === tipo)!

  return (
    <MarcoBeneficiario>
      <Volver to="/beneficiario" className="hidden md:inline-flex">Inicio</Volver>
      <div className="flex items-center justify-between gap-2">
        <Titulo className="text-[26px] md:text-[32px]">Enlaza tu cuenta</Titulo>
        {cuenta !== undefined && <Pastilla>{NOMBRE_ESTADO_CUENTA[estado]}</Pastilla>}
      </div>
      <ol aria-label="Pasos" className="m-0 flex list-none gap-1.5 p-0 text-[13px] text-muted-foreground">
        {['Tu llave', 'Confirma', 'Lista'].map((t, i) => (
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
        {cuenta !== undefined && estado === 'SinEnlazar' && !consultada && (
          <>
            <form
              className="flex flex-col gap-3.5"
              onSubmit={(e) => {
                e.preventDefault()
                void buscar()
              }}
            >
              <p className="m-0 text-[17px] text-muted-foreground">
                Usa la llave Bre-B que ya tienes en tu banco o billetera (Nequi, Daviplata, tu banco…). No tienes que crear nada nuevo.
              </p>
              <div role="radiogroup" aria-label="Tipo de llave" className="grid grid-cols-2 gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.tipo}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t.tipo}
                    onClick={() => elegirTipo(t.tipo)}
                    className={cn(
                      'flex min-h-[64px] items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-[16px] font-bold [&_svg]:size-5 [&_svg]:shrink-0',
                      tipo === t.tipo ? 'border-foreground bg-secondary' : 'border-border hover:bg-muted',
                    )}
                  >
                    <span aria-hidden>{t.icono}</span>
                    {NOMBRE_TIPO_LLAVE[t.tipo]}
                  </button>
                ))}
              </div>
              {tipo === 'cedula' ? (
                <Campo
                  etiqueta={actual.etiqueta}
                  value={documento ?? ''}
                  readOnly
                  inputMode="numeric"
                  claseInput="bg-muted text-xl"
                  ayuda="Si registraste tu cédula como llave en tu banco, ahí te llega. Ni siquiera necesitas enlazarla: puedes cobrar directo."
                />
              ) : (
                <Campo
                  etiqueta={actual.etiqueta}
                  placeholder={actual.placeholder}
                  inputMode={actual.inputMode}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  ayuda="Tal como la registraste en tu banco."
                />
              )}
              <MensajeError>{error}</MensajeError>
              <Button type="submit" size="lg" disabled={enviando}>
                {enviando ? 'Buscando…' : 'Buscar mi llave'}
              </Button>
              {cambiando && cuenta?.estado === 'Verificada' && (
                <Button type="button" variant="outline" size="lg" className="text-[17px]" onClick={() => setCambiando(false)}>
                  Seguir con mi cuenta actual
                </Button>
              )}
            </form>

            <details className="rounded-lg border border-border px-4 py-3 [&[open]>summary]:mb-3">
              <summary className="cursor-pointer text-[15px] font-bold">Tengo una wallet Open Payments</summary>
              <form
                className="flex flex-col gap-3.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  void enlazarWallet()
                }}
              >
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
                {pidePin && campoPin('Así nadie puede enlazar su cuenta a tu cédula.')}
                <Button type="submit" variant="outline" size="lg" className="border-foreground" disabled={enviando}>
                  {enviando ? 'Enlazando…' : 'Enlazar mi wallet'}
                </Button>
              </form>
            </details>

            <p className="m-0 flex gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden className="size-[18px] shrink-0" />
              Solo guardamos tu llave, nunca tus claves ni tu nombre.
            </p>
          </>
        )}

        {cuenta !== undefined && estado === 'SinEnlazar' && consultada && (
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault()
              void enlazarLlave()
            }}
          >
            <div className="bloque flex flex-col gap-2 rounded-2xl p-5">
              <UserCheck aria-hidden className="size-8 text-ambar" />
              <span className="text-[17px] text-noche-tenue">Bre-B dice que esta llave es de</span>
              <strong className="titular text-[26px]">¿Eres {consultada.titular}?</strong>
              <span className="mono text-[15px]">{textoLlave(consultada.tipoLlave, consultada.llave)}</span>
            </div>
            {pinLlave && campoPin('Confirma con tu PIN. Además, tu banco revisa que la llave esté a tu nombre.')}
            <MensajeError>{error}</MensajeError>
            <Button type="submit" size="lg" disabled={enviando}>
              {enviando ? 'Enlazando…' : 'Sí, soy yo: enlazar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="text-[17px]"
              onClick={() => {
                setConsultada(null)
                setError(null)
              }}
            >
              No soy yo / usar otra llave
            </Button>
          </form>
        )}

        {estado === 'PorVerificar' && cuenta && (
          <>
            <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-5">
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
          <div role="status" className="flex flex-col items-start gap-4 pt-1">
            <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Link2 className="size-8" strokeWidth={2.5} />
            </span>
            <strong className="titular text-[30px] md:text-[34px]">Tu cuenta está lista para recibir pagos</strong>
            <p className="m-0 text-[17px] text-muted-foreground">Desde ahora cobras con un toque.</p>
            <div className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-card px-[18px] py-3.5">
              <span className="flex items-center gap-1.5 text-[15px] font-bold text-pagado">
                <Check aria-hidden className="size-4" strokeWidth={2.5} />
                Verificada
              </span>
              <CuentaDestino cuenta={cuenta} completa />
            </div>
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

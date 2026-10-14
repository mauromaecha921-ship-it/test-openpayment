import { AtSign, Clock, IdCard, Link2, Mail, Smartphone, TriangleAlert, UserCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import type { Cuenta, CuentaCreada, EstadoCuenta, LlaveConsultada, TipoLlave } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { Cargando, ErrorCarga, MensajeError } from '@/componentes/Comun'
import { CuentaDestino } from '@/componentes/CuentaDestino'
import { textoMonto } from '@/componentes/Monto'
import { Boton, BotonEnlace, CabeceraCelular, Caja, claseEnlaceSuave, FilaDato, NotaGris, PantallaCelular, TituloPantalla } from '@/componentes/Proto'
import { useRol } from '@/contexto/Rol'
import { NOMBRE_TIPO_LLAVE, textoLlave } from '@/lib/textos'
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
      proto="celular"
      etiqueta="Tu PIN"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      pattern="\d{4}"
      value={pin}
      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
      claseInput="tracking-[6px]"
      ayuda={ayuda}
    />
  )
  const actual = TIPOS.find((t) => t.tipo === tipo)!
  const pago = resumen?.pagos.find((p) => p.programa.tipo !== 'bono')
  const [conLlave, setConLlave] = useState(false)

  return (
    <PantallaCelular>
      <CabeceraCelular
        volver="/beneficiario"
        etiquetaVolver="Volver a mis subsidios"
        titulo={estado === 'Verificada' ? 'Cuenta enlazada' : 'Enlaza tu cuenta'}
        subtitulo={`Paso ${paso === 1 ? 1 : 2} de 2`}
      />

      {mensajeResultado && estado !== 'Verificada' && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-[14px] bg-rechazo-fondo px-4 py-3 font-semibold text-rechazo">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {mensajeResultado}
        </p>
      )}
      {consulta.error && cuenta === undefined && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {cuenta === undefined && !consulta.error && <Cargando />}

      {cuenta !== undefined && estado === 'SinEnlazar' && !consultada && (
        <>
          <h1 className="sr-only">Enlaza tu cuenta</h1>
          <p className="m-0 text-[17px] leading-[1.45]">Así nadie más puede enlazar una cuenta a tu cédula.</p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void enlazarWallet()
            }}
          >
            <Campo proto="celular" etiqueta="Tu cédula" value={documento ?? ''} readOnly inputMode="numeric" />
            <Campo
              proto="celular"
              etiqueta="Dirección de tu billetera"
              placeholder="$ilp.interledger-test.dev/…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={billetera}
              onChange={(e) => setBilletera(e.target.value)}
              ayuda="La encuentras en tu billetera, en «Recibir»."
            />
            {pidePin && campoPin('Es el que te entregó la entidad con tu subsidio.')}
            <NotaGris>Solo guardamos la dirección de tu billetera, nunca tus claves. En el paso 2 apruebas el enlace en tu billetera.</NotaGris>
            {!conLlave && <MensajeError>{error}</MensajeError>}
            <Boton type="submit" disabled={enviando}>
              {enviando && !conLlave ? 'Enlazando…' : 'Enlazar'}
            </Boton>
          </form>

          {/* Plan Bre-B: la llave que la persona ya tiene en su banco (no está en el prototipo) */}
          <section aria-labelledby="titulo-llave" className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-border bg-card p-4">
            <h2 id="titulo-llave" className="m-0 text-lg font-extrabold">
              ¿Tienes llave Bre-B?
            </h2>
            <p className="m-0 text-base leading-[1.4] text-muted-foreground">
              Usa la que ya tienes en tu banco o billetera (Nequi, Daviplata, tu banco…). Si tu cédula es tu llave, ni siquiera necesitas
              enlazarla para cobrar.
            </p>
            {!conLlave ? (
              <Boton variante="contorno" onClick={() => setConLlave(true)}>
                Usar mi llave Bre-B
              </Boton>
            ) : (
              <form
                className="flex flex-col gap-3.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  void buscar()
                }}
              >
                <div role="radiogroup" aria-label="Tipo de llave" className="grid grid-cols-2 gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.tipo}
                      type="button"
                      role="radio"
                      aria-checked={tipo === t.tipo}
                      onClick={() => elegirTipo(t.tipo)}
                      className={cn(
                        'flex min-h-14 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-base font-bold text-foreground [&_svg]:size-5 [&_svg]:shrink-0',
                        tipo === t.tipo ? 'border-2 border-foreground bg-muted' : 'border-[1.5px] border-border bg-card',
                      )}
                    >
                      <span aria-hidden>{t.icono}</span>
                      {NOMBRE_TIPO_LLAVE[t.tipo]}
                    </button>
                  ))}
                </div>
                {tipo === 'cedula' ? (
                  <Campo proto="celular" etiqueta={actual.etiqueta} value={documento ?? ''} readOnly inputMode="numeric" ayuda="Si registraste tu cédula como llave en tu banco, ahí te llega." />
                ) : (
                  <Campo
                    proto="celular"
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
                <Boton type="submit" disabled={enviando}>
                  {enviando ? 'Buscando…' : 'Buscar mi llave'}
                </Boton>
              </form>
            )}
          </section>

          {cambiando && cuenta?.estado === 'Verificada' && (
            <button type="button" onClick={() => setCambiando(false)} className={`${claseEnlaceSuave()} border-0 bg-transparent`}>
              Seguir con mi cuenta actual
            </button>
          )}
        </>
      )}

      {cuenta !== undefined && estado === 'SinEnlazar' && consultada && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void enlazarLlave()
          }}
        >
          <div className="bloque flex flex-col gap-2 rounded-[22px] p-5">
            <UserCheck aria-hidden className="size-8 text-ambar" />
            <span className="text-[17px] text-noche-tenue">Bre-B dice que esta llave es de</span>
            <h1 className="titulo-proto m-0 text-[26px]">¿Eres {consultada.titular}?</h1>
            <span className="mono text-[15px]">{textoLlave(consultada.tipoLlave, consultada.llave)}</span>
          </div>
          {pinLlave && campoPin('Confirma con tu PIN. Además, tu banco revisa que la llave esté a tu nombre.')}
          <MensajeError>{error}</MensajeError>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Enlazando…' : 'Sí, soy yo: enlazar'}
          </Boton>
          <Boton
            variante="contorno"
            onClick={() => {
              setConsultada(null)
              setError(null)
            }}
          >
            No soy yo / usar otra llave
          </Boton>
        </form>
      )}

      {estado === 'PorVerificar' && cuenta && (
        <>
          <div className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-border bg-card p-4">
            <Clock aria-hidden className="size-8" />
            <h1 className="m-0 text-xl font-extrabold">Aprueba en tu billetera</h1>
            <p className="m-0 text-base leading-[1.4] text-muted-foreground">
              Te llevamos a tu billetera para confirmar que la cuenta <BilleteraCorta url={cuenta.billetera} /> es tuya. Si no apruebas en 10 minutos,
              puedes intentarlo de nuevo.
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            {redirect && <Boton onClick={() => window.open(redirect, '_blank', 'noopener')}>Abrir mi billetera</Boton>}
            <Boton variante="contorno" onClick={reintentar}>
              Intentar de nuevo
            </Boton>
          </div>
        </>
      )}

      {estado === 'Verificada' && cuenta && (
        <>
          <div role="status" className="mt-[18px] flex flex-col items-start gap-3.5">
            <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-primary text-white">
              <Link2 className="size-[30px]" strokeWidth={2.4} />
            </span>
            <TituloPantalla className="text-[30px]">Tu cuenta está lista para recibir pagos</TituloPantalla>
            <p className="m-0 text-[17px] leading-[1.45]">
              {cuenta.tipoLlave ? 'Enlazamos tu llave Bre-B.' : 'Aprobaste el enlace en tu billetera.'} Desde ahora cobras con un toque.
            </p>
          </div>
          <Caja>
            <FilaDato etiqueta={cuenta.tipoLlave ? 'Llave' : 'Billetera'}>
              <CuentaDestino cuenta={cuenta} />
            </FilaDato>
            <FilaDato etiqueta="Estado">Verificada</FilaDato>
          </Caja>
          <button type="button" onClick={() => setCambiando(true)} className="self-start border-0 bg-transparent p-0 text-[15px] font-semibold text-azul underline underline-offset-[3px]">
            Enlazar otra cuenta
          </button>
          <div className="mt-auto flex flex-col gap-1">
            {pago && <BotonEnlace to={`/beneficiario/subsidio/${pago.programa.id}`}>Cobrar {textoMonto(pago.monto, pago.moneda)} ahora</BotonEnlace>}
            <Link to="/beneficiario" className={claseEnlaceSuave()}>
              Ir a mis subsidios
            </Link>
          </div>
        </>
      )}
    </PantallaCelular>
  )
}

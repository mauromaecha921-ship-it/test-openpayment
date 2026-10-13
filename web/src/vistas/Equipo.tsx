import { Check, KeyRound, Store, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Comercio, PersonaEntrada, PersonaRegistrada, Punto, PuntoEntrada } from '@/api/tipos'
import { usePolling, type Consulta } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { AvisoBilletera, Exito, useBilletera } from '@/componentes/FormularioWallet'
import { ErrorCarga, MensajeError, Pastilla, Tarjeta, Volver } from '@/componentes/Comun'
import { Encabezado } from '@/componentes/Encabezado'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'
import { cn } from '@/lib/utils'

import { SeccionComercios } from './EquipoComercios'

/**
 * Equipo de prueba (Plan de ajustes § 3, F2): el equipo se registra con su cédula y su wallet de la
 * Test Wallet, y registra puntos con cualquier wallet. Así se envían dinero entre ellos por el flujo
 * real: quien paga crea un programa con su wallet y los demás cobran.
 */
export default function Equipo() {
  const personas = usePolling(() => api.get<PersonaRegistrada[]>('/beneficiarios'), null)
  // Los puntos de retiro; las sedes de comercios (bonos) van en su propia sección
  const puntos = usePolling(async () => (await api.get<Punto[]>('/puntos')).filter((p) => p.tipo !== 'compra'), null)
  const comercios = usePolling(() => api.get<Comercio[]>('/comercios'), null)

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <Encabezado variante="entrada" />
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 md:pt-8">
        <Volver to="/">Volver a la entrada</Volver>
        <div className="flex flex-col gap-2">
          <Titulo className="text-[28px] sm:text-[36px]">Equipo de prueba</Titulo>
          <p className="m-0 max-w-[760px] text-lg text-muted-foreground">
            Registra a cada persona con su cédula y su wallet de la Test Wallet. Para enviarse dinero, uno crea un programa con su
            propia wallet (la que paga) y los demás cobran a su cuenta o en un punto.
          </p>
        </div>

        <div className="grid items-start gap-6 md:grid-cols-2">
          <FormPersona alRegistrar={() => void personas.recargar()} />
          <FormPunto alRegistrar={() => void puntos.recargar()} />
        </div>

        <ListaPersonas consulta={personas} />
        <ListaPuntos consulta={puntos} />
        <SeccionComercios consulta={comercios} />
      </main>
    </div>
  )
}

// ── Formularios ──────────────────────────────────────────────────────────────

function FormPersona({ alRegistrar }: { alRegistrar: () => void }) {
  const billetera = useBilletera()
  const [documento, setDocumento] = useState('')
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setOk(null)
    if (!/^\d{5,12}$/.test(documento)) return setError('Escribe la cédula sin puntos ni espacios (de 5 a 12 dígitos).')
    if (!billetera.valor.trim()) return setError('Escribe la wallet de la persona.')
    if (pin && !/^\d{4}$/.test(pin)) return setError('El PIN tiene 4 dígitos, o déjalo vacío.')
    setEnviando(true)
    setError(null)
    try {
      const cuerpo: PersonaEntrada = { documento, billetera: billetera.valor.trim(), pin: pin || undefined }
      const p = await api.post<PersonaRegistrada>('/beneficiarios', nombre.trim() ? { ...cuerpo, nombre: nombre.trim() } : cuerpo)
      setOk(`Registramos a ${p.nombre} con su wallet en ${p.moneda?.codigo ?? 'su moneda'}.`)
      setDocumento('')
      setNombre('')
      setPin('')
      billetera.limpiar()
      alRegistrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta aria-labelledby="titulo-persona">
      <form className="flex flex-col gap-4" onSubmit={(e) => void enviar(e)} noValidate>
        <h2 id="titulo-persona" className="m-0 flex items-center gap-2.5 text-xl font-bold">
          <UserPlus aria-hidden className="size-6" />
          Registrar persona
        </h2>
        <Campo
          etiqueta="Cédula"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1020304050"
          value={documento}
          onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
        />
        <Campo
          etiqueta="Wallet de la persona"
          mono
          autoComplete="off"
          spellCheck={false}
          placeholder="$ilp.interledger-test.dev/…"
          value={billetera.valor}
          onChange={(e) => billetera.cambiar(e.target.value)}
          onBlur={() => void billetera.buscar()}
          ayuda="La dirección de su wallet en la Test Wallet. Ahí le llega el dinero."
        />
        <AvisoBilletera estado={billetera.estado} />

        <details className="rounded-lg border border-border px-4 py-3 [&[open]>summary]:mb-3">
          <summary className="cursor-pointer text-[15px] font-bold">Opcional: nombre y PIN</summary>
          <div className="flex flex-wrap gap-4">
            <Campo
              className="flex-[2_1_200px]"
              etiqueta="Nombre"
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              ayuda="Si lo dejas vacío, usamos el de la wallet."
            />
            <Campo
              className="flex-[1_1_140px]"
              etiqueta="PIN (4 dígitos)"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              ayuda="Solo para cobrar en efectivo en un punto."
            />
          </div>
        </details>

        <MensajeError>{error}</MensajeError>
        {ok && <Exito>{ok}</Exito>}
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar persona'}
        </Button>
      </form>
    </Tarjeta>
  )
}

function FormPunto({ alRegistrar }: { alRegistrar: () => void }) {
  const billetera = useBilletera()
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setOk(null)
    if (nombre.trim().length < 3) return setError('Escribe el nombre del punto (3 letras o más).')
    if (!billetera.valor.trim()) return setError('Escribe la wallet del punto.')
    setEnviando(true)
    setError(null)
    try {
      const cuerpo: PuntoEntrada = { nombre: nombre.trim(), billetera: billetera.valor.trim(), direccion: direccion.trim() || undefined }
      const p = await api.post<Punto>('/puntos', cuerpo)
      setOk(`Agregamos el punto «${p.nombre}».`)
      setNombre('')
      setDireccion('')
      billetera.limpiar()
      alRegistrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta aria-labelledby="titulo-punto">
      <form className="flex flex-col gap-4" onSubmit={(e) => void enviar(e)} noValidate>
        <h2 id="titulo-punto" className="m-0 flex items-center gap-2.5 text-xl font-bold">
          <Store aria-hidden className="size-6" />
          Agregar punto de retiro
        </h2>
        <Campo etiqueta="Nombre del punto" autoComplete="off" placeholder="Tienda de Camila" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo
          etiqueta="Wallet del punto"
          mono
          autoComplete="off"
          spellCheck={false}
          placeholder="$ilp.interledger-test.dev/…"
          value={billetera.valor}
          onChange={(e) => billetera.cambiar(e.target.value)}
          onBlur={() => void billetera.buscar()}
          ayuda="Cuando entrega efectivo, el reembolso le llega aquí."
        />
        <AvisoBilletera estado={billetera.estado} />
        <Campo etiqueta="Dirección (opcional)" autoComplete="off" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        {ok && <Exito>{ok}</Exito>}
        <Button type="submit" size="lg" variant="outline" className="border-foreground" disabled={enviando}>
          {enviando ? 'Agregando…' : 'Agregar punto'}
        </Button>
      </form>
    </Tarjeta>
  )
}

// ── Listas ───────────────────────────────────────────────────────────────────



/** Fila que en el celular se apila y en PC se reparte en columnas. */
const FILA = 'grid gap-x-4 gap-y-1 px-4 py-3 md:items-center'

function ListaPersonas({ consulta }: { consulta: Consulta<PersonaRegistrada[]> }) {
  const navegar = useNavigate()
  const rol = useRol()
  const columnas = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto]'

  const entrar = (p: PersonaRegistrada) => {
    rol.actualizar({ rol: 'beneficiario', documento: p.documento, nombre: p.nombre.split(' ')[0] ?? p.nombre })
    navegar('/beneficiario')
  }

  return (
    <Tarjeta aria-labelledby="titulo-personas" className="gap-3 p-0 sm:p-0">
      <h2 id="titulo-personas" className="m-0 px-5 pt-5 text-xl font-bold sm:px-6">
        Personas registradas {consulta.datos && <span className="font-normal text-tenue">({consulta.datos.length})</span>}
      </h2>
      {consulta.error && (
        <div className="px-5 sm:px-6">
          <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />
        </div>
      )}
      {consulta.datos?.length === 0 && <p className="m-0 px-5 pb-5 text-tenue sm:px-6">Todavía no hay nadie. Registra a la primera persona arriba.</p>}
      {!!consulta.datos?.length && (
        <div role="table" aria-labelledby="titulo-personas" className="border-t border-border">
          <div role="row" className={cn(FILA, columnas, 'hidden bg-muted text-sm font-bold md:grid')}>
            <span role="columnheader">Persona</span>
            <span role="columnheader">Cédula</span>
            <span role="columnheader">Wallet</span>
            <span role="columnheader">Cuenta</span>
            <span role="columnheader">
              <span className="sr-only">Acciones</span>
            </span>
          </div>
          {consulta.datos.map((p) => (
            <div role="row" key={p.documento} className={cn(FILA, columnas, 'border-t border-border first:border-t-0 md:first:border-t')}>
              <span role="cell" className="font-bold">
                {p.nombre}
              </span>
              <span role="cell" className="mono text-sm text-muted-foreground">
                <span className="font-sans md:sr-only">C.C. </span>
                {p.documento}
              </span>
              <span role="cell" className="min-w-0">
                {p.billetera ? <BilleteraCorta url={p.billetera} completa className="text-[13px]" /> : <span className="text-tenue">Sin wallet</span>}
              </span>
              <span role="cell" className="flex flex-wrap items-center gap-1.5 text-sm">
                {p.estadoCuenta === 'Verificada' ? (
                  <span className="inline-flex items-center gap-1 text-pagado">
                    <Check aria-hidden className="size-4" strokeWidth={2.5} /> Lista
                  </span>
                ) : (
                  <span className="text-pagando">{p.estadoCuenta === 'PorVerificar' ? 'Por verificar' : 'Sin cuenta'}</span>
                )}
                {p.moneda && <Pastilla className="px-2 text-[13px]">{p.moneda.codigo}</Pastilla>}
                {p.tienePin && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground" title="Tiene PIN: puede cobrar en un punto">
                    <KeyRound aria-hidden className="size-3.5" /> PIN
                  </span>
                )}
              </span>
              <span role="cell" className="flex flex-wrap items-start gap-2 pt-2 md:justify-end md:pt-0">
                <Button variant="outline" size="sm" className="min-h-10" onClick={() => entrar(p)}>
                  Entrar como {p.nombre.split(' ')[0]}
                </Button>
                <PonerPin persona={p} alGuardar={() => void consulta.recargar()} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}

/** PIN para alguien ya registrado: sin él no puede retirar efectivo en un punto. */
function PonerPin({ persona, alGuardar }: { persona: PersonaRegistrada; alGuardar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!abierto) {
    return (
      <Button variant="outline" size="sm" className="min-h-10" onClick={() => setAbierto(true)}>
        <KeyRound aria-hidden className="size-4" />
        {persona.tienePin ? 'Cambiar PIN' : 'Poner PIN'}
      </Button>
    )
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(pin)) return setError('El PIN tiene 4 dígitos.')
    setEnviando(true)
    setError(null)
    try {
      await api.post(`/beneficiarios/${persona.documento}/pin`, { pin })
      setAbierto(false)
      setPin('')
      alGuardar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="flex basis-full flex-col gap-1.5" onSubmit={(e) => void guardar(e)} noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`pin-${persona.documento}`}>
          PIN de {persona.nombre}
        </label>
        <input
          id={`pin-${persona.documento}`}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="4 dígitos"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="mono min-h-10 w-28 rounded-lg border border-control px-3 text-base tracking-[4px]"
        />
        <Button type="submit" size="sm" className="min-h-10" disabled={enviando}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <MensajeError>{error}</MensajeError>
    </form>
  )
}

function ListaPuntos({ consulta }: { consulta: Consulta<Punto[]> }) {
  const navegar = useNavigate()
  const rol = useRol()
  const columnas = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_minmax(0,1fr)_auto]'

  const entrar = (p: Punto) => {
    rol.actualizar({ rol: 'punto', puntoId: p.id, puntoNombre: p.nombre })
    navegar('/punto')
  }

  return (
    <Tarjeta aria-labelledby="titulo-puntos" className="gap-3 p-0 sm:p-0">
      <h2 id="titulo-puntos" className="m-0 px-5 pt-5 text-xl font-bold sm:px-6">
        Puntos de retiro {consulta.datos && <span className="font-normal text-tenue">({consulta.datos.length})</span>}
      </h2>
      {consulta.error && (
        <div className="px-5 sm:px-6">
          <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />
        </div>
      )}
      {consulta.datos?.length === 0 && <p className="m-0 px-5 pb-5 text-tenue sm:px-6">Todavía no hay puntos. Son opcionales: solo hacen falta para cobrar en efectivo.</p>}
      {!!consulta.datos?.length && (
        <div role="table" aria-labelledby="titulo-puntos" className="border-t border-border">
          <div role="row" className={cn(FILA, columnas, 'hidden bg-muted text-sm font-bold md:grid')}>
            <span role="columnheader">Punto</span>
            <span role="columnheader">Wallet</span>
            <span role="columnheader">Dirección</span>
            <span role="columnheader">
              <span className="sr-only">Acciones</span>
            </span>
          </div>
          {consulta.datos.map((p) => (
            <div role="row" key={p.id} className={cn(FILA, columnas, 'border-t border-border first:border-t-0 md:first:border-t')}>
              <span role="cell" className="font-bold">
                {p.nombre}
              </span>
              <span role="cell" className="min-w-0">
                <BilleteraCorta url={p.billetera} completa className="text-[13px]" />
              </span>
              <span role="cell" className="text-sm text-muted-foreground">
                {p.direccion}
              </span>
              <span role="cell" className="pt-2 md:pt-0">
                <Button variant="outline" size="sm" className="min-h-10" onClick={() => entrar(p)}>
                  Entrar como punto
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}

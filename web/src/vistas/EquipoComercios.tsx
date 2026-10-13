import { Check, Store } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Categoria, Comercio, ComercioEntrada, Punto } from '@/api/tipos'
import { usePolling, type Consulta } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { ErrorCarga, MensajeError, Pastilla, Tarjeta } from '@/componentes/Comun'
import { AvisoBilletera, Exito, useBilletera } from '@/componentes/FormularioWallet'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'

/**
 * Comercios que aceptan bonos (Plan de ajustes § 11): se registran con su NIT y su actividad del
 * RUT, y la entidad los verifica. En producción la verificación cruza el RUT (DIAN) y el RUES; en el
 * piloto es un botón.
 */
export function SeccionComercios({ consulta }: { consulta: Consulta<Comercio[]> }) {
  const categorias = usePolling(() => api.get<Categoria[]>('/categorias'), null)
  return (
    <Tarjeta aria-labelledby="titulo-comercios" className="gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-comercios" className="m-0 flex items-center gap-2.5 text-xl font-bold">
          <Store aria-hidden className="size-6" />
          Comercios que aceptan bonos {consulta.datos && <span className="font-normal text-tenue">({consulta.datos.length})</span>}
        </h2>
        <p className="m-0 text-[15px] text-muted-foreground">
          El comercio se registra con su NIT y su actividad del RUT; la actividad define su categoría (alimentos, salud…). La entidad lo
          verifica antes de que acepte bonos: en producción, cruzando con el RUT de la DIAN y el RUES. Una cadena tiene varias sedes, cada
          una con su wallet.
        </p>
      </div>
      <FormComercio categorias={categorias.datos ?? []} alRegistrar={() => void consulta.recargar()} />
      {consulta.error && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {consulta.datos?.length === 0 && <p className="m-0 text-tenue">Todavía no hay comercios.</p>}
      <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
        {consulta.datos?.map((c) => (
          <li key={c.id}>
            <TarjetaComercio comercio={c} alCambiar={() => void consulta.recargar()} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

function FormComercio({ categorias, alRegistrar }: { categorias: Categoria[]; alRegistrar: () => void }) {
  const billetera = useBilletera()
  const [nit, setNit] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [ciiu, setCiiu] = useState('')
  const [sede, setSede] = useState('')
  const [direccion, setDireccion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setOk(null)
    if (!/^\d{5,15}$/.test(nit)) return setError('Escribe el NIT sin puntos, sin guion y sin el dígito de verificación.')
    if (razonSocial.trim().length < 3) return setError('Escribe la razón social, como aparece en el RUT.')
    if (!ciiu) return setError('Elige la actividad económica del RUT.')
    if (sede.trim().length < 3) return setError('Escribe el nombre de la sede (por ejemplo, «La Esquina · Centro»).')
    if (!billetera.valor.trim()) return setError('Escribe la wallet de la sede.')
    setEnviando(true)
    setError(null)
    try {
      const cuerpo: ComercioEntrada = {
        nit,
        razonSocial: razonSocial.trim(),
        ciiu,
        sede: { nombre: sede.trim(), direccion: direccion.trim() || undefined, billetera: billetera.valor.trim() },
      }
      const c = await api.post<Comercio>('/comercios', cuerpo)
      setOk(`Registramos «${c.razonSocial}» en ${c.categoriaNombre}. Queda por verificar.`)
      setNit('')
      setRazonSocial('')
      setCiiu('')
      setSede('')
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
    <details className="rounded-xl border border-border px-4 py-3 [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-[15px] font-bold">Registrar un comercio</summary>
      <form className="flex flex-col gap-4" onSubmit={(e) => void enviar(e)} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            etiqueta="NIT"
            inputMode="numeric"
            autoComplete="off"
            placeholder="900123456"
            value={nit}
            onChange={(e) => setNit(e.target.value.replace(/\D/g, ''))}
            ayuda="Sin el dígito de verificación."
          />
          <Campo etiqueta="Razón social" autoComplete="off" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Actividad económica (CIIU, del RUT)
          <select
            className="min-h-12 w-full rounded-lg border border-control bg-background px-3 text-base font-normal"
            value={ciiu}
            onChange={(e) => setCiiu(e.target.value)}
          >
            <option value="">Elige la actividad</option>
            {categorias.map((c) => (
              <optgroup key={c.id} label={c.nombre}>
                {c.actividades.map((a) => (
                  <option key={a.ciiu} value={a.ciiu}>
                    {a.ciiu} · {a.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Nombre de la sede" autoComplete="off" placeholder="La Esquina · Centro" value={sede} onChange={(e) => setSede(e.target.value)} />
          <Campo
            etiqueta="Dirección (opcional)"
            autoComplete="off"
            placeholder="Calle 10 # 11A-23"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>
        <Campo
          etiqueta="Wallet de la sede"
          mono
          autoComplete="off"
          spellCheck={false}
          placeholder="$ilp.interledger-test.dev/…"
          value={billetera.valor}
          onChange={(e) => billetera.cambiar(e.target.value)}
          onBlur={() => void billetera.buscar()}
          ayuda="Ahí le llega el pago de cada bono. Las sedes de una cadena pueden tener wallets de la misma cuenta."
        />
        <AvisoBilletera estado={billetera.estado} />
        <MensajeError>{error}</MensajeError>
        {ok && <Exito>{ok}</Exito>}
        <Button type="submit" variant="outline" className="self-start border-foreground" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar comercio'}
        </Button>
      </form>
    </details>
  )
}

function TarjetaComercio({ comercio: c, alCambiar }: { comercio: Comercio; alCambiar: () => void }) {
  const navegar = useNavigate()
  const rol = useRol()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevaSede, setNuevaSede] = useState(false)

  const verificar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await api.post(`/comercios/${c.id}/verificar`)
      alCambiar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const entrar = (s: Punto) => {
    rol.actualizar({ rol: 'punto', puntoId: s.id, puntoNombre: s.nombre })
    navegar('/punto')
  }

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="text-lg">{c.razonSocial}</strong>
          <span className="text-sm text-muted-foreground">
            NIT <span className="mono">{c.nit}</span> · CIIU {c.ciiu} · {c.categoriaNombre}
          </span>
        </div>
        {c.verificado ? (
          <Pastilla className="border-pagado text-pagado">
            <Check aria-hidden className="size-3.5" strokeWidth={3} /> Verificado
          </Pastilla>
        ) : (
          <Pastilla className="border-pagando text-pagando">Por verificar</Pastilla>
        )}
      </div>
      {!c.verificado && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
          <span>Mientras no esté verificado, no acepta bonos.</span>
          <Button size="sm" className="self-start" onClick={() => void verificar()} disabled={enviando}>
            Verificar (como la entidad)
          </Button>
          <span className="text-tenue">Simulado: en producción, la entidad cruza el NIT con el RUT (DIAN) y el RUES.</span>
        </div>
      )}
      <MensajeError>{error}</MensajeError>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {c.sedes.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="text-[15px]">{s.nombre}</strong>
              <span className="text-sm text-muted-foreground">{s.direccion}</span>
              <BilleteraCorta url={s.billetera} className="text-[13px] text-tenue" />
            </span>
            <Button variant="outline" size="sm" className="min-h-10" onClick={() => entrar(s)}>
              Entrar como esta sede
            </Button>
          </li>
        ))}
      </ul>
      {nuevaSede ? (
        <FormSede
          comercioId={c.id}
          alTerminar={() => {
            setNuevaSede(false)
            alCambiar()
          }}
          cancelar={() => setNuevaSede(false)}
        />
      ) : (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setNuevaSede(true)}>
          + Agregar sede
        </Button>
      )}
    </article>
  )
}

function FormSede({ comercioId, alTerminar, cancelar }: { comercioId: string; alTerminar: () => void; cancelar: () => void }) {
  const billetera = useBilletera()
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (nombre.trim().length < 3) return setError('Escribe el nombre de la sede.')
    if (!billetera.valor.trim()) return setError('Escribe la wallet de la sede.')
    setEnviando(true)
    setError(null)
    try {
      await api.post(`/comercios/${comercioId}/sedes`, { nombre: nombre.trim(), direccion: direccion.trim() || undefined, billetera: billetera.valor.trim() })
      alTerminar()
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={(e) => void enviar(e)} noValidate>
      <Campo etiqueta="Nombre de la sede" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo etiqueta="Dirección (opcional)" autoComplete="off" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
      <Campo
        etiqueta="Wallet de la sede"
        mono
        autoComplete="off"
        spellCheck={false}
        placeholder="$ilp.interledger-test.dev/…"
        value={billetera.valor}
        onChange={(e) => billetera.cambiar(e.target.value)}
        onBlur={() => void billetera.buscar()}
      />
      <AvisoBilletera estado={billetera.estado} />
      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          Agregar sede
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={cancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

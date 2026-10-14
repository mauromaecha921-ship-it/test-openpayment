import { KeyRound, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { api, mensajeDeError } from '@/api/client'
import type { LlaveBanco, PersonaRegistrada, TipoLlave } from '@/api/tipos'
import type { Consulta } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { ErrorCarga, MensajeError, Tarjeta } from '@/componentes/Comun'
import { Exito } from '@/componentes/FormularioWallet'
import { Button } from '@/componentes/ui/button'
import { NOMBRE_TIPO_LLAVE, textoLlave } from '@/lib/textos'
import { cn } from '@/lib/utils'

/** Todas las llaves del banco puente simulado de las personas registradas, en una lista. */
export async function leerLlaves(personas: PersonaRegistrada[]): Promise<LlaveBanco[]> {
  const listas = await Promise.all(personas.map((p) => api.get<LlaveBanco[]>(`/puente/llaves?documento=${encodeURIComponent(p.documento)}`)))
  return listas.flat()
}

const SELECT = 'min-h-12 w-full rounded-lg border border-control bg-background px-3 py-2.5 text-base text-foreground'
const FILA = 'grid gap-x-4 gap-y-1 px-4 py-3 md:items-center'
const AYUDA_VALOR: Record<TipoLlave, string> = {
  cedula: 'Solo la cédula de la misma persona.',
  celular: '10 dígitos que empiezan por 3.',
  correo: 'nombre@correo.com',
  alfanumerica: 'Empieza por @.',
}

/**
 * Plan Bre-B: «Equipo de prueba» hace de banco de cada persona y registra sus llaves en el banco
 * puente simulado, cada una apuntando a una wallet de la Test Wallet. Sirve para probar el «¿Eres…?»,
 * una llave de otra persona (RN-16) y una llave que cambia de wallet o se borra (RN-18).
 */
export function SeccionLlaves({ personas, llaves }: { personas: PersonaRegistrada[] | undefined; llaves: Consulta<LlaveBanco[]> }) {
  const [documento, setDocumento] = useState('')
  const [tipo, setTipo] = useState<TipoLlave>('celular')
  const [valor, setValor] = useState('')
  // null = la wallet de la persona elegida; un texto = la que escribió el equipo (para simular RN-18)
  const [billeteraEscrita, setBilleteraEscrita] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const nombreDe = (doc: string) => personas?.find((p) => p.documento === doc)?.nombre ?? doc
  // La wallet de la persona: la enlazada en Tatú o la de alguna de sus llaves
  const walletDe = (doc: string) => personas?.find((p) => p.documento === doc)?.billetera ?? llaves.datos?.find((l) => l.documentoTitular === doc)?.billetera ?? ''

  // Se calcula en cada render: así aparece aunque la lista de personas o de llaves llegue después
  const billetera = billeteraEscrita ?? (documento ? walletDe(documento) : '')

  const elegirPersona = (doc: string) => {
    setDocumento(doc)
    setBilleteraEscrita(null)
    if (tipo === 'cedula') setValor(doc)
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setOk(null)
    if (!documento) return setError('Elige a la persona.')
    const v = tipo === 'cedula' ? documento : valor.trim()
    if (!v) return setError('Escribe la llave.')
    if (!/^https:\/\//.test(billetera.trim())) return setError('Escribe la wallet en forma https://…')
    setEnviando(true)
    setError(null)
    try {
      const l = await api.post<LlaveBanco>('/puente/llaves', {
        tipo,
        valor: v,
        documentoTitular: documento,
        nombreTitular: nombreDe(documento),
        billetera: billetera.trim(),
      })
      setOk(`La llave ${textoLlave(l.tipo, l.valor)} de ${nombreDe(documento)} llega a …/${l.billetera.split('/').pop()}.`)
      setValor('')
      void llaves.recargar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const borrar = async (l: LlaveBanco) => {
    try {
      await api.borrar(`/puente/llaves/${l.tipo}/${encodeURIComponent(l.valor)}`)
      void llaves.recargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const columnas = 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_auto]'

  return (
    <Tarjeta aria-labelledby="titulo-llaves" className="gap-3 p-0 sm:p-0">
      <div className="flex flex-col gap-2 px-5 pt-5 sm:px-6">
        <h2 id="titulo-llaves" className="m-0 flex items-center gap-2.5 text-xl font-bold">
          <KeyRound aria-hidden className="size-6" />
          Llaves Bre-B (banco simulado)
        </h2>
        <p className="m-0 max-w-[760px] text-muted-foreground">
          Aquí el equipo hace de banco de cada persona: cada llave apunta a una wallet de la Test Wallet. Prueba el «¿Eres…?», una llave
          de otra persona o cambiar la wallet de una llave (el siguiente cobro llega a la nueva).
        </p>
      </div>

      <form className="flex flex-col gap-3 px-5 sm:px-6" onSubmit={(e) => void enviar(e)} noValidate>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">
            Persona
            <select className={SELECT} value={documento} onChange={(e) => elegirPersona(e.target.value)}>
              <option value="">Elige…</option>
              {personas?.map((p) => (
                <option key={p.documento} value={p.documento}>
                  {p.nombre} · {p.documento}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">
            Tipo de llave
            <select
              className={SELECT}
              value={tipo}
              onChange={(e) => {
                const t = e.target.value as TipoLlave
                setTipo(t)
                setValor(t === 'cedula' ? documento : '')
              }}
            >
              {(Object.keys(NOMBRE_TIPO_LLAVE) as TipoLlave[]).map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_TIPO_LLAVE[t]}
                </option>
              ))}
            </select>
          </label>
          <Campo
            etiqueta="Llave"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={tipo === 'cedula'}
            claseInput={cn(tipo === 'cedula' && 'bg-muted')}
            value={tipo === 'cedula' ? documento : valor}
            onChange={(e) => setValor(e.target.value)}
            ayuda={AYUDA_VALOR[tipo]}
          />
        </div>
        <Campo
          etiqueta="Wallet a la que llega"
          mono
          autoComplete="off"
          spellCheck={false}
          placeholder="https://ilp.interledger-test.dev/…"
          value={billetera}
          onChange={(e) => setBilleteraEscrita(e.target.value)}
          ayuda="Por defecto, la de la persona. Cámbiala para simular que movió su llave a otro banco."
        />
        <MensajeError>{error}</MensajeError>
        {ok && <Exito>{ok}</Exito>}
        <Button type="submit" variant="outline" className="self-start border-foreground" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar llave'}
        </Button>
      </form>

      {llaves.error && (
        <div className="px-5 sm:px-6">
          <ErrorCarga mensaje={llaves.error} reintentar={() => void llaves.recargar()} />
        </div>
      )}
      {llaves.datos?.length === 0 && <p className="m-0 px-5 pb-5 text-tenue sm:px-6">Todavía no hay llaves.</p>}
      {!!llaves.datos?.length && (
        <div role="table" aria-labelledby="titulo-llaves" className="border-t border-border">
          <div role="row" className={cn(FILA, columnas, 'hidden bg-muted text-sm font-bold md:grid')}>
            <span role="columnheader">Titular</span>
            <span role="columnheader">Llave</span>
            <span role="columnheader">Llega a</span>
            <span role="columnheader">
              <span className="sr-only">Acciones</span>
            </span>
          </div>
          {llaves.datos.map((l) => (
            <div role="row" key={`${l.tipo}:${l.valor}`} className={cn(FILA, columnas, 'border-t border-border first:border-t-0 md:first:border-t')}>
              <span role="cell" className="font-bold">
                {l.nombreTitular}
              </span>
              <span role="cell" className="mono text-sm">
                {textoLlave(l.tipo, l.valor)}
              </span>
              <span role="cell" className="min-w-0">
                <BilleteraCorta url={l.billetera} completa className="text-[13px]" />
              </span>
              <span role="cell" className="pt-2 md:pt-0">
                <Button variant="ghost" size="sm" className="min-h-10" onClick={() => void borrar(l)}>
                  <Trash2 aria-hidden className="size-4" />
                  Borrar
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}

import { Check, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Cobro } from '@/api/tipos'
import { usePolling, type Consulta } from '@/api/usePolling'
import { Cargando, ErrorCarga, ListaDatos, MensajeError } from '@/componentes/Comun'
import { CuentaRegresiva, useCuentaRegresiva } from '@/componentes/CuentaRegresiva'
import { EsperaPagando } from '@/componentes/EsperaPagando'
import { MarcoPunto } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { PasosDelPago } from '@/componentes/PasosDelPago'
import { TarjetaRechazo } from '@/componentes/TarjetaRechazo'
import { PuntosPin, TecladoPin } from '@/componentes/TecladoPin'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { esEstadoFinal, pantallaDelCobro } from '@/lib/pantallas'
import { formatSegundos, plural } from '@/lib/textos'
import { personaTexto } from '@/vistas/entidad/Tablero'
import { inicioPagando } from '@/vistas/beneficiario/CobroPagado'

/** Pantallas 15 a 19 en una sola ruta: la vista sale del estado del cobro que manda la API. */
export default function CobroEnPunto() {
  const { id = '' } = useParams()
  const config = useConfig()
  const consulta = usePolling(() => api.get<Cobro>(`/cobros/${id}`), config.pollIntervaloMs, (c) => !c || !esEstadoFinal(c.estado), { clave: id })
  const c = consulta.datos
  const pantalla = pantallaDelCobro(c?.estado)

  return (
    <MarcoPunto nav={false}>
      {!c && consulta.error && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {pantalla === 'cargando' && !consulta.error && <Cargando />}
      <div aria-live="polite" className="flex flex-1 flex-col gap-[18px]">
        {c && pantalla === 'confirmarPin' && <ConfirmarPin cobro={c} consulta={consulta} />}
        {c && pantalla === 'pagando' && <Pagando cobro={c} />}
        {c && pantalla === 'pagado' && <Pagado cobro={c} />}
        {c && pantalla === 'rechazo' && <Rechazo cobro={c} />}
      </div>
    </MarcoPunto>
  )
}

/** § 11: en una compra con bono, cuánto paga el cliente por fuera (total − lo que cubre el bono). */
function textoCompra(c: Cobro): string {
  if (!c.totalCompra || !c.monto) return 'compra con bono'
  const resto = (BigInt(c.totalCompra) - BigInt(c.monto)).toString()
  return resto === '0' ? 'el cliente no paga nada más' : `cobra ${textoMonto(resto, c.moneda)} al cliente`
}

function NuevoCobroBoton() {
  return (
    <Button asChild size="lg" className="mt-auto min-h-[60px] text-xl md:mt-2">
      <Link to="/punto">Nuevo cobro</Link>
    </Button>
  )
}

function ConfirmarPin({ cobro: c, consulta }: { cobro: Cobro; consulta: Consulta<Cobro> }) {
  // El PIN solo vive aquí: se envía una vez y se borra.
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restante = useCuentaRegresiva(c.confirmarAntesDe, () => void consulta.recargar())
  const nombre = c.persona.nombre ?? 'el beneficiario'
  const vencido = restante === 0

  const confirmar = async () => {
    if (pin.length !== 4) return
    const enviado = pin
    setPin('')
    setEnviando(true)
    setError(null)
    try {
      consulta.setDatos(await api.post<Cobro>(`/cobros/${c.id}/confirmar`, { pin: enviado }))
    } catch (e) {
      setError(mensajeDeError(e))
      if (e instanceof ErrorApi && e.status === 422) await consulta.recargar()
    } finally {
      setEnviando(false)
    }
  }

  const cancelar = async () => {
    setEnviando(true)
    try {
      consulta.setDatos(await api.post<Cobro>(`/cobros/${c.id}/cancelar`))
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <section className="flex flex-col gap-0.5 rounded-[14px] border border-control px-4 py-3.5">
        <span className="text-[15px] text-muted-foreground">{c.canal === 'compra' ? 'El bono cubre' : 'Pago disponible'}</span>
        <span className="text-[36px] leading-[1.1] font-bold">{textoMonto(c.monto, c.moneda)}</span>
        <span className="text-[15px]">{personaTexto(c)}</span>
        <span className="text-sm text-tenue">
          {c.canal === 'compra' ? `${c.programa.nombre} · ${textoCompra(c)}` : `${c.programa.nombre} · se entrega el valor completo`}
        </span>
      </section>

      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <span className="text-sm text-muted-foreground">Entrega el celular a {nombre}</span>
        <Titulo className="text-2xl">Digita tu PIN</Titulo>
        <PuntosPin largo={pin.length} />
        <span className="text-sm text-muted-foreground">
          {c.intentosRestantes !== null && `Te ${c.intentosRestantes === 1 ? 'queda' : 'quedan'} ${plural(c.intentosRestantes, 'intento')} · `}
          <CuentaRegresiva segundos={restante} />
        </span>
        <MensajeError>{error}</MensajeError>
      </div>

      <TecladoPin onChange={setPin} deshabilitado={enviando || vencido} />

      <Button size="lg" onClick={() => void confirmar()} disabled={pin.length !== 4 || enviando || vencido}>
        {enviando ? 'Confirmando…' : 'Confirmar'}
      </Button>
      <Button variant="link" className="min-h-11 self-center text-base font-normal text-enlace underline" onClick={() => void cancelar()} disabled={enviando}>
        Cancelar cobro
      </Button>
    </>
  )
}

function Pagando({ cobro: c }: { cobro: Cobro }) {
  return (
    <>
      <h1 className="sr-only">Pagando</h1>
      <div className="pt-2">
        <EsperaPagando desde={inicioPagando(c.eventos) ?? c.actualizado} paraPunto />
      </div>
      <PasosDelPago cobro={c} />
      <ListaDatos
        className="rounded-[14px] border border-border px-[18px] py-1"
        filas={[
          ['Persona', personaTexto(c)],
          ['Monto', textoMonto(c.monto, c.moneda)],
          ['Referencia', <span key="r" className="mono">{c.referencia}</span>],
        ]}
      />
    </>
  )
}

function Pagado({ cobro: c }: { cobro: Cobro }) {
  const monto = textoMonto(c.monto, c.moneda)
  return (
    <>
      <div role="status" className="flex flex-col items-center gap-2.5 pt-1 text-center">
        <span aria-hidden className="flex size-24 items-center justify-center rounded-full bg-pagado-relleno text-primary-foreground">
          <Check className="size-12" strokeWidth={3} />
        </span>
        <Titulo className="text-[34px]">Pagado</Titulo>
        <p className="m-0 text-[26px] leading-tight font-bold">
          {c.canal === 'compra' ? `El bono cubrió ${monto}. ${textoCompra(c)}` : `Entrega ${monto} a ${c.persona.nombre ?? 'la persona'}`}
        </p>
        <span className="mono text-muted-foreground">Ref. {c.referencia}</span>
      </div>
      <PasosDelPago cobro={c} />
      <section className="flex items-start gap-3.5 rounded-[14px] border border-control p-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Wallet className="size-[22px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <strong className="text-lg">{c.canal === 'compra' ? 'El pago del bono ya llegó' : 'Tu reembolso ya llegó'}</strong>
          <span className="text-muted-foreground">
            Recibiste {monto} en tu billetera
            {c.segundosHastaPagado !== null ? ` ${formatSegundos(c.segundosHastaPagado)} después del PIN` : ''}.
          </span>
          <span className="mono text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
            {c.punto?.billeteraCorta} · ref. {c.referencia}
          </span>
        </div>
      </section>
      <NuevoCobroBoton />
    </>
  )
}

function Rechazo({ cobro: c }: { cobro: Cobro }) {
  const codigo = c.motivo?.codigo
  return (
    <>
      <TarjetaRechazo
        cobro={c}
        paraPunto
        datos={
          <ListaDatos
            className="rounded-[14px] border border-border px-[18px] py-1"
            filas={[
              ['Cédula', personaTexto(c)],
              ['Programa', `${c.programa.nombre}${codigo === 'ProgramaCerrado' ? ' · Cerrado' : ''}`],
              c.estado === 'Fallido' && ['Monto', `${textoMonto(c.monto, c.moneda)}${c.persona.novedad ? ' · retroactivo' : ''}`],
              c.estado === 'Fallido' && ['Referencia', <span key="r" className="mono">{c.referencia}</span>],
              [c.estado === 'Fallido' ? 'Cobro' : 'Intento', c.estado],
            ]}
          />
        }
      />
      <NuevoCobroBoton />
    </>
  )
}

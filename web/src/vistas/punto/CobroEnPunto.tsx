import { Clock, Hand, TriangleAlert, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Cobro } from '@/api/tipos'
import { usePolling, type Consulta } from '@/api/usePolling'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { useCuentaRegresiva } from '@/componentes/CuentaRegresiva'
import { EsperaPagando } from '@/componentes/EsperaPagando'
import { PantallaPuntoEscritorio } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import {
  Boton,
  BotonEnlace,
  BotonVolver,
  CabeceraCelular,
  Caja,
  ChipCobro,
  CirculoCheck,
  claseEnlaceSuave,
  FilaDato,
  PantallaCelular,
  TituloPantalla,
} from '@/componentes/Proto'
import { PuntosPin, TecladoPin } from '@/componentes/TecladoPin'
import { esEstadoFinal, inicioPagando, pantallaDelCobro } from '@/lib/pantallas'
import { explicacionMotivo, formatCuentaRegresiva, formatSegundos, MOTIVO_CORTO } from '@/lib/textos'
import { useEscritorio } from '@/lib/useEscritorio'
import { personaTexto } from '@/vistas/entidad/Tablero'

// Prototipo P2 a P7 (celular) y PD2 a PD4 (computador), en una sola ruta: la pantalla sale del
// estado del cobro que manda la API.

export default function CobroEnPunto() {
  const { id = '' } = useParams()
  const config = useConfig()
  const escritorio = useEscritorio()
  const consulta = usePolling(() => api.get<Cobro>(`/cobros/${id}`), config.pollIntervaloMs, (c) => !c || !esEstadoFinal(c.estado), { clave: id })
  const c = consulta.datos
  const pantalla = pantallaDelCobro(c?.estado)

  if (!c) {
    const carga = consulta.error ? <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} /> : <Cargando />
    return escritorio ? <PantallaPuntoEscritorio>{carga}</PantallaPuntoEscritorio> : <PantallaCelular>{carga}</PantallaCelular>
  }
  return (
    <div aria-live="polite">
      {pantalla === 'confirmarPin' && <ConfirmarPin cobro={c} consulta={consulta} escritorio={escritorio} />}
      {pantalla === 'pagando' && <Pagando cobro={c} escritorio={escritorio} />}
      {pantalla === 'pagado' && <Pagado cobro={c} escritorio={escritorio} />}
      {pantalla === 'rechazo' && <Rechazo cobro={c} escritorio={escritorio} />}
    </div>
  )
}

/** § 11: en una compra con bono, cuánto paga el cliente por fuera (total − lo que cubre el bono). */
function textoCompra(c: Cobro): string {
  if (!c.totalCompra || !c.monto) return 'compra con bono'
  const resto = (BigInt(c.totalCompra) - BigInt(c.monto)).toString()
  return resto === '0' ? 'el cliente no paga nada más' : `cobra ${textoMonto(resto, c.moneda)} al cliente`
}

/** «Nuevo cobro» e «Ir al inicio», abajo en el celular. */
function AccionesFinales() {
  return (
    <div className="mt-auto flex flex-col gap-1">
      <BotonEnlace to="/punto/nuevo">Nuevo cobro</BotonEnlace>
      <Link to="/punto" className={claseEnlaceSuave()}>
        Ir al inicio
      </Link>
    </div>
  )
}

/** En el computador, «Nuevo cobro» en su tarjeta, con una nota debajo. */
function AccionesEscritorio({ nota }: { nota: string }) {
  return (
    <Caja grande className="flex-[1_1_300px]">
      <BotonEnlace to="/punto" medio className="min-h-14 w-full">
        Nuevo cobro
      </BotonEnlace>
      <span className="text-[15px] text-muted-foreground">{nota}</span>
    </Caja>
  )
}

// ── PIN (P2, P3, PD2) ─────────────────────────────────────────────────────────

function ConfirmarPin({ cobro: c, consulta, escritorio }: { cobro: Cobro; consulta: Consulta<Cobro>; escritorio: boolean }) {
  // El PIN solo vive aquí: se envía una vez y se borra.
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restante = useCuentaRegresiva(c.confirmarAntesDe, () => void consulta.recargar())
  const nombre = c.persona.nombre ?? 'el beneficiario'
  const vencido = restante === 0
  const monto = textoMonto(c.monto, c.moneda)

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

  /** Volver o «Cancelar cobro»: se cancela para que la cédula no quede con un cobro en curso. */
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

  const reloj = restante !== null && (
    <span className={escritorio ? 'inline-flex items-center gap-1.5 text-[17px] font-bold' : 'inline-flex items-center gap-[5px] text-[15px] font-bold'}>
      <Clock aria-hidden className={escritorio ? 'size-[18px]' : 'size-4'} strokeWidth={2} />
      <time aria-label={`${formatCuentaRegresiva(restante)} para confirmar`}>{formatCuentaRegresiva(restante)}</time>
    </span>
  )
  const alerta = error && (
    <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-rechazo-fondo px-3 py-2.5 text-base font-bold text-rechazo">
      <TriangleAlert aria-hidden className="size-5 flex-none" />
      {error.endsWith('.') ? error : `${error}.`}
    </div>
  )
  const titulo = c.persona.nombre ? `${c.persona.nombre}, digita tu PIN` : 'Digita tu PIN'
  const queCubre = c.canal === 'compra' ? `${c.programa.nombre} · el bono cubre` : `${c.programa.nombre} · valor completo`

  if (escritorio) {
    return (
      <PantallaPuntoEscritorio>
        <BotonVolver onClick={() => void cancelar()}>Pagos de {nombre}</BotonVolver>
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] text-muted-foreground">{personaTexto(c)}</span>
          <TituloPantalla className="text-[34px]">Confirmar con PIN</TituloPantalla>
        </div>
        <div className="flex flex-wrap items-stretch gap-6">
          <Caja grande className="flex-[1_1_360px]">
            <span className="text-base font-semibold text-muted-foreground">{c.canal === 'compra' ? 'El bono cubre' : 'Pago disponible'}</span>
            <span className="cifra text-[60px] leading-none [overflow-wrap:anywhere]">{monto}</span>
            <span className="text-base">{c.programa.nombre}</span>
            <span className="text-[15px] text-muted-foreground">{c.canal === 'compra' ? textoCompra(c) : 'Se entrega el valor completo.'}</span>
          </Caja>
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[18px] rounded-[20px] bg-ambar p-7 text-noche">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="titulo-proto text-[26px]">{titulo}</span>
              {reloj}
            </div>
            <PuntosPin largo={pin.length} grande error={Boolean(error)} />
            <span className="text-base leading-[1.45]">Pásale el teclado o gira la pantalla hacia {nombre}. Mientras digita, no mires el PIN.</span>
            {alerta}
            <TecladoPin onChange={setPin} deshabilitado={enviando || vencido} oculto />
            <div className="mt-1 flex flex-wrap gap-3">
              <Boton medio className="min-w-[200px]" onClick={() => void confirmar()} disabled={pin.length !== 4 || enviando || vencido}>
                {enviando ? 'Confirmando…' : 'Confirmar'}
              </Boton>
              <Boton medio variante="contorno" className="border-noche text-noche hover:bg-[#e5951a] hover:text-noche" onClick={() => void cancelar()} disabled={enviando}>
                Cancelar cobro
              </Boton>
            </div>
          </div>
        </div>
      </PantallaPuntoEscritorio>
    )
  }

  return (
    <PantallaCelular className="gap-[11px]">
      <CabeceraCelular alVolver={() => void cancelar()} etiquetaVolver="Cancelar y volver" titulo="Confirmar con PIN" subtitulo={personaTexto(c)} />
      <div className="flex flex-col gap-0.5 rounded-[18px] border-[1.5px] border-border bg-card px-4 py-3">
        <span className="text-sm font-semibold text-muted-foreground">{queCubre}</span>
        <span className="cifra text-[34px] leading-[1.05] [overflow-wrap:anywhere]">{monto}</span>
        {c.canal === 'compra' && <span className="text-sm text-muted-foreground">{textoCompra(c)}</span>}
      </div>
      <div className="flex flex-col gap-2.5 rounded-[18px] bg-ambar p-3.5 text-noche">
        <div className="flex items-center justify-between gap-2">
          <h1 className="m-0 text-lg font-extrabold">{titulo}</h1>
          {reloj}
        </div>
        <PuntosPin largo={pin.length} error={Boolean(error)} />
      </div>
      {alerta}
      <TecladoPin onChange={setPin} deshabilitado={enviando || vencido} />
      <Boton onClick={() => void confirmar()} disabled={pin.length !== 4 || enviando || vencido}>
        {enviando ? 'Confirmando…' : 'Confirmar'}
      </Boton>
      <button type="button" onClick={() => void cancelar()} disabled={enviando} className={`${claseEnlaceSuave()} border-0 bg-transparent`}>
        Cancelar cobro
      </button>
    </PantallaCelular>
  )
}

// ── Pagando (P4) ──────────────────────────────────────────────────────────────

function Pagando({ cobro: c, escritorio }: { cobro: Cobro; escritorio: boolean }) {
  const contenido = (
    <EsperaPagando desde={inicioPagando(c.eventos) ?? c.actualizado} paraPunto cobro={c}>
      Estamos pagando {textoMonto(c.monto, c.moneda)} desde la cuenta del programa a la billetera de tu {c.canal === 'compra' ? 'comercio' : 'tienda'}.
    </EsperaPagando>
  )
  if (escritorio) {
    return (
      <PantallaPuntoEscritorio>
        <BotonVolver to="/punto">Inicio</BotonVolver>
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] text-muted-foreground">{personaTexto(c)}</span>
          <TituloPantalla className="text-[34px]">Pagando</TituloPantalla>
        </div>
        <div className="flex max-w-[640px] flex-col gap-4">{contenido}</div>
      </PantallaPuntoEscritorio>
    )
  }
  return (
    <PantallaCelular>
      <CabeceraCelular volver="/punto" etiquetaVolver="Volver al inicio; el cobro sigue en curso" titulo="Pagando" subtitulo={personaTexto(c)} />
      <h1 className="sr-only">Pagando</h1>
      {contenido}
      <p className="m-0 mt-auto text-[15px] leading-[1.45] text-muted-foreground">Si vuelves al inicio, el cobro sigue en curso y lo encuentras en Cobros de hoy.</p>
    </PantallaCelular>
  )
}

// ── Pagado (P5, PD3) ──────────────────────────────────────────────────────────

function Reembolso({ cobro: c, grande = false }: { cobro: Cobro; grande?: boolean }) {
  const monto = textoMonto(c.monto, c.moneda)
  return (
    <div className={`flex items-center gap-3 ${grande ? '' : 'rounded-[18px] border-[1.5px] border-border bg-card px-4 py-3.5'}`}>
      <span aria-hidden className={`flex flex-none items-center justify-center rounded-xl bg-bloque text-bloque-texto ${grande ? 'size-12' : 'size-11'}`}>
        <Wallet className="size-[22px]" strokeWidth={2} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className={grande ? 'text-[19px] font-extrabold' : 'text-[17px] font-extrabold'}>{c.canal === 'compra' ? 'El pago del bono ya llegó' : 'Tu reembolso ya llegó'}</span>
        <span className={`text-muted-foreground ${grande ? 'text-base' : 'text-[15px]'}`}>
          {monto} en la billetera de tu {c.canal === 'compra' ? 'comercio' : 'tienda'}
          {c.segundosHastaPagado !== null ? `, ${formatSegundos(c.segundosHastaPagado)} después del PIN` : ''}.
        </span>
      </div>
    </div>
  )
}

function Pagado({ cobro: c, escritorio }: { cobro: Cobro; escritorio: boolean }) {
  const monto = textoMonto(c.monto, c.moneda)
  const aQuien = c.canal === 'compra' ? `El bono cubrió ${monto}` : `Entrega a ${c.persona.nombre ?? 'la persona'}`
  if (escritorio) {
    return (
      <PantallaPuntoEscritorio>
        <BotonVolver to="/punto">Inicio</BotonVolver>
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] text-muted-foreground">{personaTexto(c)}</span>
          <TituloPantalla className="text-[34px]">Resultado del cobro</TituloPantalla>
        </div>
        <div role="status" className="flex flex-wrap items-center gap-7 rounded-3xl bg-pagado-relleno p-8 text-white">
          <CirculoCheck grande />
          <div className="flex flex-[1_1_360px] flex-col gap-1.5">
            <span className="cifra text-[44px] leading-none">Pagado</span>
            <span className="text-xl font-semibold">{c.canal === 'compra' ? textoCompra(c) : aQuien}</span>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <span className="cifra text-[72px] leading-none [overflow-wrap:anywhere] max-sm:text-5xl">{monto}</span>
            <span className="text-[17px]">Referencia {c.referencia}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <Caja grande className="flex-[999_1_520px]">
            <Reembolso cobro={c} grande />
          </Caja>
          <AccionesEscritorio nota="El cobro ya aparece en Cobros de hoy." />
        </div>
      </PantallaPuntoEscritorio>
    )
  }
  return (
    <PantallaCelular>
      <CabeceraCelular volver="/punto" etiquetaVolver="Volver al inicio" titulo="Resultado del cobro" subtitulo={personaTexto(c)} />
      <div role="status" className="flex flex-col gap-1.5 rounded-[22px] bg-pagado-relleno p-5 text-white">
        <CirculoCheck />
        <TituloPantalla className="mt-1.5 text-[38px] leading-[1.05]">Pagado</TituloPantalla>
        <span className="text-lg font-semibold">{aQuien}</span>
        {c.canal === 'compra' ? (
          <span className="text-base">{textoCompra(c)}</span>
        ) : (
          <span className="cifra text-[44px] leading-none [overflow-wrap:anywhere]">{monto}</span>
        )}
        <span className="mt-1 text-base">Referencia {c.referencia}</span>
      </div>
      <Reembolso cobro={c} />
      <AccionesFinales />
    </PantallaCelular>
  )
}

// ── Rechazado o fallido (P6, P7, PD4) ─────────────────────────────────────────

function BloqueNoEntregues({ cobro: c, grande = false }: { cobro: Cobro; grande?: boolean }) {
  const compra = c.canal === 'compra'
  return (
    <div role="alert" className={`flex items-center bg-rechazo-relleno text-white ${grande ? 'flex-wrap gap-6 rounded-3xl p-8' : 'gap-3.5 rounded-[20px] p-[18px]'}`}>
      <Hand aria-hidden className={grande ? 'size-14 flex-none' : 'size-9 flex-none'} strokeWidth={2} />
      <div className={`flex flex-col ${grande ? 'flex-[1_1_420px] gap-1.5' : 'gap-0.5'}`}>
        <span className={grande ? 'cifra text-[40px] leading-[1.05]' : 'text-2xl font-extrabold'}>{compra ? 'El bono no se aplicó' : 'No entregues efectivo'}</span>
        <span className={grande ? 'text-xl' : 'text-base'}>{compra ? 'Cobra la compra completa por otro medio.' : 'No se movió dinero.'}</span>
      </div>
    </div>
  )
}

function Rechazo({ cobro: c, escritorio }: { cobro: Cobro; escritorio: boolean }) {
  const codigo = c.motivo?.codigo
  const titulo = c.motivo?.mensaje ?? (c.estado === 'Fallido' ? 'El pago falló' : 'El cobro fue rechazado')
  const datos: Array<[string, ReactNode]> = [
    ['Persona', personaTexto(c)],
    ['Programa', `${c.programa.nombre}${codigo === 'ProgramaCerrado' ? ' · Cerrado' : ''}`],
  ]
  if (c.monto) datos.push(['Valor solicitado', `${textoMonto(c.monto, c.moneda)}${c.persona.novedad ? ' · retroactivo' : ''}`])
  if (c.motivo) datos.push(['Motivo', MOTIVO_CORTO[c.motivo.codigo] ?? c.motivo.mensaje])
  if (c.estado === 'Fallido') datos.push(['Referencia', c.referencia])
  const chip = <ChipCobro estado={c.estado} motivo={c.motivo} conMotivo grande />

  if (escritorio) {
    return (
      <PantallaPuntoEscritorio>
        <BotonVolver to="/punto">Inicio</BotonVolver>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] text-muted-foreground">{personaTexto(c)}</span>
            <TituloPantalla className="text-[34px]">Resultado del cobro</TituloPantalla>
          </div>
          {chip}
        </div>
        <p className="m-0 text-lg font-bold">{titulo}</p>
        <BloqueNoEntregues cobro={c} grande />
        <div className="flex flex-wrap items-start gap-6">
          <Caja grande className="flex-[999_1_520px]">
            <h2 className="m-0 text-[21px] font-extrabold">Este intento</h2>
            {datos.map(([e, v]) => (
              <FilaDato key={e} etiqueta={e}>
                {v}
              </FilaDato>
            ))}
          </Caja>
          <AccionesEscritorio nota={explicacionMotivo(codigo, c.estado)} />
        </div>
      </PantallaPuntoEscritorio>
    )
  }
  return (
    <PantallaCelular className="gap-3.5">
      <CabeceraCelular volver="/punto" etiquetaVolver="Volver al inicio" titulo="Resultado del cobro" subtitulo={personaTexto(c)} />
      {chip}
      <TituloPantalla className="text-[27px]">{titulo}</TituloPantalla>
      <p className="m-0 text-[17px] leading-[1.45]">{explicacionMotivo(codigo, c.estado)}</p>
      <BloqueNoEntregues cobro={c} />
      <Caja>
        {datos.map(([e, v]) => (
          <FilaDato key={e} etiqueta={e}>
            {v}
          </FilaDato>
        ))}
      </Caja>
      <AccionesFinales />
    </PantallaCelular>
  )
}

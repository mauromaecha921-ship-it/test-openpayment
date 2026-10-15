import { ChevronRight, Clock, Lock, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router'

import { MensajeError } from '@/componentes/Comun'
import { PidiendoPago } from '@/componentes/EsperaPagando'
import { textoMonto } from '@/componentes/Monto'
import { AvisoArena, Boton, BotonVolver, CabeceraCelular, Chip, NotaGris, PantallaCelular, PasosCobroPunto } from '@/componentes/Proto'
import { PantallaPuntoEscritorio } from '@/componentes/MarcosProto'
import { useRol } from '@/contexto/Rol'
import { formatDiaMesCorto } from '@/lib/textos'
import { useEscritorio } from '@/lib/useEscritorio'

import { cifrasCaja, textoPagos, useConsultaCedula, useHoy, type ConsultaCedula } from './comun'

/** § 11: la caja de hoy de una sede de comercio, para «Venta con bono» (que no está en el prototipo). */
export function CajaDeHoy({ puntoId }: { puntoId: string | null }) {
  const { caja } = useHoy(puntoId)
  if (!caja.datos) return null
  const c = cifrasCaja(caja.datos)
  const comercio = caja.datos.punto.tipo === 'compra'
  return (
    <Link to="/punto/caja" aria-label="Ver mi caja" className="grid grid-cols-2 gap-2.5 text-bloque-texto no-underline hover:text-bloque-texto">
      <span className="bloque flex min-w-0 flex-col gap-0.5 rounded-2xl px-3.5 py-3">
        <span className="text-sm">{comercio ? 'Ventas con bono hoy' : 'Retiros pagados hoy'}</span>
        <span className="cifra text-2xl [overflow-wrap:anywhere]">{c.entregado}</span>
        <span className="text-[13px] text-noche-tenue">{comercio ? 'Ya te pagaron los bonos' : c.reembolsoTexto}</span>
      </span>
      <span className="bloque flex min-w-0 flex-col gap-0.5 rounded-2xl px-3.5 py-3">
        <span className="text-sm">{comercio ? 'Te pagaron los bonos' : 'Adelantado de tu caja'}</span>
        <span className="cifra text-2xl text-ambar [overflow-wrap:anywhere]">{comercio ? c.reembolsado : c.adelantado}</span>
        <span className="inline-flex items-center gap-1 text-[13px] text-noche-tenue">
          Mi caja <ChevronRight aria-hidden className="size-3.5" />
        </span>
      </span>
    </Link>
  )
}

/** El campo grande de la cédula: 68 px y 28 px de letra en el celular, 64 px en el computador. */
function CampoCedula({ consulta, escritorio = false }: { consulta: ConsultaCedula; escritorio?: boolean }) {
  return (
    <input
      id="cedula"
      inputMode="numeric"
      autoComplete="off"
      placeholder="Número de cédula"
      value={consulta.documento}
      aria-describedby="ayuda-cedula"
      aria-invalid={consulta.error ? true : undefined}
      onChange={(e) => consulta.cambiarDocumento(e.target.value)}
      className={
        escritorio
          ? 'box-border h-16 w-full rounded-[14px] border-2 border-foreground bg-campo px-4 text-[28px] font-bold tracking-[0.04em] text-foreground placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground'
          : 'box-border h-[68px] w-full rounded-[14px] border-2 border-foreground bg-card px-4 text-[28px] font-bold tracking-[0.04em] text-foreground placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground'
      }
    />
  )
}

/** Prototipo PD0, columna izquierda: el formulario de la cédula en el computador. */
export function FormCedulaEscritorio({ consulta }: { consulta: ConsultaCedula }) {
  return (
    <form
      className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 rounded-[20px] border-[1.5px] border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault()
        void consulta.consultar()
      }}
    >
      <h2 className="titulo-proto m-0 text-2xl">Nuevo cobro</h2>
      <label htmlFor="cedula" className="text-[17px] font-bold">
        Número de cédula
      </label>
      <span id="ayuda-cedula" className="-mt-2.5 text-[15px] text-muted-foreground">
        Pide la cédula original y digita el número.
      </span>
      <CampoCedula consulta={consulta} escritorio />
      <MensajeError>{consulta.error}</MensajeError>
      {consulta.pidiendo ? (
        <PidiendoPago />
      ) : (
        <Boton type="submit" medio className="min-h-14 w-full text-lg" disabled={consulta.enviando}>
          {consulta.enviando ? 'Consultando…' : 'Consultar'}
        </Boton>
      )}
      <AvisoArena icono={ShieldCheck} className="rounded-[14px] text-[15px]">
        Entrega efectivo solo cuando la pantalla diga Pagado. La cédula sola no autoriza el cobro.
      </AvisoArena>
    </form>
  )
}

/** Una tarjeta de pago de la cédula (P1b / PD1). */
function TarjetaPago({ consulta, i, escritorio }: { consulta: ConsultaCedula; i: number; escritorio: boolean }) {
  const p = consulta.opciones!.pagos[i]!
  const pausado = p.programa.estado === 'Pausado'
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={escritorio ? 'text-[19px] font-extrabold' : 'text-[17px] font-extrabold'}>{p.programa.nombre}</span>
          <span className={escritorio ? 'text-[15px] text-muted-foreground' : 'text-sm text-muted-foreground'}>Hasta el {formatDiaMesCorto(p.vigenciaFin)}</span>
        </div>
        {pausado ? (
          <Chip tono="neutro">En pausa</Chip>
        ) : (
          <Chip tono="disponible" icono={Clock}>
            Disponible
          </Chip>
        )}
      </div>
      <span className={escritorio ? 'cifra text-[44px] leading-[1.05]' : 'cifra text-[32px] leading-[1.05]'}>{textoMonto(p.monto, p.moneda)}</span>
      {escritorio ? (
        <>
          <span className="text-[15px] text-muted-foreground">Se entrega el valor completo</span>
          <Boton medio onClick={() => void consulta.pedir(p.programa.id)} disabled={consulta.enviando || pausado}>
            Pagar este subsidio
          </Boton>
        </>
      ) : (
        <span className="flex items-center justify-between gap-2.5">
          <span className="text-[15px] text-muted-foreground">Se entrega el valor completo</span>
          <span className="inline-flex items-center gap-1 text-base font-bold text-azul">
            Pagar <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2.4} />
          </span>
        </span>
      )}
    </>
  )
  if (escritorio) {
    return <div className="flex flex-[1_1_360px] flex-col gap-2.5 rounded-[20px] border-2 border-foreground bg-card p-[22px]">{contenido}</div>
  }
  return (
    <button
      type="button"
      onClick={() => void consulta.pedir(p.programa.id)}
      disabled={consulta.enviando || pausado}
      className="flex w-full flex-col gap-2 rounded-[18px] border-2 border-foreground bg-card p-4 text-left text-foreground disabled:opacity-60"
    >
      {contenido}
    </button>
  )
}

/** Prototipo PD1: los pagos de la cédula en el computador. */
export function PagosEscritorio({ consulta }: { consulta: ConsultaCedula }) {
  const o = consulta.opciones!
  return (
    <PantallaPuntoEscritorio>
      <BotonVolver onClick={consulta.volver}>Nuevo cobro</BotonVolver>
      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] text-muted-foreground">{o.persona.etiqueta}</span>
        <h1 className="titulo-proto m-0 text-[34px]">Pagos de {o.persona.nombre}</h1>
      </div>
      <p className="m-0 text-lg">
        Tiene <b>{textoPagos(o.pagos.length)}</b>. Cada retiro paga un subsidio completo; antes del PIN no se mueve dinero.
      </p>
      <MensajeError>{consulta.error}</MensajeError>
      {consulta.pidiendo ? (
        <div className="max-w-[520px]">
          <PidiendoPago />
        </div>
      ) : (
        <div className="flex flex-wrap gap-5">
          {o.pagos.map((p, i) => (
            <TarjetaPago key={p.programa.id} consulta={consulta} i={i} escritorio />
          ))}
        </div>
      )}
    </PantallaPuntoEscritorio>
  )
}

/** Prototipo P1 y P1b: «Nuevo cobro» en el celular (en el computador va dentro del inicio, PD0). */
export default function NuevoCobro() {
  const { puntoId, puntoNombre } = useRol()
  const escritorio = useEscritorio()
  const consulta = useConsultaCedula(puntoId)
  const o = consulta.opciones

  if (escritorio) return o ? <PagosEscritorio consulta={consulta} /> : <Navigate to="/punto" replace />

  if (o) {
    return (
      <PantallaCelular>
        <CabeceraCelular alVolver={consulta.volver} titulo="Pagos de esta cédula" subtitulo={`${o.persona.nombre} · ${o.persona.etiqueta}`} />
        <PasosCobroPunto paso="Pago" />
        <h1 className="sr-only">Pagos de esta cédula</h1>
        <p className="m-0 mt-1 text-[17px] leading-[1.4]">
          Tiene <b>{textoPagos(o.pagos.length)}</b>. Cada retiro paga un subsidio completo.
        </p>
        <MensajeError>{consulta.error}</MensajeError>
        {consulta.pidiendo ? (
          <PidiendoPago />
        ) : (
          o.pagos.map((p, i) => <TarjetaPago key={p.programa.id} consulta={consulta} i={i} escritorio={false} />)
        )}
        <NotaGris icono={Lock} className="mt-auto">
          Al elegir un pago, {o.persona.nombre} confirma con su PIN. Antes de eso no se mueve dinero.
        </NotaGris>
      </PantallaCelular>
    )
  }

  return (
    <PantallaCelular>
      <CabeceraCelular volver="/punto" titulo="Nuevo cobro" subtitulo={puntoNombre?.split(' — ')[0]} />
      <PasosCobroPunto paso="Cédula" />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void consulta.consultar()
        }}
      >
        <div className="mt-2 flex flex-col gap-2">
          <h1 className="m-0 text-xl font-extrabold">
            <label htmlFor="cedula">Número de cédula</label>
          </h1>
          <span id="ayuda-cedula" className="text-base text-muted-foreground">
            Pide la cédula original y digita el número.
          </span>
          <CampoCedula consulta={consulta} />
        </div>
        <MensajeError>{consulta.error}</MensajeError>
        {consulta.pidiendo ? (
          <PidiendoPago />
        ) : (
          <Boton type="submit" disabled={consulta.enviando}>
            {consulta.enviando ? 'Consultando…' : 'Consultar'}
          </Boton>
        )}
      </form>
      <AvisoArena icono={ShieldCheck} className="mt-auto">
        La cédula sola no autoriza el cobro: el beneficiario confirma con su PIN en este celular.
      </AvisoArena>
    </PantallaCelular>
  )
}

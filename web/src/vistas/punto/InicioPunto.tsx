import { Plus, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando } from '@/componentes/Comun'
import { PantallaPuntoEscritorio } from '@/componentes/MarcosProto'
import { AvisoArena, BotonEnlace, CabeceraCelular, PantallaCelular, TarjetaCifra } from '@/componentes/Proto'
import { useRol } from '@/contexto/Rol'
import { plural } from '@/lib/textos'
import { useEscritorio } from '@/lib/useEscritorio'

import { cifrasCaja, ListaCobrosHoy, TablaCobrosHoy, useConsultaCedula, useHoy } from './comun'
import { FormCedulaEscritorio, PagosEscritorio } from './NuevoCobro'
import VentaConBono from './VentaConBono'

/** Prototipo P0: el inicio del punto en el celular. */
function InicioCelular({ puntoId, nombre }: { puntoId: string | null; nombre: string }) {
  const { caja, cobros } = useHoy(puntoId)
  const c = cifrasCaja(caja.datos)
  return (
    <PantallaCelular className="gap-3.5">
      <CabeceraCelular volver="/" etiquetaVolver="Volver a elegir rol" marca />
      <div className="-mt-1.5 text-[15px] text-muted-foreground">{nombre} · Punto de retiro</div>
      <h1 className="sr-only">Inicio del punto</h1>
      <Link to="/punto/caja" aria-label="Ver mi caja" className="grid grid-cols-2 gap-2.5 text-bloque-texto no-underline hover:text-bloque-texto">
        <span className="bloque flex min-w-0 flex-col gap-0.5 rounded-2xl px-3.5 py-3">
          <span className="text-sm">Retiros pagados hoy</span>
          <span className="cifra text-2xl [overflow-wrap:anywhere]">{c.entregado}</span>
          <span className="text-[13px] text-noche-tenue">{c.reembolsoTexto}</span>
        </span>
        <span className="bloque flex min-w-0 flex-col gap-0.5 rounded-2xl px-3.5 py-3">
          <span className="text-sm">Adelantado de tu caja</span>
          <span className="cifra text-2xl text-ambar [overflow-wrap:anywhere]">{c.adelantado}</span>
          <span className="text-[13px] text-noche-tenue">{c.adelantadoTexto}</span>
        </span>
      </Link>
      <BotonEnlace to="/punto/nuevo">
        <Plus aria-hidden className="size-[22px]" strokeWidth={2.6} />
        Nuevo cobro
      </BotonEnlace>
      <section aria-labelledby="titulo-hoy" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between">
          <h2 id="titulo-hoy" className="m-0 text-lg font-extrabold">
            Cobros de hoy
          </h2>
          {cobros.datos && <span className="text-sm text-muted-foreground">{plural(cobros.datos.length, 'cobro')}</span>}
        </div>
        <ListaCobrosHoy cobros={cobros.datos} cargando={cobros.cargando} />
      </section>
      <AvisoArena icono={ShieldCheck} className="items-center rounded-[14px] px-3.5 py-3 text-[15px] leading-[1.35]">
        Entrega efectivo solo cuando la pantalla diga Pagado.
      </AvisoArena>
    </PantallaCelular>
  )
}

/** Prototipo PD0: el inicio del punto en el computador, con el nuevo cobro al lado de los cobros de hoy. */
function InicioEscritorio({ puntoId, nombre }: { puntoId: string | null; nombre: string }) {
  const { caja, cobros } = useHoy(puntoId)
  const consulta = useConsultaCedula(puntoId)
  const c = cifrasCaja(caja.datos)
  if (consulta.opciones) return <PagosEscritorio consulta={consulta} />
  return (
    <PantallaPuntoEscritorio volver={{ to: '/', texto: 'Elegir rol' }} subtitulo="Punto de retiro" titulo={nombre}>
      <div className="flex flex-wrap gap-4">
        <TarjetaCifra etiqueta="Retiros pagados hoy" apoyo={plural(c.pagados, 'retiro')}>
          {c.entregado}
        </TarjetaCifra>
        <TarjetaCifra etiqueta="Te reembolsaron" apoyo={c.reembolsoTexto === 'Ya te reembolsaron todo' ? 'Todo lo pagado ya está en tu billetera' : c.reembolsoTexto}>
          {c.reembolsado}
        </TarjetaCifra>
        <TarjetaCifra etiqueta="Adelantado de tu caja" apoyo={c.adelantadoTexto} noche>
          {c.adelantado}
        </TarjetaCifra>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <FormCedulaEscritorio consulta={consulta} />
        <section aria-labelledby="titulo-hoy" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-[20px] border-[1.5px] border-border bg-card p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="titulo-hoy" className="m-0 text-[21px] font-extrabold">
              Cobros de hoy
            </h2>
            {cobros.datos && (
              <span className="text-[15px] text-muted-foreground">
                {plural(cobros.datos.length, 'cobro')} · {c.enCurso} en curso
              </span>
            )}
          </div>
          <TablaCobrosHoy cobros={cobros.datos} cargando={cobros.cargando} />
        </section>
      </div>
    </PantallaPuntoEscritorio>
  )
}

/**
 * La pantalla de inicio del punto depende de su tipo (§ 11): un punto de retiro entrega efectivo de
 * subsidios (P0 en el celular, PD0 en el computador); la sede de un comercio cobra compras con bono
 * («Venta con bono», que no está en el prototipo).
 */
export default function InicioPunto() {
  const { puntoId, puntoNombre } = useRol()
  const escritorio = useEscritorio()
  const puntos = usePolling(() => api.get<Punto[]>('/puntos'), null, false, { clave: puntoId })
  if (!puntos.datos && !puntos.error) {
    return escritorio ? (
      <PantallaPuntoEscritorio>
        <Cargando />
      </PantallaPuntoEscritorio>
    ) : (
      <PantallaCelular>
        <Cargando />
      </PantallaCelular>
    )
  }
  const punto = puntos.datos?.find((p) => p.id === puntoId)
  if (punto?.tipo === 'compra') return <VentaConBono />
  const nombre = (punto?.nombre ?? puntoNombre ?? 'Punto de retiro').split(' — ')[0]
  return escritorio ? <InicioEscritorio puntoId={puntoId} nombre={nombre} /> : <InicioCelular puntoId={puntoId} nombre={nombre} />
}

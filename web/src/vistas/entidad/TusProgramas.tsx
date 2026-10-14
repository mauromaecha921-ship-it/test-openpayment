import { Check, ChevronRight, Clock, Lock, Pause, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { api } from '@/api/client'
import type { Liquidacion, Programa, Tablero } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { PantallaEntidad } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import { BotonEnlace, Chip, TarjetaCifra } from '@/componentes/Proto'
import { sumarMontos } from '@/lib/montos'
import { rutaDelPrograma } from '@/lib/pantallas'
import { formatVigencia, plural } from '@/lib/textos'

// Prototipo E0 «Tus programas»: las cifras de todos los programas y una fila por programa.

interface Fila {
  programa: Programa
  tablero: Tablero | null
  liquidacion: Liquidacion | null
}

/** El chip del estado del programa, con los colores del prototipo. */
export function ChipPrograma({ estado, grande = false }: { estado: Programa['estado']; grande?: boolean }) {
  if (estado === 'Activo')
    return (
      <Chip tono="activo" icono={Check} grande={grande}>
        Activo
      </Chip>
    )
  if (estado === 'Pausado')
    return (
      <Chip tono="pagando" icono={Pause} grande={grande}>
        Pausado
      </Chip>
    )
  if (estado === 'EsperandoAprobacion')
    return (
      <Chip tono="disponible" icono={Clock} grande={grande}>
        Esperando aprobación
      </Chip>
    )
  if (estado === 'Cerrado')
    return (
      <Chip tono="cerrado" icono={Lock} grande={grande}>
        Cerrado
      </Chip>
    )
  return (
    <Chip tono="neutro" grande={grande}>
      Borrador
    </Chip>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{etiqueta}</div>
      <div className="text-[22px] font-extrabold">{valor}</div>
    </div>
  )
}

export default function TusProgramas() {
  const consulta = usePolling<Fila[]>(async () => {
    const programas = await api.get<Programa[]>('/programas')
    return Promise.all(
      programas.map(async (programa) => {
        const conTablero = programa.estado !== 'Borrador' && programa.estado !== 'EsperandoAprobacion'
        const [tablero, liquidacion] = await Promise.all([
          conTablero ? api.get<Tablero>(`/programas/${programa.id}/tablero`).catch(() => null) : Promise.resolve(null),
          api.get<Liquidacion>(`/programas/${programa.id}/liquidacion`).catch(() => null),
        ])
        return { programa, tablero, liquidacion }
      }),
    )
  }, 10_000)
  const filas = consulta.datos
  const moneda = filas?.[0]?.programa.moneda
  const conTablero = filas?.filter((f) => f.tablero) ?? []
  const suma = (k: 'cobrado' | 'giradoPorAdelantado') => (moneda ? textoMonto(sumarMontos('0', ...conTablero.map((f) => f.tablero![k])), moneda) : '$0')

  return (
    <PantallaEntidad
      subtitulo="Entidad de prueba"
      titulo="Tus programas"
      acciones={
        <BotonEnlace to="/entidad/programas/nuevo" medio>
          <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          Nuevo programa
        </BotonEnlace>
      }
    >
      {!filas && consulta.error && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {!filas && !consulta.error && <Cargando />}
      {filas && (
        <>
          <div className="flex flex-wrap gap-4">
            <TarjetaCifra etiqueta="Programas activos">{filas.filter((f) => f.programa.estado === 'Activo').length}</TarjetaCifra>
            <TarjetaCifra etiqueta="Cobrado" apoyo="En todos tus programas">
              {suma('cobrado')}
            </TarjetaCifra>
            <TarjetaCifra etiqueta="Girado por adelantado" apoyo="La plata sale solo cuando alguien cobra" noche>
              {suma('giradoPorAdelantado')}
            </TarjetaCifra>
          </div>

          <section aria-labelledby="titulo-programas" className="flex flex-col gap-3">
            <h2 id="titulo-programas" className="m-0 text-[21px] font-extrabold">
              Programas
            </h2>
            {filas.length === 0 && (
              <p className="m-0 rounded-[18px] border-[1.5px] border-dashed border-border p-5 text-center text-muted-foreground">
                Todavía no tienes programas. Crea el primero con «Nuevo programa».
              </p>
            )}
            {[...filas].reverse().map(({ programa: p, tablero: t, liquidacion: l }) => {
              const sinAprobar = !t
              const detalle =
                p.estado === 'Borrador'
                  ? 'sin aprobar'
                  : p.estado === 'EsperandoAprobacion'
                    ? 'esperando tu banco'
                    : l
                      ? plural(l.cedulas, 'beneficiario')
                      : ''
              return (
                <Link
                  key={p.id}
                  to={rutaDelPrograma(p.id, p.estado)}
                  className="grid grid-cols-[minmax(220px,2fr)_repeat(3,minmax(120px,1fr))_auto] items-center gap-4 rounded-[18px] border-[1.5px] border-border bg-card px-5 py-[18px] text-foreground no-underline hover:border-control hover:text-foreground max-[880px]:grid-cols-3 max-[880px]:[&>:first-child]:col-span-full max-[880px]:[&>:last-child]:col-span-full"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[19px] font-extrabold">{p.nombre}</span>
                    <span className="text-[15px] text-muted-foreground">
                      {formatVigencia(p.vigenciaInicio, p.vigenciaFin)}
                      {detalle && ` · ${detalle}`}
                    </span>
                    <ChipPrograma estado={p.estado} />
                  </div>
                  <Dato etiqueta="Autorizado" valor={sinAprobar ? '—' : textoMonto(t.autorizado, p.moneda)} />
                  <Dato etiqueta="Cobrado" valor={sinAprobar ? '—' : textoMonto(t.cobrado, p.moneda)} />
                  <Dato etiqueta="Todavía no ha salido" valor={sinAprobar ? '—' : textoMonto(t.noHaSalido, p.moneda)} />
                  <span className="inline-flex items-center gap-1.5 text-base font-bold text-azul">
                    {p.estado === 'Borrador' || p.estado === 'EsperandoAprobacion' ? 'Continuar' : p.estado === 'Cerrado' ? 'Ver cierre' : 'Ver tablero'}
                    <ChevronRight aria-hidden className="size-5" strokeWidth={2.4} />
                  </span>
                </Link>
              )
            })}
          </section>
        </>
      )}
    </PantallaEntidad>
  )
}

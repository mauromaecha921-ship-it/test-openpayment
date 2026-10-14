import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { api, API_SIMULADA } from '@/api/client'
import type { Programa, Tablero } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { formatFecha, NOMBRE_ESTADO_PROGRAMA } from '@/lib/textos'
import type { Moneda } from '@/lib/montos'
import { rutaDelPrograma } from '@/lib/pantallas'
import { cn } from '@/lib/utils'

interface Fila {
  programa: Programa
  tablero: Tablero | null
}

/** Autorizado y cobrado solo existen cuando el permiso ya se aprobó. */
const conPermiso = (p: Programa) => p.estado === 'Activo' || p.estado === 'Pausado' || p.estado === 'Cerrado'

function Estado({ estado }: { estado: Programa['estado'] }) {
  const clase =
    estado === 'Activo'
      ? 'bg-primary text-primary-foreground font-bold'
      : estado === 'Pausado' || estado === 'EsperandoAprobacion'
        ? 'border-2 border-pagando bg-pagando-fondo text-pagando font-bold'
        : 'bg-secondary text-muted-foreground font-bold'
  return <span className={cn('self-start rounded-full px-2.5 py-1 text-[13px]', clase)}>{NOMBRE_ESTADO_PROGRAMA[estado]}</span>
}

/** Pantalla E0 del prototipo: tus programas, con lo cobrado y lo que no ha salido de cada uno. */
export default function ListaProgramas() {
  const { datos, error, recargar } = usePolling<Fila[]>(
    async () => {
      const programas = await api.get<Programa[]>('/programas')
      return Promise.all(
        programas.map(async (programa) => ({
          programa,
          tablero: conPermiso(programa) ? await api.get<Tablero>(`/programas/${programa.id}/tablero`).catch(() => null) : null,
        })),
      )
    },
    5000,
  )

  // Solo en la API simulada: el escenario de la demo (programa Activo con cobros y un borrador)
  const cargarDatosDePrueba = async () => {
    const m = await import('@/api/simulada/servidor')
    m.cargarEscenarioDemo()
    await recargar()
  }

  const filas = datos ?? []
  const moneda: Moneda = filas[0]?.programa.moneda ?? { codigo: 'COP', escala: 2 }
  const activos = filas.filter((f) => f.programa.estado === 'Activo').length
  const suma = (campo: 'cobrado' | 'giradoPorAdelantado') =>
    filas.reduce((n, f) => n + BigInt(f.tablero?.[campo] ?? '0'), 0n).toString()

  return (
    <MarcoEntidad entidad={filas[0]?.programa.entidad}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-tenue">{filas[0]?.programa.entidad ?? 'Entidad de prueba'}</span>
          <Titulo className="text-[28px] sm:text-[32px]">Tus programas</Titulo>
        </div>
        <Button asChild>
          <Link to="/entidad/programas/nuevo">
            <Plus aria-hidden />
            Nuevo programa
          </Link>
        </Button>
      </div>

      {error && !datos && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!datos && !error && <Cargando />}

      {datos && (
        <>
          <div className="flex flex-wrap gap-4">
            <section className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl border border-border bg-card px-[22px] py-5">
              <h2 className="m-0 text-base font-bold">Programas activos</h2>
              <span className="cifra text-[34px] sm:text-[38px]">{activos}</span>
            </section>
            <section className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl border border-border bg-card px-[22px] py-5">
              <h2 className="m-0 text-base font-bold">Cobrado</h2>
              <span className="cifra text-[34px] [overflow-wrap:anywhere] sm:text-[38px]">{textoMonto(suma('cobrado'), moneda)}</span>
              <span className="text-sm text-tenue">En todos tus programas</span>
            </section>
            <section className="bloque flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl px-[22px] py-5">
              <h2 className="m-0 text-base font-bold">Girado por adelantado</h2>
              <span className="cifra text-[34px] text-ambar sm:text-[38px]">{textoMonto(suma('giradoPorAdelantado'), moneda)}</span>
              <span className="text-sm text-noche-tenue">La plata sale solo cuando alguien cobra</span>
            </section>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-xl font-bold">Programas</h2>
            {filas.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-border px-4 py-4 text-tenue">
                <span>Todavía no hay programas. Crea el primero.</span>
                {API_SIMULADA && (
                  <Button variant="outline" className="border-foreground text-foreground" onClick={() => void cargarDatosDePrueba()}>
                    Cargar datos de prueba
                  </Button>
                )}
              </div>
            )}
            {filas.map(({ programa: p, tablero: t }) => (
              <Link
                key={p.id}
                to={rutaDelPrograma(p.id, p.estado)}
                className="grid grid-cols-1 items-center gap-4 rounded-[18px] border border-border bg-card px-5 py-[18px] text-foreground no-underline hover:border-control hover:text-foreground md:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(120px,1fr))_auto]"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-[19px] font-bold">{p.nombre}</span>
                  <span className="text-[15px] text-tenue">
                    {formatFecha(p.vigenciaInicio)} al {formatFecha(p.vigenciaFin)}
                    {!conPermiso(p) && ' · sin aprobar'}
                  </span>
                  <Estado estado={p.estado} />
                </div>
                {(
                  [
                    ['Autorizado', t?.autorizado],
                    ['Cobrado', t?.cobrado],
                    ['Todavía no ha salido', t?.noHaSalido],
                  ] as const
                ).map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <div className="text-sm text-tenue">{etiqueta}</div>
                    <div className="text-[22px] font-bold">{valor ? textoMonto(valor, p.moneda) : '—'}</div>
                  </div>
                ))}
                <span className="inline-flex items-center gap-1.5 font-bold text-enlace">
                  {conPermiso(p) ? 'Ver tablero' : 'Continuar'}
                  <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2.4} />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </MarcoEntidad>
  )
}

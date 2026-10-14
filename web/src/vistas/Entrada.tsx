import { Building2, ChevronRight, Monitor, Store, TriangleAlert, User } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, API_SIMULADA } from '@/api/client'
import { useEstadoSistema } from '@/api/estado'
import type { BeneficiarioDemo, Programa, Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { ErrorCarga } from '@/componentes/Comun'
import { Encabezado } from '@/componentes/Encabezado'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'
import { NOMBRE_ESTADO_PROGRAMA } from '@/lib/textos'
import { cn } from '@/lib/utils'

const NUEVO = '__nuevo'

interface Datos {
  programas: Programa[]
  beneficiarios: BeneficiarioDemo[]
  puntos: Punto[]
}

export const claseSelect =
  'min-h-12 w-full rounded-lg border border-control bg-background px-3 text-base font-normal text-foreground'

/** Color del ícono de cada rol, como en el prototipo: entidad noche, beneficiario azul, punto ámbar. */
const COLOR_ROL = {
  entidad: 'bg-foreground text-background',
  beneficiario: 'bg-primary text-primary-foreground',
  punto: 'bg-ambar text-noche',
}

/**
 * Móvil: fila compacta (ícono + título + subtítulo + flecha).
 * Desktop: tarjeta completa con descripción, selector y botón.
 */
function TarjetaRol({
  icono,
  color,
  titulo,
  subtitulo,
  texto,
  onEntrar,
  children,
}: {
  icono: ReactNode
  color: keyof typeof COLOR_ROL
  titulo: string
  /** Texto corto que se muestra en móvil bajo el título */
  subtitulo?: string
  texto: string
  onEntrar: () => void
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card sm:flex sm:flex-[1_1_300px] sm:flex-col sm:gap-3 sm:p-5">
      {/* Móvil: fila compacta */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 p-3 sm:hidden">
        <div aria-hidden className={cn('flex size-11 items-center justify-center rounded-xl [&_svg]:size-5', COLOR_ROL[color])}>
          {icono}
        </div>
        <div className="min-w-0">
          <p className="m-0 font-bold">{titulo}</p>
          {subtitulo && <p className="m-0 text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        <button
          onClick={onEntrar}
          aria-label={`Entrar como ${titulo.toLowerCase()}`}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      {/* Desktop: tarjeta completa */}
      <div aria-hidden className={cn('hidden size-12 items-center justify-center rounded-xl [&_svg]:size-6 sm:flex', COLOR_ROL[color])}>
        {icono}
      </div>
      <h2 className="m-0 hidden text-2xl font-bold sm:block">{titulo}</h2>
      <p className="m-0 hidden text-muted-foreground sm:block">{texto}</p>
      <div className="hidden sm:contents">{children}</div>
    </section>
  )
}

export default function Entrada() {
  const navegar = useNavigate()
  const rol = useRol()
  const { datos, error, recargar } = usePolling<Datos>(
    async () => {
      const [programas, beneficiarios, puntos] = await Promise.all([
        api.get<Programa[]>('/programas'),
        api.get<BeneficiarioDemo[]>('/beneficiarios/demo'),
        api.get<Punto[]>('/puntos'),
      ])
      return { programas, beneficiarios, puntos }
    },
    null,
  )

  const [programaId, setProgramaId] = useState(rol.programaId ?? '')
  const [documento, setDocumento] = useState(rol.documento ?? '')
  const [puntoId, setPuntoId] = useState(rol.puntoId ?? '')

  // Al llegar los datos, se marca la selección anterior o la primera opción.
  useEffect(() => {
    if (!datos) return
    setProgramaId((v) => (datos.programas.some((p) => p.id === v) ? v : (datos.programas.at(-1)?.id ?? NUEVO)))
    setDocumento((v) => (datos.beneficiarios.some((b) => b.documento === v) ? v : (datos.beneficiarios[0]?.documento ?? '')))
    setPuntoId((v) => (datos.puntos.some((p) => p.id === v) ? v : (datos.puntos[0]?.id ?? '')))
  }, [datos])

  const entrarEntidad = () => {
    rol.actualizar({ rol: 'entidad', programaId: null })
    navegar('/entidad')
  }
  const entrarBeneficiario = () => {
    const b = datos?.beneficiarios.find((x) => x.documento === documento)
    if (!b) return
    rol.actualizar({ rol: 'beneficiario', documento: b.documento, nombre: b.nombre })
    navegar('/beneficiario')
  }
  const entrarPunto = () => {
    const p = datos?.puntos.find((x) => x.id === puntoId)
    if (!p) return
    rol.actualizar({ rol: 'punto', puntoId: p.id, puntoNombre: p.nombre })
    navegar('/punto')
  }

  const cargando = !datos && !error

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Encabezado variante="entrada" />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-2 px-4 py-3 sm:px-6 sm:py-6 md:justify-center md:gap-4 md:py-6">
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-6 sm:text-left">
          <img src="/marca/tatu-logo-claro.svg" alt="" className="size-20 shrink-0 oscuro:hidden sm:size-20" />
          <img src="/marca/tatu-logo-oscuro.svg" alt="" className="hidden size-20 shrink-0 rounded-3xl oscuro:block sm:size-20" />
          <div className="flex flex-col gap-1 sm:gap-2">
            <p className="marca m-0 text-4xl sm:text-5xl">Tatú</p>
            <p className="m-0 max-w-[420px] text-sm leading-snug sm:text-base">
              La plata del subsidio sale de la cuenta de la entidad solo cuando alguien cobra.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Titulo className="text-xl sm:text-3xl">¿Cómo quieres entrar?</Titulo>
        </div>

        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
        <AvisoPagos />
        {/* <ComoProbar /> */}

        <div className="flex flex-col gap-2 sm:flex-wrap sm:flex-row sm:items-stretch sm:gap-4" aria-busy={cargando}>
          <TarjetaRol
            icono={<Building2 />}
            color="entidad"
            titulo="Entidad"
            subtitulo={(() => { const p = datos?.programas.find((x) => x.id === programaId); return p ? `${p.nombre} · ${NOMBRE_ESTADO_PROGRAMA[p.estado]}` : 'Sus programas y lo que se ha cobrado' })()}
            texto="Conecta el subsidio, apruébalo una vez en tu banco y sigue lo cobrado."
            onEntrar={entrarEntidad}
          >
            <Button size="lg" className="mt-auto w-full" onClick={entrarEntidad}>
              Entrar como entidad
            </Button>
          </TarjetaRol>

          <TarjetaRol
            icono={<User />}
            color="beneficiario"
            titulo="Beneficiaria"
            subtitulo={(() => { const b = datos?.beneficiarios.find((x) => x.documento === documento); return b ? `${b.nombre} · sus subsidios por cobrar` : 'Sus subsidios por cobrar' })()}
            texto="Mira cuánto tienes y cóbralo a tu wallet o en un punto."
            onEntrar={entrarBeneficiario}
          >
            {datos && datos.beneficiarios.length === 0 ? (
              <SinRegistros texto="Todavía no hay personas registradas." boton="Registrar personas" />
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-bold">
                  Persona
                  <select className={claseSelect} value={documento} onChange={(e) => setDocumento(e.target.value)} disabled={cargando}>
                    {datos?.beneficiarios.map((b) => (
                      <option key={b.documento} value={b.documento}>
                        {b.nombre} · {b.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <Link to="/equipo" className="self-start text-sm">
                  Registrar a alguien más
                </Link>
                <Button size="lg" className="mt-auto w-full" onClick={entrarBeneficiario} disabled={cargando || !documento}>
                  Entrar como beneficiario
                </Button>
              </>
            )}
          </TarjetaRol>

          <TarjetaRol
            icono={<Store />}
            color="punto"
            titulo="Punto de retiro"
            subtitulo={(() => { const p = datos?.puntos.find((x) => x.id === puntoId); return p ? `${p.nombre} · en el celular` : 'En el celular' })()}
            texto="Digita la cédula, el beneficiario confirma con su PIN y recuperas el efectivo al instante."
            onEntrar={entrarPunto}
          >
            {datos && datos.puntos.length === 0 ? (
              <SinRegistros texto="Todavía no hay puntos registrados." boton="Agregar un punto" />
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-bold">
                  Punto
                  <select className={claseSelect} value={puntoId} onChange={(e) => setPuntoId(e.target.value)} disabled={cargando}>
                    {datos?.puntos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}{p.tipo === 'compra' ? ' · comercio (bonos)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <Button size="lg" className="mt-auto w-full" onClick={entrarPunto} disabled={cargando || !puntoId}>
                  Entrar como punto
                </Button>
              </>
            )}
          </TarjetaRol>
        </div>

        {/* Punto de retiro en computador */}
        <div className="flex flex-col items-center gap-0.5 text-center">
          <Link to="/punto" className="inline-flex items-center gap-2 text-sm font-bold underline text-foreground hover:text-foreground">
            <Monitor aria-hidden className="size-4" />
            Punto de retiro en computador
          </Link>
          <p className="m-0 text-xs text-tenue">Jorge no usa la app: cobra en el punto con su cédula</p>
        </div>

        <p className="m-0 text-center text-xs text-tenue">
          El rol elegido se recuerda al recargar. Todo usa cuentas de la Interledger Test Wallet: el dinero es de prueba.
        </p>
      </main>
    </div>
  )
}

function SinRegistros({ texto, boton }: { texto: string; boton: string }) {
  return (
    <>
      <p className="m-0 rounded-lg border-2 border-dashed border-border px-4 py-3 text-tenue">{texto}</p>
      <Button asChild size="lg" variant="outline" className="mt-auto w-full border-foreground">
        <Link to="/equipo">{boton}</Link>
      </Button>
    </>
  )
}

/** Si los pagos están simulados, se dice aquí mismo y se lleva a /estado. */
function AvisoPagos() {
  const { estado } = useEstadoSistema()
  if (API_SIMULADA || !estado || estado.pagosReales) return null
  return (
    <p role="status" className="m-0 flex flex-wrap items-start gap-x-2.5 gap-y-1 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3.5 text-pagando">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong>Pagos simulados:</strong> {estado.faltan[0]}
      </span>
      <Link to="/estado" className="font-bold text-pagando underline hover:text-pagando">
        Ver qué falta
      </Link>
    </p>
  )
}

/** Los tres pasos para enviarse dinero entre el equipo. */
export function ComoProbar() {
  const pasos = [
    { titulo: 'Registren al equipo', texto: 'Cédula y wallet de cada persona, en «Equipo de prueba».', a: '/equipo' },
    { titulo: 'Creen un programa', texto: 'Con la wallet de quien paga y el monto por persona; se aprueba en su Test Wallet.', a: null },
    { titulo: 'Cobren', texto: 'Cada persona entra como beneficiario y cobra a su wallet, o en un punto con su PIN.', a: null },
  ]
  return (
    <section aria-labelledby="titulo-como" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id="titulo-como" className="m-0 text-lg font-bold">
        Para enviarse dinero entre el equipo
      </h2>
      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex items-start gap-3">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              {p.a ? (
                <Link to={p.a} className="font-bold">
                  {p.titulo}
                </Link>
              ) : (
                <strong>{p.titulo}</strong>
              )}
              <span className="text-[15px] text-muted-foreground">{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function HerramientasSimulada({ alCambiar }: { alCambiar: () => void }) {
  const rol = useRol()
  const usar = async (accion: 'escenario' | 'reiniciar') => {
    const m = await import('@/api/simulada/servidor')
    if (accion === 'escenario') {
      const id = m.cargarEscenarioDemo()
      rol.actualizar({ programaId: id })
    } else {
      m.reiniciarSimulacion()
      rol.actualizar({ programaId: null })
    }
    alCambiar()
  }
  return (
    <section aria-labelledby="titulo-simulada" className="flex flex-col gap-3 rounded-xl border border-dashed border-control p-5">
      <h2 id="titulo-simulada" className="m-0 text-base font-bold">
        API simulada (solo para probar pantallas)
      </h2>
      <p className="m-0 text-sm text-muted-foreground">
        Las respuestas salen del navegador con el contrato del Plan backend § 7. Cédulas: 900000001 Ana (PIN 1111), 900000002 Luis (2222),
        900000003 Jorge (3333) y 900000004 Rosa (4444, retroactivo de $460.000).
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void usar('escenario')}>
          Cargar escenario de la demo
        </Button>
        <Button variant="outline" onClick={() => void usar('reiniciar')}>
          Reiniciar datos de prueba
        </Button>
      </div>
    </section>
  )
}

import { Menu, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { api, API_SIMULADA } from '@/api/client'
import { useEstadoSistema } from '@/api/estado'
import type { BeneficiarioDemo, Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { useRol } from '@/contexto/Rol'

import { BotonTema } from './Tema'

// El panel de prueba copia el «Menú de pantallas» del prototipo (.dev-tab / .dev-panel): una
// pestaña al borde derecho que abre un panel Noche. Aquí van las herramientas del piloto que el
// prototipo no tiene en sus pantallas: con quién probar, el equipo de prueba, el estado de los
// pagos, el tema y la API simulada (Plan apego al prototipo § 3).

const SELECT =
  'min-h-11 w-full rounded-[10px] border-0 bg-[#1e2c49] px-3 text-[15px] text-[#f5f0e6] outline-offset-2 focus-visible:outline-[3px] focus-visible:outline-[#f6a623]'
const ENLACE = 'block rounded-lg px-2.5 py-2 text-[15px] text-[#f5f0e6] no-underline hover:bg-[#1e2c49] hover:text-white'

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-3.5">
      <h3 className="m-0 mb-1 text-[12.5px] font-bold tracking-[0.04em] text-[#f6a623]">{titulo}</h3>
      {children}
    </section>
  )
}

export function PanelPrueba() {
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()
  const pestana = useRef<HTMLButtonElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const rol = useRol()
  const { estado } = useEstadoSistema()
  const datos = usePolling(
    async () => {
      const [beneficiarios, puntos] = await Promise.all([api.get<BeneficiarioDemo[]>('/beneficiarios/demo'), api.get<Punto[]>('/puntos')])
      return { beneficiarios, puntos }
    },
    null,
    abierto,
    { clave: String(abierto) },
  )

  // Al cambiar de pantalla se cierra, como en el prototipo
  useEffect(() => setAbierto(false), [pathname])
  useEffect(() => {
    if (abierto) cerrarRef.current?.focus()
  }, [abierto])

  const cerrar = () => {
    setAbierto(false)
    pestana.current?.focus()
  }

  const pagosSimulados = !API_SIMULADA && estado && !estado.pagosReales

  const usarSimulada = async (accion: 'escenario' | 'reiniciar') => {
    const m = await import('@/api/simulada/servidor')
    if (accion === 'escenario') rol.actualizar({ programaId: m.cargarEscenarioDemo() })
    else {
      m.reiniciarSimulacion()
      rol.actualizar({ programaId: null })
    }
    window.location.reload()
  }

  return (
    <>
      <button
        ref={pestana}
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="panel-prueba"
        aria-label="Panel de prueba"
        className="fixed top-1/2 right-0 z-50 flex h-[72px] w-[30px] -translate-y-1/2 items-center justify-center rounded-l-[10px] border-0 bg-noche text-[#f5f0e6] opacity-55 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      >
        <Menu aria-hidden className="size-4" />
        {pagosSimulados && <span aria-hidden className="absolute top-2 left-1.5 size-2 rounded-full bg-[#f6a623]" />}
      </button>

      {abierto && (
        <div
          id="panel-prueba"
          role="dialog"
          aria-label="Panel de prueba"
          onKeyDown={(e) => e.key === 'Escape' && cerrar()}
          className="fixed inset-y-0 right-0 z-[60] w-[min(340px,92vw)] overflow-auto bg-noche px-[18px] pt-[max(18px,env(safe-area-inset-top))] pb-6 text-[#f5f0e6] shadow-[-12px_0_40px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <b className="marca text-lg">Probar como</b>
            <button ref={cerrarRef} type="button" onClick={cerrar} aria-label="Cerrar el panel" className="flex size-11 items-center justify-center border-0 bg-transparent text-[#f5f0e6]">
              <X aria-hidden className="size-6" />
            </button>
          </div>

          {pagosSimulados && (
            <p className="m-0 mb-3.5 flex items-start gap-2 rounded-[10px] bg-[#1e2c49] px-3 py-2.5 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none text-[#f6a623]" />
              <span>
                Pagos simulados: {estado?.faltan[0]}{' '}
                <Link to="/estado" className="font-bold text-[#f6a623] hover:text-[#f6a623]">
                  Ver qué falta
                </Link>
              </span>
            </p>
          )}

          <Grupo titulo="BENEFICIARIO">
            <select
              aria-label="Persona con la que se prueba"
              className={SELECT}
              value={rol.documento ?? ''}
              onChange={(e) => {
                const b = datos.datos?.beneficiarios.find((x) => x.documento === e.target.value)
                if (b) rol.actualizar({ documento: b.documento, nombre: b.nombre })
              }}
            >
              {!rol.documento && <option value="">Elige una persona</option>}
              {datos.datos?.beneficiarios.map((b) => (
                <option key={b.documento} value={b.documento}>
                  {b.nombre} · {b.etiqueta}
                </option>
              ))}
            </select>
          </Grupo>

          <Grupo titulo="PUNTO">
            <select
              aria-label="Punto con el que se prueba"
              className={SELECT}
              value={rol.puntoId ?? ''}
              onChange={(e) => {
                const p = datos.datos?.puntos.find((x) => x.id === e.target.value)
                if (p) rol.actualizar({ puntoId: p.id, puntoNombre: p.nombre })
              }}
            >
              {!rol.puntoId && <option value="">Elige un punto</option>}
              {datos.datos?.puntos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.tipo === 'compra' ? ' · comercio (bonos)' : ''}
                </option>
              ))}
            </select>
          </Grupo>

          <Grupo titulo="IR A">
            <Link to="/" className={ENLACE}>
              Elegir rol
            </Link>
            <Link to="/equipo" className={ENLACE}>
              Equipo de prueba: registrar personas y puntos
            </Link>
            <Link to="/estado" className={ENLACE}>
              Estado de los pagos
            </Link>
          </Grupo>

          <Grupo titulo="TEMA">
            <div className="flex items-center gap-3 rounded-[10px] bg-[#1e2c49] px-3 py-2 text-sm">
              <BotonTema sobreBloque />
              Modo claro u oscuro
            </div>
          </Grupo>

          {API_SIMULADA && (
            <Grupo titulo="API SIMULADA">
              <p className="m-0 mb-2 text-[13px] leading-[1.4] text-[#c9c2b3]">
                Cédulas: 900000001 Ana (PIN 1111), 900000002 Luis (2222), 900000003 Jorge (3333), 900000004 Rosa (4444).
              </p>
              <button type="button" onClick={() => void usarSimulada('escenario')} className={`${ENLACE} w-full border-0 bg-transparent text-left`}>
                Cargar escenario de la demo
              </button>
              <button type="button" onClick={() => void usarSimulada('reiniciar')} className={`${ENLACE} w-full border-0 bg-transparent text-left`}>
                Reiniciar datos de prueba
              </button>
            </Grupo>
          )}
        </div>
      )}
    </>
  )
}

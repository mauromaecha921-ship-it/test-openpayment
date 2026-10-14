import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

interface PropsEncabezadoPuntoRetiro {
  onVolver?: () => void
  textoVolver?: string
  titulo?: string
  subtitulo?: string
  esInicio?: boolean
  extraDerechaDesktop?: ReactNode
}

export function EncabezadoPuntoRetiro({
  onVolver,
  textoVolver,
  titulo,
  subtitulo,
  esInicio = false,
  extraDerechaDesktop,
}: PropsEncabezadoPuntoRetiro) {
  const navegar = useNavigate()

  const manejarVolver = () => {
    if (onVolver) {
      onVolver()
    } else {
      navegar(-1)
    }
  }

  const labelVolverDesktop = textoVolver || (esInicio ? 'Elegir rol' : 'Volver')

  return (
    <>
      {/* VISTA MÓVIL (< 768px): Exacta a P0-P7 del prototipo */}
      <header className="flex md:hidden flex-col gap-1 w-full pt-1 pb-1">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={manejarVolver}
            aria-label="Volver"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] text-[#13203A] active:scale-95 transition-transform"
          >
            <ChevronLeft aria-hidden className="size-6 stroke-[2.4]" />
          </button>

          {esInicio ? (
            <>
              <img
                src="/marca/tatu-icono-pequeno.svg"
                alt=""
                className="size-8 shrink-0 oscuro:hidden"
              />
              <img
                src="/marca/tatu-logo-oscuro.svg"
                alt=""
                className="hidden size-8 shrink-0 oscuro:block rounded-lg"
              />
              <span className="text-[21px] font-extrabold tracking-tight text-[#13203A]">
                Tatú
              </span>
            </>
          ) : (
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-extrabold leading-tight text-[#13203A] truncate">
                {titulo}
              </span>
              {subtitulo && (
                <span className="text-[14px] text-[#4A5468] truncate leading-tight mt-0.5">
                  {subtitulo}
                </span>
              )}
            </div>
          )}

          <div className="ml-auto shrink-0">
            <span className="text-[13px] font-semibold px-2.5 py-1 border-[1.5px] border-[#13203A] rounded-full text-[#13203A]">
              Dinero de prueba
            </span>
          </div>
        </div>

        {esInicio && (
          <div className="text-[15px] text-[#4A5468] -mt-0.5 pl-0.5">
            {subtitulo || 'Tienda Marta · Punto de retiro'}
          </div>
        )}
      </header>

      {/* VISTA PC (>= 768px): Exacta a PD0-PD4 del prototipo */}
      <div className="hidden md:flex flex-col gap-5 w-full">
        <button
          type="button"
          onClick={manejarVolver}
          className="inline-flex items-center gap-2 self-start min-h-[44px] px-3.5 py-0 rounded-xl border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] text-[#13203A] font-bold text-base hover:bg-neutral-50 active:scale-[0.99] cursor-pointer transition-all"
        >
          <ChevronLeft aria-hidden className="size-5 stroke-[2.4]" />
          <span>{labelVolverDesktop}</span>
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            {subtitulo && (
              <span className="text-[15px] font-medium text-[#4A5468]">
                {subtitulo}
              </span>
            )}
            <h1 className="m-0 text-[34px] font-extrabold tracking-tight text-[#13203A] leading-tight">
              {titulo || 'Tienda Marta'}
            </h1>
          </div>

          {extraDerechaDesktop && (
            <div className="ml-auto flex items-center gap-3">
              {extraDerechaDesktop}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

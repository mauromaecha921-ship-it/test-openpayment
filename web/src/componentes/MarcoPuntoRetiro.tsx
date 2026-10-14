import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useRol } from '@/contexto/Rol'
import { cn } from '@/lib/utils'

interface PropsMarcoPuntoRetiro {
  children: ReactNode
  className?: string
  ancho?: 'celular' | 'responsive'
  navActiva?: 'inicio' | 'caja'
}

export function MarcoPuntoRetiro({
  children,
  className,
  ancho = 'responsive',
  navActiva = 'inicio',
}: PropsMarcoPuntoRetiro) {
  const { puntoNombre } = useRol()
  const nombreTienda = puntoNombre ? puntoNombre.split(' — ')[0] : 'Tienda Marta'

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#F5F0E6] text-[#13203A] antialiased">
      {/* Barra superior de PC / Computador (PD0 - PD4) */}
      <div className="hidden md:block w-full bg-[#13203A] text-[#F5F0E6]">
        <div className="max-w-[1240px] mx-auto px-8 py-3 flex flex-wrap items-center gap-6">
          <Link
            to="/"
            aria-label="Volver a elegir rol"
            className="flex items-center gap-2.5 text-[#F5F0E6] no-underline hover:opacity-90 transition-opacity"
          >
            <img src="/marca/tatu-logo-oscuro.svg" alt="" className="size-8 rounded-lg" />
            <span className="text-[24px] font-extrabold tracking-tight">Tatú</span>
          </Link>

          <nav className="flex gap-5">
            <Link
              to="/punto"
              className={cn(
                'text-[#F5F0E6] no-underline text-base font-bold py-2.5 px-0.5 border-b-[3px] transition-colors',
                navActiva === 'inicio' ? 'border-[#F6A623]' : 'border-transparent opacity-80 hover:opacity-100',
              )}
            >
              Inicio
            </Link>
            <Link
              to="/punto/caja"
              className={cn(
                'text-[#F5F0E6] no-underline text-base font-medium py-2.5 px-0.5 border-b-[3px] transition-colors',
                navActiva === 'caja' ? 'border-[#F6A623]' : 'border-transparent opacity-80 hover:opacity-100',
              )}
            >
              Mi caja
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3.5">
            <span className="text-[13px] font-semibold px-2.5 py-1 border-[1.5px] border-[#F5F0E6] rounded-full">
              Dinero de prueba
            </span>
            <span className="text-[15px] font-medium">{nombreTienda}</span>
          </div>
        </div>
      </div>

      {/* Contenedor principal: En móvil máx 390-430px centrado; en PC máx 1240px */}
      <main
        className={cn(
          'flex min-h-dvh md:min-h-0 w-full flex-col',
          ancho === 'celular'
            ? 'max-w-[390px] mx-auto px-5 py-4 gap-3.5'
            : 'max-w-[390px] md:max-w-[1240px] mx-auto px-5 py-4 md:px-8 md:py-6 md:pb-14 gap-3.5 md:gap-5',
          className,
        )}
      >
        {children}
      </main>
    </div>
  )
}

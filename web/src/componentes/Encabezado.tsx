import { Link } from 'react-router'

import { API_SIMULADA } from '@/api/client'
import { cn } from '@/lib/utils'

import { EstadoPagos } from './EstadoPagos'
import { NavSuperior, type Seccion } from './NavInferior'

const pastilla = 'rounded-full border px-3 py-1 text-sm whitespace-nowrap'

/** `compacto`: el del celular, que crece en PC. */
export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2.5 text-foreground no-underline hover:text-foreground" aria-label="Tatú, ir a la entrada">
      <span aria-hidden className={cn('rounded-md bg-primary', compacto ? 'size-6 md:size-7' : 'size-7')} />
      <span aria-hidden className={cn('font-bold', compacto ? 'text-lg md:text-xl' : 'text-xl')}>
        Tatú
      </span>
    </Link>
  )
}

function AvisoSimulada({ corto = false }: { corto?: boolean }) {
  if (!API_SIMULADA) return null
  return (
    <span className={cn(pastilla, 'border-dashed border-control px-2.5 py-0.5 text-muted-foreground')} title="Las respuestas salen de la API simulada en el navegador">
      {corto ? 'Simulada' : 'API simulada'}
    </span>
  )
}

interface Props {
  variante: 'entrada' | 'escritorio' | 'celular'
  /** Escritorio: nombre de la entidad. Celular: «Ana» o «Tienda Marta». */
  quien?: string
  /** Etiqueta del rol («Entidad»). En la variante celular solo se ve en PC. */
  rol?: string
  /** Variante celular: las secciones del rol, en la barra (solo en PC). */
  secciones?: Seccion[]
}

export function Encabezado({ variante, quien, rol, secciones }: Props) {
  if (variante === 'celular') {
    return (
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-2.5 gap-y-1 px-5 py-2 md:gap-x-4 md:px-6">
          <Logo compacto />
          {secciones && <NavSuperior secciones={secciones} />}
          <span className="ml-auto flex items-center gap-2">
            <EstadoPagos corto />
            <AvisoSimulada corto />
            {rol && <span className={cn(pastilla, 'hidden text-muted-foreground md:inline')}>{rol}</span>}
            {quien && <span className={cn(pastilla, 'border-foreground px-2.5 py-0.5 font-bold md:px-3 md:py-1')}>{quien}</span>}
          </span>
          <Link to="/" className="inline-flex min-h-11 items-center text-sm md:text-[15px]">
            Cambiar rol
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <Logo />
        {variante === 'escritorio' && quien && (
          <>
            <span aria-hidden className="text-control">
              /
            </span>
            <span className="text-muted-foreground">{quien}</span>
          </>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <EstadoPagos />
          <AvisoSimulada />
          {variante === 'entrada' ? (
            <Link to="/equipo" className={cn(pastilla, 'border-foreground font-bold text-foreground no-underline hover:bg-muted hover:text-foreground')}>
              Equipo de prueba
            </Link>
          ) : (
            rol && <span className={cn(pastilla, 'border-foreground font-bold')}>{rol}</span>
          )}
        </span>
        {variante === 'escritorio' && (
          <Link to="/" className="inline-flex min-h-11 items-center text-[15px]">
            Cambiar rol
          </Link>
        )}
      </div>
    </header>
  )
}

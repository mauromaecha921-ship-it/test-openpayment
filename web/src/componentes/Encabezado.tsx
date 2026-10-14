import { Link } from 'react-router'

import { API_SIMULADA } from '@/api/client'
import { cn } from '@/lib/utils'

import { EstadoPagos } from './EstadoPagos'
import { NavSuperior, type Seccion } from './NavInferior'
import { BotonTema } from './Tema'

const pastilla = 'rounded-full border px-3 py-1 text-sm whitespace-nowrap'

/** `compacto`: el del celular, que crece en PC. `oscuro`: sobre la barra Noche de la entidad. */
export function Logo({ compacto = false, oscuro = false }: { compacto?: boolean; oscuro?: boolean }) {
  return (
    <Link
      to="/"
      className={cn('flex min-h-11 items-center gap-2.5 no-underline', oscuro ? 'text-bloque-texto hover:text-bloque-texto' : 'text-foreground hover:text-foreground')}
      aria-label="Tatú, ir a la entrada"
    >
      {/* En modo oscuro, el ícono de trazo Noche no se ve: va el logo oscuro (lleva su fondo). */}
      <img
        src="/marca/tatu-icono-pequeno.svg"
        alt=""
        aria-hidden
        className={cn('shrink-0 oscuro:hidden', compacto ? 'size-8 md:size-9' : 'size-9', oscuro && 'hidden')}
      />
      <img
        src="/marca/tatu-logo-oscuro.svg"
        alt=""
        aria-hidden
        className={cn('hidden shrink-0 rounded-lg oscuro:block', compacto ? 'size-8 md:size-9' : 'size-9', oscuro && 'block')}
      />
      <span aria-hidden className={cn('marca', compacto ? 'text-xl md:text-2xl' : 'text-2xl')}>
        Tatú
      </span>
    </Link>
  )
}

function AvisoSimulada({ corto = false, oscuro = false }: { corto?: boolean; oscuro?: boolean }) {
  if (!API_SIMULADA) return null
  return (
    <span
      className={cn(pastilla, 'border-dashed px-2.5 py-0.5', oscuro ? 'border-noche-tenue text-noche-tenue' : 'border-control text-muted-foreground')}
      title="Las respuestas salen de la API simulada en el navegador">
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
          <BotonTema />
          <Link to="/" className="inline-flex min-h-11 items-center text-sm md:text-[15px]">
            Cambiar rol
          </Link>
        </div>
      </header>
    )
  }

  // La entidad, en PC, va con la barra Noche del prototipo; la entrada, en arena.
  const oscuro = variante === 'escritorio'
  return (
    <header className={cn('border-b', oscuro ? 'border-bloque bg-bloque text-bloque-texto' : 'border-border bg-background')}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        {/* En la entrada, el celular ya muestra la marca grande debajo: la barra queda en una sola fila */}
        <span className={cn(variante === 'entrada' && 'max-md:hidden')}>
          <Logo oscuro={oscuro} />
        </span>
        {variante === 'escritorio' && quien && (
          <>
            <span aria-hidden className="text-noche-tenue">
              /
            </span>
            <span className="text-noche-tenue">{quien}</span>
            <nav aria-label="Secciones de la entidad" className="ml-3 flex gap-5">
              <Link to="/entidad" className="inline-flex min-h-11 items-center border-b-[3px] border-ambar px-0.5 font-bold text-bloque-texto no-underline hover:text-bloque-texto">
                Programas
              </Link>
            </nav>
          </>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <EstadoPagos />
          <AvisoSimulada oscuro={oscuro} />
          {variante === 'entrada' ? (
            <Link to="/equipo" className={cn(pastilla, 'border-foreground font-bold text-foreground no-underline hover:bg-muted hover:text-foreground')}>
              <span className="md:hidden">Dinero de prueba</span>
              <span className="hidden md:inline">Equipo de prueba</span>
            </Link>
          ) : (
            rol && <span className={cn(pastilla, 'border-ambar font-bold text-ambar')}>{rol}</span>
          )}
          <BotonTema sobreBloque={oscuro} />
        </span>
        {variante === 'escritorio' && (
          <Link to="/" className="inline-flex min-h-11 items-center text-[15px] text-bloque-texto underline hover:text-ambar">
            Cambiar rol
          </Link>
        )}
      </div>
    </header>
  )
}

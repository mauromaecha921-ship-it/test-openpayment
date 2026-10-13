import { CreditCard, History, House, ScanLine, Wallet, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

export interface Seccion {
  to: string
  texto: string
  Icono: LucideIcon
  /** Solo se marca activa en la ruta exacta (para la raíz del rol). */
  fin: boolean
}

export const SECCIONES_BENEFICIARIO: Seccion[] = [
  { to: '/beneficiario', texto: 'Inicio', Icono: House, fin: true },
  { to: '/beneficiario/cuenta', texto: 'Mi cuenta', Icono: CreditCard, fin: false },
  { to: '/beneficiario/historial', texto: 'Historial', Icono: History, fin: false },
]

/** D-36: el punto también tiene secciones: cobrar y ver su caja. */
export const SECCIONES_PUNTO: Seccion[] = [
  { to: '/punto', texto: 'Cobrar', Icono: ScanLine, fin: true },
  { to: '/punto/caja', texto: 'Mi caja', Icono: Wallet, fin: false },
]

/** Secciones del rol en el celular: barra fija abajo. En PC se oculta y van arriba. */
export function NavInferior({ secciones }: { secciones: Seccion[] }) {
  return (
    <nav aria-label="Secciones" className="sticky bottom-0 flex border-t border-border bg-background md:hidden">
      {secciones.map(({ to, texto, Icono, fin }) => (
        <NavLink
          key={to}
          to={to}
          end={fin}
          className={({ isActive }) =>
            cn(
              'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 border-t-[3px] text-[13px] no-underline',
              isActive
                ? 'border-foreground font-bold text-foreground hover:text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icono aria-hidden className="size-[22px]" />
          {texto}
        </NavLink>
      ))}
    </nav>
  )
}

/** Las mismas secciones en la barra superior, solo en PC y tablet. */
export function NavSuperior({ secciones }: { secciones: Seccion[] }) {
  return (
    <nav aria-label="Secciones" className="hidden self-stretch md:flex">
      {secciones.map(({ to, texto, Icono, fin }) => (
        <NavLink
          key={to}
          to={to}
          end={fin}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-2 border-b-[3px] px-3.5 text-[15px] no-underline',
              isActive
                ? 'border-foreground font-bold text-foreground hover:text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icono aria-hidden className="size-[18px]" />
          {texto}
        </NavLink>
      ))}
    </nav>
  )
}

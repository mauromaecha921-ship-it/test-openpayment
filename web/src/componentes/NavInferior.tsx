import { CreditCard, History, House } from 'lucide-react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

const enlaces = [
  { to: '/beneficiario', texto: 'Inicio', Icono: House, fin: true },
  { to: '/beneficiario/cuenta', texto: 'Mi cuenta', Icono: CreditCard, fin: false },
  { to: '/beneficiario/historial', texto: 'Historial', Icono: History, fin: false },
]

/** Secciones del beneficiario en el celular: barra fija abajo. En PC se oculta y van arriba. */
export function NavInferior() {
  return (
    <nav aria-label="Secciones" className="sticky bottom-0 flex border-t border-border bg-background md:hidden">
      {enlaces.map(({ to, texto, Icono, fin }) => (
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
export function NavSuperior() {
  return (
    <nav aria-label="Secciones" className="hidden self-stretch md:flex">
      {enlaces.map(({ to, texto, Icono, fin }) => (
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

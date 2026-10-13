import { Check, Clock, LoaderCircle, TriangleAlert, X } from 'lucide-react'

import type { EstadoCobro as Estado, Motivo } from '@/api/tipos'
import { MOTIVO_CORTO, NOMBRE_ESTADO_COBRO } from '@/lib/textos'
import { cn } from '@/lib/utils'

// Colores de la identidad visual: «Pagado» va sólido como en el prototipo; los demás, en un tono
// suave. Siempre con ícono y texto, nunca solo color (Plan frontend § 6).

const ESTILO: Record<Estado, string> = {
  Solicitado: 'border-control bg-background text-foreground',
  PorConfirmar: 'border-control bg-background text-foreground',
  Pagando: 'border-pagando bg-pagando-fondo text-pagando',
  Pagado: 'border-pagado-relleno bg-pagado-relleno text-primary-foreground',
  Rechazado: 'border-dashed border-rechazo bg-rechazo-fondo text-rechazo',
  Fallido: 'border-dashed border-rechazo bg-rechazo-fondo text-rechazo',
}

const ICONO = {
  Solicitado: Clock,
  PorConfirmar: Clock,
  Pagando: LoaderCircle,
  Pagado: Check,
  Rechazado: X,
  Fallido: TriangleAlert,
} satisfies Record<Estado, unknown>

export function EstadoCobro({ estado, motivo, grande = false }: { estado: Estado; motivo?: Motivo | null; grande?: boolean }) {
  const Icono = ICONO[estado]
  const corto = motivo ? (MOTIVO_CORTO[motivo.codigo] ?? motivo.mensaje) : null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap',
        grande ? 'px-3 py-1 text-[15px] font-bold' : 'px-2.5 py-0.5 text-sm',
        ESTILO[estado],
      )}
    >
      <Icono aria-hidden className={cn(grande ? 'size-4' : 'size-3.5', estado === 'Pagando' && 'animate-spin motion-reduce:animate-none')} strokeWidth={2.5} />
      {NOMBRE_ESTADO_COBRO[estado]}
      {corto && ` · ${corto}`}
    </span>
  )
}

import { ArrowLeft, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'

/** Tarjeta blanca con borde, como las secciones de los wireframes. */
export function Tarjeta({ children, className, as: Etiqueta = 'section', ...resto }: { children: ReactNode; className?: string; as?: 'section' | 'aside' | 'div' | 'article' } & { 'aria-labelledby'?: string }) {
  return (
    <Etiqueta className={cn('flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:p-6', className)} {...resto}>
      {children}
    </Etiqueta>
  )
}

/** Lista de datos («Persona · Jorge»), con separadores. */
export function ListaDatos({ filas, className, enColumna = false }: { filas: Array<[ReactNode, ReactNode] | false | null | undefined>; className?: string; enColumna?: boolean }) {
  const visibles = filas.filter(Boolean) as Array<[ReactNode, ReactNode]>
  return (
    <dl className={cn('m-0 flex flex-col', className)}>
      {visibles.map(([dt, dd], i) => (
        <div
          key={i}
          className={cn(
            'flex gap-3 py-3',
            enColumna ? 'flex-col gap-0.5' : 'flex-wrap justify-between',
            i < visibles.length - 1 && 'border-b border-border',
          )}
        >
          <dt className="text-tenue">{dt}</dt>
          <dd className={cn('m-0 min-w-0', !enColumna && 'text-right')}>{dd}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Recuadro gris con un ícono: avisos y recordatorios. */
export function Aviso({ icono, children, className }: { icono?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <p className={cn('m-0 flex items-start gap-2.5 rounded-xl bg-muted px-4 py-3.5 text-base', className)}>
      {icono && <span className="mt-0.5 shrink-0 [&_svg]:size-5">{icono}</span>}
      <span>{children}</span>
    </p>
  )
}

export function Volver({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 self-start text-base">
      <ArrowLeft aria-hidden className="size-[18px]" />
      {children}
    </Link>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p role="status" className="m-0 flex items-center gap-2 py-8 text-muted-foreground">
      <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
      {texto}
    </p>
  )
}

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border-2 border-rechazo bg-rechazo-fondo p-4 text-rechazo">
      <p className="m-0 flex items-start gap-2 font-bold">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        {mensaje}
      </p>
      {reintentar && (
        <Button variant="outline" onClick={reintentar} className="text-foreground">
          Intentar de nuevo
        </Button>
      )}
    </div>
  )
}

/** Mensaje de error de un formulario, anunciado al lector de pantalla. */
export function MensajeError({ children, id }: { children: ReactNode; id?: string }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="m-0 flex items-start gap-2 text-[15px] font-bold text-rechazo">
      <TriangleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Pastilla neutra («Borrador», «Verificada»). */
export function Pastilla({ children, oscura = false, className }: { children: ReactNode; oscura?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 self-start rounded-full px-3 py-0.5 text-sm whitespace-nowrap',
        oscura ? 'bg-primary font-bold text-primary-foreground' : 'border border-control',
        className,
      )}
    >
      {children}
    </span>
  )
}

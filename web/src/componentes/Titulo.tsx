import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Título de la pantalla: al cambiar de pantalla, el foco va aquí (RNF-08). Archivo 800 ancho. */
export function Titulo({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <h1 ref={ref} tabIndex={-1} className={cn('titular m-0 [overflow-wrap:anywhere]', className)}>
      {children}
    </h1>
  )
}

import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Título de la pantalla: al cambiar de pantalla, el foco va aquí (RNF-08). Archivo 800 ancho. */
export function Titulo({ children, className, base = 'titular' }: { children: ReactNode; className?: string; base?: 'titular' | 'titulo-proto' }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <h1 ref={ref} tabIndex={-1} className={cn(base, 'm-0 [overflow-wrap:anywhere]', className)}>
      {children}
    </h1>
  )
}

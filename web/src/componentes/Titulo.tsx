import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Título de la pantalla: al cambiar de pantalla, el foco va aquí (RNF-08). */
export function Titulo({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <h1 ref={ref} tabIndex={-1} className={cn('m-0 font-bold leading-tight', className)}>
      {children}
    </h1>
  )
}

import type { ReactNode } from 'react'

import { useRol } from '@/contexto/Rol'
import { cn } from '@/lib/utils'

import { Encabezado } from './Encabezado'
import { NavInferior } from './NavInferior'

/** Entidad, en escritorio: fondo gris y contenido de hasta 1200 px. */
export function MarcoEntidad({ entidad, children }: { entidad?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted text-foreground">
      <Encabezado variante="escritorio" quien={entidad ?? 'Entidad de prueba'} rol="Entidad" />
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-6">{children}</main>
    </div>
  )
}

interface PropsMarcoRol {
  quien?: string | null
  /** Etiqueta del rol que se ve en PC («Beneficiario», «Punto de retiro»). */
  rol?: string
  /** Secciones del beneficiario: abajo en el celular, en la barra superior en PC. */
  nav?: boolean
  /**
   * `angosto`: una tarea a la vez (cobrar, PIN, enlazar), centrada en PC.
   * `ancho`: la vista usa columnas en PC (inicio, nuevo cobro, puntos).
   */
  ancho?: 'angosto' | 'ancho'
  children: ReactNode
}

/**
 * Beneficiario y punto. En el celular (< 768 px), una columna a todo el ancho con la navegación
 * abajo; en PC y tablet, la barra completa arriba y el contenido centrado.
 */
export function MarcoRol({ quien, rol, nav = false, ancho = 'angosto', children }: PropsMarcoRol) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Encabezado variante="celular" quien={quien ?? undefined} rol={rol} secciones={nav} />
      <main
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-[18px] px-5 pt-6 pb-5 md:gap-6 md:px-6 md:pt-10 md:pb-14',
          ancho === 'ancho' ? 'md:max-w-[1200px]' : 'md:max-w-[680px]',
        )}
      >
        {children}
      </main>
      {nav && <NavInferior />}
    </div>
  )
}

export function MarcoBeneficiario({ children, nav = true, ancho }: { children: ReactNode; nav?: boolean; ancho?: PropsMarcoRol['ancho'] }) {
  const { nombre } = useRol()
  return (
    <MarcoRol quien={nombre} rol="Beneficiario" nav={nav} ancho={ancho}>
      {children}
    </MarcoRol>
  )
}

export function MarcoPunto({ children, ancho }: { children: ReactNode; ancho?: PropsMarcoRol['ancho'] }) {
  const { puntoNombre } = useRol()
  return (
    <MarcoRol quien={puntoNombre?.split(' — ')[0]} rol="Punto de retiro" ancho={ancho}>
      {children}
    </MarcoRol>
  )
}

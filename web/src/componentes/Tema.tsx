import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

// Modo oscuro (docs/piloto/Plan modo oscuro.md): index.html pone `data-tema` antes de pintar. Aquí
// solo se cambia y se recuerda; sin elección guardada, se sigue al sistema también en vivo.

const CLAVE = 'tatu.tema'
type NombreTema = 'claro' | 'oscuro'

const FONDO: Record<NombreTema, string> = { claro: '#F5F0E6', oscuro: '#0B1324' }

function aplicar(t: NombreTema) {
  document.documentElement.dataset.tema = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', FONDO[t])
}

function guardado(): NombreTema | null {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : null
  } catch {
    return null
  }
}

function useTema() {
  const [tema, setTema] = useState<NombreTema>(() => (document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro'))

  useEffect(() => {
    aplicar(tema)
  }, [tema])

  useEffect(() => {
    const sistema = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => {
      if (!guardado()) setTema(sistema.matches ? 'oscuro' : 'claro')
    }
    sistema.addEventListener('change', alCambiar)
    return () => sistema.removeEventListener('change', alCambiar)
  }, [])

  const alternar = () =>
    setTema((t) => {
      const nuevo = t === 'oscuro' ? 'claro' : 'oscuro'
      try {
        localStorage.setItem(CLAVE, nuevo)
      } catch {
        // Sin almacenamiento: el tema dura lo que dure la pestaña.
      }
      return nuevo
    })

  return { oscuro: tema === 'oscuro', alternar }
}

/** Botón ☀/☾ del encabezado. `sobreBloque`: en la barra Noche de la entidad. */
export function BotonTema({ sobreBloque = false }: { sobreBloque?: boolean }) {
  const { oscuro, alternar } = useTema()
  const Icono = oscuro ? Sun : Moon
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oscuro}
      aria-label="Modo oscuro"
      title={oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full border',
        sobreBloque ? 'border-noche-tenue text-bloque-texto hover:text-ambar' : 'border-border text-foreground hover:bg-muted',
      )}
    >
      <Icono aria-hidden className="size-5" />
    </button>
  )
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

// El rol se elige sin login (HU-19) y se recuerda al recargar. Va en localStorage y no en
// sessionStorage (D-20): la aprobación en la Test Wallet vuelve a la app en otra pestaña.
// Solo guarda ids y la cédula de prueba: nada sensible.

export type NombreRol = 'entidad' | 'beneficiario' | 'punto'

export interface SeleccionRol {
  rol: NombreRol | null
  programaId: string | null
  documento: string | null
  /** Nombre corto para el encabezado del celular («Ana»). */
  nombre: string | null
  puntoId: string | null
  puntoNombre: string | null
}

const CLAVE = 'tatu.rol'

const VACIA: SeleccionRol = {
  rol: null,
  programaId: null,
  documento: null,
  nombre: null,
  puntoId: null,
  puntoNombre: null,
}

function leer(): SeleccionRol {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? { ...VACIA, ...(JSON.parse(crudo) as Partial<SeleccionRol>) } : VACIA
  } catch {
    return VACIA
  }
}

function escribir(s: SeleccionRol) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(s))
  } catch {
    // Navegación privada o almacenamiento bloqueado: el rol dura lo que dure la pestaña.
  }
}

interface ValorRol extends SeleccionRol {
  actualizar: (cambios: Partial<SeleccionRol>) => void
}

const ContextoRol = createContext<ValorRol | null>(null)

export function RolProvider({ children }: { children: ReactNode }) {
  const [seleccion, setSeleccion] = useState<SeleccionRol>(leer)

  const actualizar = useCallback((cambios: Partial<SeleccionRol>) => {
    setSeleccion((previa) => {
      const nueva = { ...previa, ...cambios }
      escribir(nueva)
      return nueva
    })
  }, [])

  const valor = useMemo(() => ({ ...seleccion, actualizar }), [seleccion, actualizar])
  return <ContextoRol.Provider value={valor}>{children}</ContextoRol.Provider>
}

export function useRol(): ValorRol {
  const v = useContext(ContextoRol)
  if (!v) throw new Error('useRol se usa dentro de <RolProvider>')
  return v
}

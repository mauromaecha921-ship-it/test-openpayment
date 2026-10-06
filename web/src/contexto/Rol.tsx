import { createContext, useContext, useState, type ReactNode } from 'react'

// HU-19 / P-15: el rol vive en sessionStorage (sobrevive a recargas, muere al
// cerrar la pestaña); nunca se guardan datos sensibles aquí.
export type Rol = 'entidad' | 'beneficiario' | 'punto'

const CLAVE = 'tatu-rol'

interface RolContexto {
  rol: Rol | null
  elegirRol: (rol: Rol) => void
  salir: () => void
}

const Contexto = createContext<RolContexto | null>(null)

function leerRolGuardado(): Rol | null {
  const guardado = sessionStorage.getItem(CLAVE)
  return guardado === 'entidad' || guardado === 'beneficiario' || guardado === 'punto'
    ? guardado
    : null
}

export function RolProvider({ children }: { children: ReactNode }) {
  const [rol, setRol] = useState<Rol | null>(leerRolGuardado)

  const elegirRol = (nuevo: Rol) => {
    sessionStorage.setItem(CLAVE, nuevo)
    setRol(nuevo)
  }

  const salir = () => {
    sessionStorage.removeItem(CLAVE)
    setRol(null)
  }

  return <Contexto.Provider value={{ rol, elegirRol, salir }}>{children}</Contexto.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRol() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useRol debe usarse dentro de <RolProvider>')
  return ctx
}

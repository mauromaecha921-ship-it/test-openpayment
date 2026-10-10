import { useEffect } from 'react'

import { api } from '@/api/client'
import type { Tablero } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { useRol } from '@/contexto/Rol'

/** El tablero se consulta cada 5 s mientras la vista está abierta (wireframe 04, D-19). */
export function useTablero(id: string, activo = true) {
  const rol = useRol()
  const consulta = usePolling(() => api.get<Tablero>(`/programas/${id}/tablero`), 5000, activo, { clave: id })
  const programaId = consulta.datos?.programa.id
  useEffect(() => {
    if (programaId) rol.actualizar({ rol: 'entidad', programaId })
  }, [programaId])
  return consulta
}

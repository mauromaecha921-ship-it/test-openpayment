import { useEffect, useState } from 'react'

import { api } from './client'
import type { EstadoSistema } from './tipos'

// Una sola consulta compartida por el encabezado y la página /estado. `null`: la API no respondió.
let cache: Promise<EstadoSistema | null> | null = null
const oyentes = new Set<(e: EstadoSistema | null) => void>()

export function cargarEstado(forzar = false): Promise<EstadoSistema | null> {
  if (forzar || !cache) {
    const actual = api.get<EstadoSistema>('/estado').catch(() => null)
    cache = actual
    void actual.then((e) => oyentes.forEach((f) => f(e)))
  }
  return cache
}

/** `estado` es `undefined` mientras carga y `null` si la API no respondió. */
export function useEstadoSistema() {
  const [estado, setEstado] = useState<EstadoSistema | null | undefined>(undefined)
  useEffect(() => {
    oyentes.add(setEstado)
    void cargarEstado().then(setEstado)
    return () => {
      oyentes.delete(setEstado)
    }
  }, [])
  return { estado, recargar: () => cargarEstado(true) }
}

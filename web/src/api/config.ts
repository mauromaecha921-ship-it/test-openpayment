import { useEffect, useState } from 'react'

import { api } from './client'
import type { Config } from './tipos'

// Valores de las Historias (§ Variables) mientras llega GET /config.
export const CONFIG_INICIAL: Config = {
  pollIntervaloMs: 1000,
  confirmacionTtlSeg: 120,
  extras: { bono: false, qr: false, pdf417: false, contrato: false, deploy: false },
}

let cache: Promise<Config> | null = null

export function cargarConfig(): Promise<Config> {
  cache ??= api.get<Config>('/config').catch(() => {
    cache = null
    return CONFIG_INICIAL
  })
  return cache
}

/** Banderas EXTRA_* y tiempos de consulta (RNF-10). */
export function useConfig(): Config {
  const [config, setConfig] = useState(CONFIG_INICIAL)
  useEffect(() => {
    let vivo = true
    void cargarConfig().then((c) => vivo && setConfig(c))
    return () => {
      vivo = false
    }
  }, [])
  return config
}

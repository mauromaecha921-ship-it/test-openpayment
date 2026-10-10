import { api } from '@/api/client'
import type { ResumenBeneficiario } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { useRol } from '@/contexto/Rol'

/** HU-08: cuánto tiene la persona, su cuenta y su último cobro. */
export function useResumen() {
  const { documento } = useRol()
  return usePolling(() => api.get<ResumenBeneficiario>(`/beneficiarios/${documento}/resumen`), null, false, { clave: documento })
}

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando } from '@/componentes/Comun'
import { MarcoPunto } from '@/componentes/Marcos'
import { useRol } from '@/contexto/Rol'

import NuevoCobro from './NuevoCobro'
import VentaConBono from './VentaConBono'

/**
 * La pantalla de inicio del punto depende de su tipo (§ 11): un punto de retiro entrega efectivo de
 * subsidios («Nuevo cobro»); la sede de un comercio cobra compras con bono («Venta con bono»).
 */
export default function InicioPunto() {
  const { puntoId } = useRol()
  const puntos = usePolling(() => api.get<Punto[]>('/puntos'), null, false, { clave: puntoId })
  if (!puntos.datos && !puntos.error) {
    return (
      <MarcoPunto>
        <Cargando />
      </MarcoPunto>
    )
  }
  const punto = puntos.datos?.find((p) => p.id === puntoId)
  return punto?.tipo === 'compra' ? <VentaConBono /> : <NuevoCobro />
}

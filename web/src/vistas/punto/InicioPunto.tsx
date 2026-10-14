import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando } from '@/componentes/Comun'
import { MarcoPuntoRetiro } from '@/componentes/MarcoPuntoRetiro'
import { useRol } from '@/contexto/Rol'

import { InicioPuntoRetiro } from './InicioPuntoRetiro'
import NuevoCobro from './NuevoCobro'
import VentaConBono from './VentaConBono'

/**
 * Pantalla principal del Punto de Retiro (§ 11):
 * Muestra el Inicio del punto de retiro (Captura 1) con KPIs y cobros de hoy.
 * Al pulsar «+ Nuevo cobro», pasa al flujo de cobro (Capturas 2 y 3).
 */
export default function InicioPunto({ pasoInicial }: { pasoInicial?: 'nuevo' }) {
  const { puntoId } = useRol()
  const [searchParams, setSearchParams] = useSearchParams()

  const inicial = pasoInicial === 'nuevo' || searchParams.get('accion') === 'nuevo'
  const [mostrandoNuevo, setMostrandoNuevo] = useState(inicial)

  const puntos = usePolling(() => api.get<Punto[]>('/puntos'), null, false, { clave: puntoId })

  if (!puntos.datos && !puntos.error) {
    return (
      <MarcoPuntoRetiro>
        <Cargando />
      </MarcoPuntoRetiro>
    )
  }

  const punto = puntos.datos?.find((p) => p.id === puntoId)

  // Si es un comercio de compra con bono, usa la vista de compra
  if (punto?.tipo === 'compra') {
    return <VentaConBono />
  }

  // Si está en el flujo de nuevo cobro (Captura 2 y 3)
  if (mostrandoNuevo) {
    return (
      <NuevoCobro
        onVolverInicio={() => {
          setMostrandoNuevo(false)
          setSearchParams({})
        }}
      />
    )
  }

  // Vista principal del Punto de Retiro (Captura 1)
  return (
    <InicioPuntoRetiro
      onNuevoCobro={() => {
        setMostrandoNuevo(true)
        setSearchParams({ accion: 'nuevo' })
      }}
    />
  )
}

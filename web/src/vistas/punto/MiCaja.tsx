import { useNavigate } from 'react-router'

import { InicioPuntoRetiro } from './InicioPuntoRetiro'

export default function MiCaja() {
  const navegar = useNavigate()
  return <InicioPuntoRetiro onNuevoCobro={() => navegar('/punto?accion=nuevo')} />
}

import type { ComponentProps } from 'react'

import { useRol } from '@/contexto/Rol'

import { PantallaEscritorio, type PestanaEscritorio } from './Proto'

/** Pestañas de la barra de la entidad. «Puntos de retiro» no tiene pantalla en el prototipo: lleva a los puntos del equipo. */
const PESTANAS_ENTIDAD: PestanaEscritorio[] = [
  { to: '/entidad', texto: 'Programas' },
  { to: '/equipo#titulo-punto', texto: 'Puntos de retiro' },
]

/** Pestañas del punto en el computador. «Mi caja» lleva a la caja que ya existe. */
const PESTANAS_PUNTO: PestanaEscritorio[] = [
  { to: '/punto', texto: 'Inicio', fin: true },
  { to: '/punto/caja', texto: 'Mi caja' },
]

type Props = Omit<ComponentProps<typeof PantallaEscritorio>, 'pestanas' | 'quien'> & { quien?: string }

/** La entidad, como en el prototipo (E0 a E5). */
export function PantallaEntidad({ quien, ...resto }: Props) {
  return <PantallaEscritorio pestanas={PESTANAS_ENTIDAD} quien={quien ?? 'Entidad de prueba'} {...resto} />
}

/** El punto en el computador, como en el prototipo (PD0 a PD4). */
export function PantallaPuntoEscritorio({ quien, ...resto }: Props) {
  const { puntoNombre } = useRol()
  return <PantallaEscritorio pestanas={PESTANAS_PUNTO} quien={quien ?? puntoNombre?.split(' — ')[0] ?? 'Punto de retiro'} {...resto} />
}

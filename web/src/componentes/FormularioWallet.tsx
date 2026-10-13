import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { resolverBilletera, type EstadoBilletera } from '@/api/billeteras'
import { MensajeError, Pastilla } from '@/componentes/Comun'

// Piezas de los formularios que piden una wallet («Equipo de prueba»: personas, puntos y comercios).

/** Estado de la wallet escrita: se busca al salir del campo, como en «Conectar programa». */
export function useBilletera() {
  const [valor, setValor] = useState('')
  const [estado, setEstado] = useState<EstadoBilletera>({ estado: 'vacia' })
  const buscar = async () => {
    if (!valor.trim()) return setEstado({ estado: 'vacia' })
    setEstado({ estado: 'buscando' })
    setEstado(await resolverBilletera(valor))
  }
  const limpiar = () => {
    setValor('')
    setEstado({ estado: 'vacia' })
  }
  return { valor, estado, buscar, limpiar, cambiar: (v: string) => (setValor(v), setEstado({ estado: 'vacia' })) }
}

export function AvisoBilletera({ estado }: { estado: EstadoBilletera }) {
  return (
    <div aria-live="polite">
      {estado.estado === 'buscando' && <p className="m-0 text-sm text-muted-foreground">Buscando la wallet…</p>}
      {estado.estado === 'encontrada' && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Check aria-hidden className="size-4 text-pagado" strokeWidth={2.5} />
          <strong>Wallet encontrada</strong>
          {estado.billetera.nombre && <span className="text-muted-foreground">{estado.billetera.nombre}</span>}
          <Pastilla className="ml-auto">{estado.billetera.moneda.codigo}</Pastilla>
        </p>
      )}
      {estado.estado === 'noEncontrada' && <MensajeError>{estado.mensaje}</MensajeError>}
    </div>
  )
}

export function Exito({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-0 flex items-start gap-2 text-[15px] font-bold text-pagado">
      <Check aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.5} />
      <span>{children}</span>
    </p>
  )
}

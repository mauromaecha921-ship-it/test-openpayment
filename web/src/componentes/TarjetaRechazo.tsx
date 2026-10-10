import { Ban, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Cobro } from '@/api/tipos'
import { explicacionMotivo } from '@/lib/textos'

import { Titulo } from './Titulo'

/**
 * Rechazos (wireframes 17 a 19): el título es el mensaje que manda la API, luego la explicación,
 * «No entregues efectivo.» (solo en el punto) y los datos del intento.
 */
export function TarjetaRechazo({ cobro, paraPunto, datos }: { cobro: Cobro; paraPunto: boolean; datos: ReactNode }) {
  const Icono = cobro.estado === 'Fallido' ? TriangleAlert : X
  return (
    <>
      <div role="alert" className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-24 items-center justify-center rounded-full border-4 border-dashed border-rechazo bg-rechazo-fondo text-rechazo">
          <Icono aria-hidden className="size-11" strokeWidth={2.5} />
        </span>
        <Titulo className="text-[26px] leading-tight">{cobro.motivo?.mensaje ?? (cobro.estado === 'Fallido' ? 'El pago falló' : 'El cobro fue rechazado')}</Titulo>
        <p className="m-0 text-[17px] text-muted-foreground">{explicacionMotivo(cobro.motivo?.codigo, cobro.estado)}</p>
      </div>

      {paraPunto && (
        <p className="m-0 flex items-center gap-2.5 rounded-xl border-2 border-foreground px-4 py-3.5 text-lg font-bold">
          <Ban aria-hidden className="size-6 shrink-0" />
          No entregues efectivo.
        </p>
      )}

      {datos}
    </>
  )
}

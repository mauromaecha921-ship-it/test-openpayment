import { Hand } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Cobro } from '@/api/tipos'
import { explicacionMotivo } from '@/lib/textos'

import { Bloque } from './Comun'
import { EstadoCobro } from './EstadoCobro'
import { Titulo } from './Titulo'

/**
 * Rechazos (wireframes 17 a 19, prototipo P6 y P7): chip del estado, el mensaje que manda la API
 * como título, la explicación y, en el punto, el bloque rojo «No entregues efectivo». Debajo, los
 * datos del intento.
 */
export function TarjetaRechazo({ cobro, paraPunto, datos }: { cobro: Cobro; paraPunto: boolean; datos: ReactNode }) {
  return (
    <>
      <div role="alert" className="flex flex-col items-start gap-3">
        <EstadoCobro estado={cobro.estado} motivo={cobro.motivo} grande />
        <Titulo className="text-[28px] sm:text-[32px]">{cobro.motivo?.mensaje ?? (cobro.estado === 'Fallido' ? 'El pago falló' : 'El cobro fue rechazado')}</Titulo>
        <p className="m-0 text-[17px] text-muted-foreground">{explicacionMotivo(cobro.motivo?.codigo, cobro.estado)}</p>
      </div>

      {paraPunto && (
        <Bloque tono="rechazo" className="flex-row items-center gap-4">
          <Hand aria-hidden className="size-9 shrink-0" />
          <span className="flex flex-col gap-0.5">
            <strong className="titular text-[22px]">
              {cobro.canal === 'compra' ? 'El bono no se aplicó' : 'No entregues efectivo'}
            </strong>
            <span className="text-[15px]">
              {cobro.canal === 'compra' ? 'Cobra la compra completa por otro medio.' : 'No se movió dinero.'}
            </span>
          </span>
        </Bloque>
      )}

      {datos}
    </>
  )
}

import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { API_SIMULADA } from '@/api/client'
import { useEstadoSistema } from '@/api/estado'
import { cn } from '@/lib/utils'

/**
 * «Pagos reales» o «Pagos simulados», en el encabezado. Lleva a /estado, que dice qué falta.
 * En el modo «API simulada» no se muestra: ahí ya está la pastilla «API simulada».
 */
export function EstadoPagos({ corto = false }: { corto?: boolean }) {
  const { estado } = useEstadoSistema()
  if (API_SIMULADA || estado === undefined) return null

  const real = estado?.pagosReales === true
  const texto = estado === null ? 'Sin API' : real ? 'Pagos reales' : 'Pagos simulados'
  return (
    <Link
      to="/estado"
      title={real ? 'Los pagos salen de verdad hacia la Test Wallet' : 'Nada sale de la Test Wallet: mira qué falta'}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap no-underline',
        real
          ? 'border-pagado bg-pagado-fondo text-pagado hover:text-pagado'
          : 'border-pagando bg-pagando-fondo text-pagando hover:text-pagando',
      )}
    >
      {real ? <CircleCheck aria-hidden className="size-4" /> : <TriangleAlert aria-hidden className="size-4" />}
      <span className={cn(corto && 'sr-only md:not-sr-only')}>{texto}</span>
    </Link>
  )
}

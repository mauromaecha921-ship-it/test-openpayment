import type { Cuenta } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { textoLlave } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * A dónde llega el pago: la llave Bre-B enmascarada («Bre-B · Celular 300***4567») o, si la persona
 * escribió una wallet a mano, la wallet (Plan Bre-B: la persona no tiene por qué ver una URL).
 */
export function CuentaDestino({
  cuenta,
  completa = false,
  className,
}: {
  cuenta: Pick<Cuenta, 'billetera' | 'tipoLlave' | 'llave'>
  completa?: boolean
  className?: string
}) {
  if (cuenta.tipoLlave && cuenta.llave) {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[13px] font-bold">Bre-B</span>
        <span className="mono text-[15px]">{textoLlave(cuenta.tipoLlave, cuenta.llave)}</span>
      </span>
    )
  }
  return <BilleteraCorta url={cuenta.billetera} completa={completa} className={className} />
}

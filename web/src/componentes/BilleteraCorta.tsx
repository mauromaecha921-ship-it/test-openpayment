import { billeteraCorta } from '@/lib/textos'
import { cn } from '@/lib/utils'

/** `https://ilp.interledger-test.dev/ana` → `…/ana`, en fuente mono, con la dirección completa al pasar. */
export function BilleteraCorta({ url, completa = false, className }: { url: string; completa?: boolean; className?: string }) {
  return (
    <span className={cn('mono text-sm [overflow-wrap:anywhere]', className)} title={url}>
      {completa ? url : billeteraCorta(url)}
    </span>
  )
}

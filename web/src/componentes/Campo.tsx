import { useId, type ComponentProps, type ReactNode } from 'react'

import { Input } from '@/componentes/ui/input'
import { cn } from '@/lib/utils'

/** Campo de texto con su etiqueta encima y una ayuda opcional debajo, del tamaño de los wireframes. */
export function Campo({
  etiqueta,
  ayuda,
  error,
  mono = false,
  className,
  claseInput,
  proto,
  ...props
}: {
  etiqueta: ReactNode
  ayuda?: ReactNode
  error?: string | null
  mono?: boolean
  className?: string
  claseInput?: string
  /** Los campos del prototipo HTML: `escritorio` (48 px) o `celular` (56 px, 18 px de letra). */
  proto?: 'escritorio' | 'celular'
} & Omit<ComponentProps<'input'>, 'className'>) {
  const generado = useId()
  const id = props.id ?? generado
  const idAyuda = `${id}-ayuda`
  const idError = `${id}-error`
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('font-bold', proto === 'escritorio' ? 'text-[15px]' : proto === 'celular' ? 'text-base' : 'text-sm')}>
        {etiqueta}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined}
        className={cn(
          'h-auto min-h-12 rounded-lg border-control px-3 py-2.5 text-base text-foreground md:text-base',
          proto === 'escritorio' && 'min-h-12 rounded-[10px] border-[1.5px] border-campo-borde bg-campo px-3',
          proto === 'celular' && 'min-h-14 rounded-xl border-2 border-campo-borde bg-card px-3.5 text-lg md:text-lg',
          mono && 'mono text-[15px] md:text-[15px]',
          claseInput,
        )}
        {...props}
      />
      {ayuda && (
        <span id={idAyuda} className={cn('text-sm font-normal', proto ? 'text-muted-foreground' : 'text-tenue')}>
          {ayuda}
        </span>
      )}
      {error && (
        <span id={idError} role="alert" className="text-sm font-bold text-rechazo">
          {error}
        </span>
      )}
    </div>
  )
}

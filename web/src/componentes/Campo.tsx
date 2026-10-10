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
  ...props
}: {
  etiqueta: ReactNode
  ayuda?: ReactNode
  error?: string | null
  mono?: boolean
  className?: string
  claseInput?: string
} & Omit<ComponentProps<'input'>, 'className'>) {
  const generado = useId()
  const id = props.id ?? generado
  const idAyuda = `${id}-ayuda`
  const idError = `${id}-error`
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-bold">
        {etiqueta}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined}
        className={cn(
          'h-auto min-h-12 rounded-lg border-control px-3 py-2.5 text-base text-foreground md:text-base',
          mono && 'mono text-[15px] md:text-[15px]',
          claseInput,
        )}
        {...props}
      />
      {ayuda && (
        <span id={idAyuda} className="text-sm font-normal text-tenue">
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

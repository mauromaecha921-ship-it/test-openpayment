import { Delete } from 'lucide-react'
import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react'

import { cn } from '@/lib/utils'

const LARGO = 4

/** Agrega un dígito sin pasar de 4 (función pura, para el estado y los tests). */
export function agregarDigito(pin: string, d: string): string {
  return pin.length < LARGO ? pin + d : pin
}

/**
 * Teclado de 3 × 4 del wireframe 15 con el estilo del prototipo: 1 a 9, «Limpiar», 0 y ⌫ (borrar). El PIN vive solo en el estado
 * del componente que lo usa; también se puede digitar con el teclado físico. Usa actualizaciones
 * funcionales: dos toques seguidos antes de volver a pintar no pierden un dígito.
 */
export function TecladoPin({ onChange, deshabilitado = false }: { onChange: Dispatch<SetStateAction<string>>; deshabilitado?: boolean }) {
  const agregar = (d: string) => !deshabilitado && onChange((p) => agregarDigito(p, d))
  const borrar = () => !deshabilitado && onChange((p) => p.slice(0, -1))
  const limpiar = () => !deshabilitado && onChange('')

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) agregar(e.key)
      else if (e.key === 'Backspace') borrar()
      else if (e.key === 'Escape') limpiar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  })

  const teclas: Array<{ texto: ReactNode; aria: string; accion: () => void; chica?: boolean; plana?: boolean }> = [
    ...'123456789'.split('').map((d) => ({ texto: d, aria: `Dígito ${d}`, accion: () => agregar(d) })),
    { texto: 'Limpiar', aria: 'Limpiar: borrar todo el PIN', accion: limpiar, chica: true, plana: true },
    { texto: '0', aria: 'Dígito 0', accion: () => agregar('0') },
    { texto: <Delete className="mx-auto size-7" />, aria: 'Borrar un dígito', accion: borrar, plana: true },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {teclas.map((t) => (
        <button
          key={t.aria}
          type="button"
          aria-label={t.aria}
          disabled={deshabilitado}
          onClick={t.accion}
          className={cn(
            'h-[60px] rounded-xl font-bold text-foreground disabled:opacity-50',
            t.plana ? 'bg-transparent active:bg-muted' : 'border border-border bg-card active:bg-muted',
            t.chica ? 'text-base text-muted-foreground' : 'text-[26px]',
          )}
        >
          {t.texto}
        </button>
      ))}
    </div>
  )
}

/** Las 4 casillas del PIN, con su lectura para lector de pantalla («2 de 4 dígitos»). */
export function PuntosPin({ largo }: { largo: number }) {
  return (
    <div role="img" aria-label={`${largo} de ${LARGO} dígitos`} className="flex gap-2.5">
      {Array.from({ length: LARGO }, (_, i) => (
        <span
          key={i}
          className={cn(
            'flex h-14 w-[52px] items-center justify-center rounded-xl border-2 bg-white',
            i < largo || i === largo ? 'border-noche' : 'border-white',
          )}
        >
          {i < largo && <span className="size-3.5 rounded-full bg-noche" />}
        </span>
      ))}
    </div>
  )
}

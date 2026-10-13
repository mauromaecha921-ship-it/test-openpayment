import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { CERRADURA, LINEA, SOMBRA, VIEWBOX } from './tatuTrazos'

/** Una vuelta completa. Rueda en el sentido del reloj: hacia donde mira la cabeza. */
const VUELTA_MS = 1400

export type EstadoTatu = 'pagando' | 'pagado'

interface Props {
  estado: EstadoTatu
  /** `rodar`: solo rueda. `cerradura`: además la cerradura late y al pagar se vuelve verde. */
  variante: 'rodar' | 'cerradura'
  /** Fuerza el modo sin movimiento (para la demo); si no, se sigue la preferencia del sistema. */
  sinMovimiento?: boolean
  className?: string
}

function prefiereQuieto() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * El tatú enrollado del logo, rodando mientras el cobro está en «Pagando». Es decorativo: el estado
 * siempre lo dice el texto que lo acompaña.
 */
export function TatuAnimado({ estado, variante, sinMovimiento, className }: Props) {
  const cuerpo = useRef<SVGGElement>(null)
  const suelo = useRef<HTMLSpanElement>(null)
  const cerradura = useRef<SVGPathElement>(null)
  const quieto = sinMovimiento ?? prefiereQuieto()
  // Si ya llega pagado (la pantalla de «Pagado» es otra), la cerradura arranca ámbar y cambia a
  // verde en el primer cuadro, para que se vea abrirse.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    // setTimeout y no requestAnimationFrame: si la pestaña no dibuja, igual debe quedar verde.
    const t = setTimeout(() => setMontado(true), 50)
    return () => clearTimeout(t)
  }, [])

  // Rodar, y al pagar terminar la vuelta en curso hasta quedar derecho.
  useEffect(() => {
    const g = cuerpo.current
    const s = suelo.current
    if (!g || !s || quieto) return
    if (estado !== 'pagando') return

    const giro = g.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: VUELTA_MS, iterations: Infinity })
    const piso = s.animate([{ backgroundPositionX: '0px' }, { backgroundPositionX: '-72px' }], {
      duration: VUELTA_MS / 2,
      iterations: Infinity,
    })
    return () => {
      const t = Number(giro.currentTime ?? 0)
      const avance = (t % VUELTA_MS) / VUELTA_MS
      giro.cancel()
      piso.cancel()
      // Lo que falta de la vuelta, frenando. Si iba casi al final, da una vuelta más corta.
      const desde = avance * 360
      const hasta = avance > 0.75 ? 720 : 360
      g.animate([{ rotate: `${desde}deg` }, { rotate: `${hasta}deg` }], {
        duration: ((hasta - desde) / 360) * VUELTA_MS * 1.8,
        easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      })
    }
  }, [estado, quieto])

  // La cerradura: late mientras paga; al pagar, «se abre» con un salto corto.
  useEffect(() => {
    const c = cerradura.current
    if (!c || variante !== 'cerradura' || quieto) return
    if (estado === 'pagando') {
      const latido = c.animate([{ scale: '1' }, { scale: '1.12' }, { scale: '1' }], {
        duration: 1100,
        iterations: Infinity,
        easing: 'ease-in-out',
      })
      return () => latido.cancel()
    }
    if (!montado) return
    c.animate([{ scale: '1' }, { scale: '1.3' }, { scale: '0.95' }, { scale: '1' }], { duration: 650, delay: 250, easing: 'ease-out' })
  }, [estado, variante, quieto, montado])

  const verde = variante === 'cerradura' && estado === 'pagado' && (montado || quieto)

  return (
    <span aria-hidden className={cn('relative inline-flex flex-col items-center', className)}>
      {verde && !quieto && <span className="tatu-halo absolute top-[62%] left-[44%] size-[45%] rounded-full" />}
      <svg viewBox={VIEWBOX} className="relative min-h-0 w-full flex-1 overflow-visible">
        <g ref={cuerpo} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path d={SOMBRA} fill="#9C5A3C" fillOpacity={0.16} />
          <path
            ref={cerradura}
            d={CERRADURA}
            className="transition-[fill] duration-500"
            fill={verde ? 'var(--pagado-relleno)' : 'var(--ambar)'}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
          <path d={LINEA} fill="var(--noche)" fillRule="evenodd" />
        </g>
      </svg>
      {/* El suelo: rayitas que corren hacia atrás mientras rueda. */}
      <span
        ref={suelo}
        className={cn('tatu-suelo -mt-1 h-1 w-[120%] shrink-0 rounded-full transition-opacity duration-500', estado === 'pagando' && !quieto ? 'opacity-100' : 'opacity-0')}
      />
    </span>
  )
}

/** Para las pantallas de «Pagado»: el tatú con la cerradura abierta y un chulito verde al lado. */
export function TatuPagado({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-flex', className)}>
      <TatuAnimado estado="pagado" variante="cerradura" className="size-full" />
      <span className="absolute right-0 bottom-[6%] flex size-[34%] items-center justify-center rounded-full border-[3px] border-background bg-pagado-relleno text-primary-foreground">
        <Check className="size-[60%]" strokeWidth={3.5} />
      </span>
    </span>
  )
}

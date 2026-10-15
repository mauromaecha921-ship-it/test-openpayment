import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { TatuPagado, type EstadoTatu } from './TatuAnimado'
import { CUADROS_GEMINI, VIEWBOX_GEMINI } from './tatuGeminiTrazos'

const CAMINA_MS = 1200
const PASO_MS = 300
const POSE_MS = 220
/** Una vuelta de la bolita. Rueda en el sentido del reloj, hacia donde caminaba. */
const VUELTA_MS = 1100
const PASO_SUELO = 72
/** Centro de la bolita, (120, 104) en un viewBox de 240 × 200. */
const CENTRO_BOLA = '50% 52%'
/** Rebote con estiramiento (squash and stretch) al cambiar de pose, tomado de la versión de Gemini. */
const REBOTE: Keyframe[] = [
  { transform: 'translateY(0) scale(1)' },
  { transform: 'translateY(-4%) scale(0.97, 1.04)', offset: 0.35 },
  { transform: 'translateY(1%) scale(1.03, 0.96)', offset: 0.7 },
  { transform: 'translateY(0) scale(1)' },
]

type Fase = 'camina' | 'agacha' | 'encorva' | 'rueda' | 'frena' | 'final'
const CUADRO: Record<Fase, number> = { camina: 0, agacha: 1, encorva: 2, rueda: 3, frena: 3, final: 3 }

function prefiereQuieto() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface Props {
  estado: EstadoTatu
  sinMovimiento?: boolean
  className?: string
}

/**
 * Opción D de /demo/tatu: los dibujos de Gemini con las fases de la app. Entra caminando, se
 * agacha, se encorva y rueda girando mientras el cobro está en «Pagando»; al pagar termina la
 * vuelta derecho y salta al logo oficial con la cerradura verde. Trazo en el color del texto y
 * relleno en el de la superficie (`--tatu-fondo`, por defecto la tarjeta). Decorativo.
 */
export function TatuGemini({ estado, sinMovimiento, className }: Props) {
  const quieto = sinMovimiento ?? prefiereQuieto()
  const [fase, setFase] = useState<Fase>(quieto ? 'rueda' : 'camina')
  const escena = useRef<HTMLSpanElement>(null)
  const cuerpo = useRef<HTMLSpanElement>(null)
  const giro = useRef<HTMLSpanElement>(null)
  const suelo = useRef<HTMLSpanElement>(null)
  const logo = useRef<HTMLSpanElement>(null)
  const animGiro = useRef<Animation | null>(null)
  const frenaMs = useRef(0)

  // Rebote en cada cambio de pose
  useEffect(() => {
    if (quieto || fase === 'rueda' || fase === 'frena') return
    cuerpo.current?.animate(REBOTE, { duration: fase === 'camina' ? PASO_MS : POSE_MS * 1.6, iterations: fase === 'camina' ? CAMINA_MS / PASO_MS : 1, easing: 'ease-out' })
  }, [fase, quieto])

  // Camina entrando desde la izquierda; después dos poses para enrollarse
  useEffect(() => {
    if (quieto) return
    if (fase === 'camina') {
      escena.current?.animate([{ transform: 'translateX(-40%)' }, { transform: 'translateX(0)' }], { duration: CAMINA_MS, easing: 'ease-out' })
      const t = setTimeout(() => setFase('agacha'), CAMINA_MS)
      return () => clearTimeout(t)
    }
    if (fase === 'agacha' || fase === 'encorva') {
      const t = setTimeout(() => setFase(fase === 'agacha' ? 'encorva' : 'rueda'), POSE_MS)
      return () => clearTimeout(t)
    }
  }, [fase, quieto])

  // Rueda girando entera, con el suelo corriendo debajo
  useEffect(() => {
    if (quieto || fase !== 'rueda') return
    animGiro.current = giro.current?.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: VUELTA_MS, iterations: Infinity }) ?? null
    const piso = suelo.current?.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${PASO_SUELO}px)` }], {
      duration: VUELTA_MS / 2,
      iterations: Infinity,
    })
    return () => piso?.cancel()
  }, [fase, quieto])

  // Al pagar: termina la vuelta frenando hasta quedar derecho y luego pasa al logo
  useEffect(() => {
    if (estado !== 'pagado') return
    if (quieto) {
      setFase('final')
      return
    }
    if (fase !== 'rueda') return
    const a = animGiro.current
    const avance = a ? (Number(a.currentTime ?? 0) % VUELTA_MS) / VUELTA_MS : 0
    a?.cancel()
    const desde = avance * 360
    const hasta = avance > 0.75 ? 720 : 360
    const ms = ((hasta - desde) / 360) * VUELTA_MS * 1.6
    giro.current?.animate([{ transform: `rotate(${desde}deg)` }, { transform: `rotate(${hasta}deg)` }], {
      duration: ms,
      easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      fill: 'forwards',
    })
    frenaMs.current = ms
    setFase('frena')
  }, [estado, fase, quieto])

  useEffect(() => {
    if (fase !== 'frena') return
    const t = setTimeout(() => setFase('final'), frenaMs.current)
    return () => clearTimeout(t)
  }, [fase])

  // El logo entra con un salto corto (de la versión de Gemini), sin cruzarse con la bolita
  useEffect(() => {
    if (fase !== 'final' || quieto) return
    logo.current?.animate(
      [
        { transform: 'scale(0.86) rotate(-12deg)', opacity: 0 },
        { transform: 'scale(1.07) rotate(2deg)', opacity: 1, offset: 0.4 },
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      ],
      { duration: 450, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  }, [fase, quieto])

  const conLogo = fase === 'final' && estado === 'pagado'

  return (
    <span aria-hidden className={cn('relative inline-flex flex-col items-center', className)}>
      <span ref={escena} className="relative min-h-0 w-full flex-1">
        {conLogo ? (
          <span ref={logo} className="absolute inset-0 flex items-center justify-center">
            <TatuPagado className="aspect-square h-[78%]" />
          </span>
        ) : (
          <span ref={cuerpo} className="absolute inset-0" style={{ transformOrigin: '50% 80%' }}>
            <span ref={giro} className="absolute inset-0" style={{ transformOrigin: CENTRO_BOLA }}>
              <svg viewBox={VIEWBOX_GEMINI} className="size-full overflow-visible text-foreground">
                {CUADROS_GEMINI[CUADRO[fase]].map((t, i) => (
                  <path
                    key={`${CUADRO[fase]}-${i}`}
                    d={t.d}
                    fill={t.relleno ? 'var(--tatu-fondo, var(--card))' : 'none'}
                    stroke="currentColor"
                    strokeWidth={t.grosor}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            </span>
          </span>
        )}
      </span>
      <span
        className={cn(
          '-mt-2 h-1 w-full shrink-0 overflow-hidden rounded-full transition-opacity duration-500',
          !quieto && (fase === 'camina' || fase === 'rueda') ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span ref={suelo} className="tatu-suelo block h-full" style={{ width: `calc(100% + ${PASO_SUELO}px)` }} />
      </span>
    </span>
  )
}

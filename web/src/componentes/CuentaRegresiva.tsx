import { useEffect, useRef, useState } from 'react'

import { formatCuentaRegresiva } from '@/lib/textos'

/** Segundos que faltan hasta `hasta` (ISO). Llama `alTerminar` una sola vez al llegar a cero. */
export function useCuentaRegresiva(hasta: string | null, alTerminar?: () => void): number | null {
  const calcular = () => (hasta ? Math.max(0, (Date.parse(hasta) - Date.now()) / 1000) : null)
  const [restante, setRestante] = useState(calcular)
  const avisado = useRef(false)
  const alTerminarRef = useRef(alTerminar)
  alTerminarRef.current = alTerminar

  useEffect(() => {
    avisado.current = false
    setRestante(calcular())
    if (!hasta) return
    const t = setInterval(() => {
      const r = calcular()
      setRestante(r)
      if (r === 0 && !avisado.current) {
        avisado.current = true
        alTerminarRef.current?.()
      }
    }, 250)
    return () => clearInterval(t)
  }, [hasta])

  return restante
}

/** «01:54 para confirmar» (120 s desde que el punto digitó la cédula, RN-12). */
export function CuentaRegresiva({ segundos }: { segundos: number | null }) {
  if (segundos === null) return null
  return (
    <span>
      <time>{formatCuentaRegresiva(segundos)}</time> para confirmar
    </span>
  )
}

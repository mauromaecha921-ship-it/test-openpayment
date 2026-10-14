import { useEffect, useState } from 'react'

/** El prototipo pasa a la versión de computador desde 960 px (WIDE en su script). */
const ANCHO = 960

/** true desde 960 px de ancho: el punto usa sus pantallas de computador (PD0 a PD4). */
export function useEscritorio(): boolean {
  const consulta = `(min-width: ${ANCHO}px)`
  const [ancho, setAncho] = useState(() => typeof matchMedia === 'function' && matchMedia(consulta).matches)
  useEffect(() => {
    const m = matchMedia(consulta)
    const alCambiar = () => setAncho(m.matches)
    m.addEventListener('change', alCambiar)
    return () => m.removeEventListener('change', alCambiar)
  }, [consulta])
  return ancho
}

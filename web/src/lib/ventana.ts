/**
 * Abre una pestaña en el mismo clic (si se abre después de un `await`, el navegador la bloquea) y
 * devuelve con qué llevarla a la URL cuando llegue. Si el navegador bloquea la pestaña, se navega
 * en la misma. La Test Wallet vuelve a la app por el callback, en la pestaña que la abrió.
 */
export function prepararPestana(): { ir: (url: string) => void; cerrar: () => void } {
  const w = window.open('', '_blank')
  if (w) w.opener = null
  return {
    ir: (url) => {
      const absoluta = new URL(url, location.origin).toString()
      if (w && !w.closed) w.location.href = absoluta
      else location.assign(absoluta)
    },
    cerrar: () => {
      if (w && !w.closed) w.close()
    },
  }
}

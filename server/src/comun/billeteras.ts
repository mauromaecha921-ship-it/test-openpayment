/**
 * Wallet addresses (HU-01): la persona escribe `$ilp.interledger-test.dev/ana` o
 * `https://ilp.interledger-test.dev/ana`; se guarda siempre la forma https, sin `/` final.
 */
export function normalizarBilletera(entrada: string): string {
  let texto = entrada.trim()
  if (texto.startsWith('$')) texto = `https://${texto.slice(1)}`
  if (!/^https:\/\//i.test(texto)) throw new Error('La wallet address debe empezar por $ o https://')

  const url = new URL(texto)
  if (url.search || url.hash || url.username || url.password) {
    throw new Error('La wallet address no lleva parámetros')
  }
  return `https://${url.host}${url.pathname}`.replace(/\/+$/, '')
}

/** Igual que normalizar, pero devuelve null en lugar de lanzar. */
export function intentarNormalizar(entrada: string): string | null {
  try {
    return normalizarBilletera(entrada)
  } catch {
    return null
  }
}

/** Dos URLs de wallet son la misma aunque una tenga `/` al final. */
export function mismaBilletera(a: string, b: string): boolean {
  return intentarNormalizar(a) === intentarNormalizar(b)
}

/** «…/tatu-punto1»: lo que muestran las pantallas. */
export function billeteraCorta(url: string): string {
  const partes = url.replace(/\/+$/, '').split('/')
  return `…/${partes[partes.length - 1] ?? ''}`
}

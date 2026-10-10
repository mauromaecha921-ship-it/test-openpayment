import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Verificación del hash del callback (HU-04, Hallazgos § 3.5). También la usa cuentas/.
 *
 *   hash = base64( sha256( nonce \n finish_nonce \n interact_ref \n grant_url ) )
 *
 * La doc oficial es inconsistente (ejemplo en base64url, código en base64 estándar), así que se
 * aceptan 6 candidatos: base64 estándar con y sin `=`, base64url, por grant_url con y sin `/`
 * final. Después de V-05 se deja solo la variante que use la Test Wallet.
 */
export interface DatosHash {
  nonceCliente: string
  nonceCierre: string
  interactRef: string
  urlPermiso: string
}

export type Variante =
  | 'estandar-con-padding'
  | 'estandar-sin-padding'
  | 'base64url'

export function candidatos({ nonceCliente, nonceCierre, interactRef, urlPermiso }: DatosHash) {
  const sinBarra = urlPermiso.replace(/\/+$/, '')
  const urls = [sinBarra, `${sinBarra}/`]
  const lista: { variante: Variante; grantUrl: string; valor: string }[] = []
  for (const grantUrl of urls) {
    const base = `${nonceCliente}\n${nonceCierre}\n${interactRef}\n${grantUrl}`
    const raw = createHash('sha256').update(base).digest('base64')
    lista.push({ variante: 'estandar-con-padding', grantUrl, valor: raw })
    lista.push({ variante: 'estandar-sin-padding', grantUrl, valor: raw.replace(/=+$/, '') })
    lista.push({
      variante: 'base64url',
      grantUrl,
      valor: raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    })
  }
  return lista
}

function igualesSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** Devuelve la variante que coincidió, o null si ninguna (callback inválido). */
export function verificarHash(recibido: string, datos: DatosHash): { variante: Variante; grantUrl: string } | null {
  if (!recibido) return null
  for (const c of candidatos(datos)) {
    if (igualesSeguro(c.valor, recibido)) return { variante: c.variante, grantUrl: c.grantUrl }
  }
  return null
}

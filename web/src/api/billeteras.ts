import { api, ErrorApi, mensajeDeError } from './client'
import type { Billetera } from './tipos'

export type EstadoBilletera =
  | { estado: 'vacia' }
  | { estado: 'buscando' }
  | { estado: 'encontrada'; billetera: Billetera }
  | { estado: 'noEncontrada'; mensaje: string }

/** «Cuenta encontrada» antes de guardar: GET /billeteras/resolver (HU-01). Acepta `$…` o `https://…`. */
export async function resolverBilletera(direccion: string): Promise<EstadoBilletera> {
  try {
    const billetera = await api.get<Billetera>(`/billeteras/resolver?direccion=${encodeURIComponent(direccion.trim())}`)
    return { estado: 'encontrada', billetera }
  } catch (e) {
    return { estado: 'noEncontrada', mensaje: e instanceof ErrorApi && e.status === 404 ? 'No encontramos esa cuenta' : mensajeDeError(e) }
  }
}

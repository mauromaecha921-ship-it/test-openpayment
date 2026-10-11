// Cliente delgado (RNF-01): el navegador SOLO llama a nuestra API; nunca al SDK
// de Open Payments ni a tokens (Guía § Qué no usar).
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

// AD-16: el punto y la app consultan el estado del cobro con esta cadencia.
export const POLL_INTERVALO_MS = 1000

export async function apiGet<T>(ruta: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${ruta}`)
  if (!res.ok) throw new Error(`GET ${ruta} → ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiPost<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo ?? {}),
  })
  if (!res.ok) throw new Error(`POST ${ruta} → ${res.status}`)
  return res.json() as Promise<T>
}

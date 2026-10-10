// Cliente delgado: el navegador solo habla con nuestra API, nunca con Open Payments (AD-04).

export const SIN_CONEXION = 'No pudimos conectar con el servidor. Intenta de nuevo'

export class ErrorApi extends Error {
  readonly codigo: string
  readonly status: number

  constructor(codigo: string, mensaje: string, status: number) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.status = status
  }
}

/** Respuesta cruda: la entrega `fetch` o, en modo simulado, `api/simulada`. */
export interface RespuestaCruda {
  status: number
  cuerpo: unknown
}

type Metodo = 'GET' | 'POST' | 'PATCH'

export const API_SIMULADA =
  import.meta.env.MODE === 'simulada' || import.meta.env.VITE_API_SIMULADA === 'true'

async function porRed(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<RespuestaCruda> {
  let res: Response
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorApi('SinConexion', SIN_CONEXION, 0)
  }
  // El proxy de Vite responde 502/504 cuando la API está apagada.
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    const texto = await res.text().catch(() => '')
    if (!texto.trim().startsWith('{')) throw new ErrorApi('SinConexion', SIN_CONEXION, res.status)
    return { status: res.status, cuerpo: JSON.parse(texto) }
  }
  const texto = await res.text()
  let datos: unknown = null
  if (texto) {
    try {
      datos = JSON.parse(texto)
    } catch {
      throw new ErrorApi('RespuestaInvalida', SIN_CONEXION, res.status)
    }
  }
  return { status: res.status, cuerpo: datos }
}

async function pedir<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  let r: RespuestaCruda
  if (API_SIMULADA) {
    const { responder } = await import('./simulada/servidor')
    r = await responder(metodo, ruta, cuerpo)
  } else {
    r = await porRed(metodo, ruta, cuerpo)
  }
  if (r.status >= 200 && r.status < 300) return r.cuerpo as T

  const err = (r.cuerpo as { error?: { codigo?: string; mensaje?: string } } | null)?.error
  throw new ErrorApi(err?.codigo ?? 'Error', err?.mensaje ?? SIN_CONEXION, r.status)
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo: unknown = {}) => pedir<T>('POST', ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
}

/** Mensaje para mostrar de cualquier error que lance `api`. */
export function mensajeDeError(e: unknown): string {
  return e instanceof ErrorApi ? e.message : SIN_CONEXION
}

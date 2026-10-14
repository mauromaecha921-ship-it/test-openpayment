import { existsSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { normalizarBilletera } from './comun/billeteras.js'

/** Carpeta `api/`, para resolver `.env` y `data/` sin depender del directorio actual. */
export const RAIZ_API = path.resolve(import.meta.dirname, '..')
/** Raíz del repositorio: ahí vive el `.env`, como en la rama de Pablo. */
export const RAIZ_REPO = path.resolve(RAIZ_API, '..')

/** Sin DATABASE_URL, la API usa PostgreSQL local (PGlite) en `api/data/pglite`. */
const BASE_LOCAL = 'pglite:./data/pglite'

const booleano = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1')

const entero = (porDefecto: number) => z.coerce.number().int().positive().default(porDefecto)

/** Vacío en el .env cuenta como «no definido». */
const opcional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined))

const billeteraOpcional = opcional.transform((v, ctx) => {
  if (!v) return undefined
  try {
    return normalizarBilletera(v)
  } catch {
    ctx.addIssue({ code: 'custom', message: 'no es una wallet address válida ($… o https://…)' })
    return z.NEVER
  }
})

const esquema = z.object({
  PORT: entero(3000),
  APP_BASE_URL: z.url().transform((v) => v.replace(/\/+$/, '')),
  API_BASE_URL: z.url().transform((v) => v.replace(/\/+$/, '')),
  LIQUIDACION_URL: z.url().transform((v) => v.replace(/\/+$/, '')),
  // PostgreSQL (Supabase) o PGlite: «pglite:ruta» en disco, «pglite:memoria» para las pruebas
  DATABASE_URL: z.string().trim().default(BASE_LOCAL),

  // Cliente Open Payments: solo backend. Opcionales aquí para que la API arranque con la
  // semilla «solo UI»; el adaptador exige que estén al crear el cliente.
  OP_CLIENT_WALLET_ADDRESS: billeteraOpcional,
  OP_KEY_ID: opcional,
  OP_PRIVATE_KEY_BASE64: opcional,
  OP_PRIVATE_KEY_PATH: opcional,

  DEMO_WALLET_PROGRAMA: billeteraOpcional,
  DEMO_WALLET_ANA: billeteraOpcional,
  DEMO_WALLET_LUIS: billeteraOpcional,
  DEMO_WALLET_PUNTO: billeteraOpcional,

  CONFIRMACION_TTL_SEG: entero(120),
  PIN_MAX_INTENTOS: entero(3),
  PIN_BLOQUEO_MIN: entero(15),
  POLL_INTERVALO_MS: entero(1000),
  APROBACION_TTL_MIN: entero(10),
  // D-35: el token del permiso dura 600 s en la Test Wallet; se rota antes de que venza
  TOKEN_RENOVAR_CADA_SEG: entero(120),
  VERIFICACION_CUENTA: z.enum(['subject', 'simulada']).default('subject'),
  LIQUIDACION_SIMULAR_FALLA: booleano,
  // Monto base de la liquidación simulada en unidades mínimas ($230.000 con escala 2)
  LIQUIDACION_MONTO_BASE: z.string().regex(/^[1-9]\d*$/, 'entero positivo en unidades mínimas').default('23000000'),

  EXTRA_BONO: booleano,
  EXTRA_QR: booleano,
  EXTRA_PDF417: booleano,
  EXTRA_CONTRATO: booleano,
  EXTRA_DEPLOY: booleano,
  QR_TTL_SEG: entero(60),
})

export type Config = z.infer<typeof esquema>

let cache: Config | undefined

/**
 * Lee el `.env` de la raíz y luego `api/.env` (si existen) y valida todo con Zod. Node no pisa
 * una variable ya definida, así que manda el de la raíz y el de `api/` completa lo que falte
 * (la rama `piloto` usaba `api/.env`). Si algo falla, el error lista las variables con su
 * problema, nunca sus valores.
 */
export function config(): Config {
  if (cache) return cache
  if (!process.env.TATU_SIN_ENV_ARCHIVO) {
    for (const archivo of [path.join(RAIZ_REPO, '.env'), path.join(RAIZ_API, '.env')]) {
      if (existsSync(archivo)) process.loadEnvFile(archivo)
    }
  }

  completarUrlsDeVercel()

  const r = esquema.safeParse(process.env)
  if (!r.success) {
    const lista = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración inválida en el .env:\n${lista}`)
  }
  if (r.data.OP_PRIVATE_KEY_BASE64 && r.data.OP_PRIVATE_KEY_PATH) {
    throw new Error('Configuración inválida: usa OP_PRIVATE_KEY_BASE64 u OP_PRIVATE_KEY_PATH, no las dos')
  }
  cache = r.data
  return cache
}

/**
 * En Vercel la web y la API comparten dominio: si no se definieron APP_BASE_URL, API_BASE_URL o
 * LIQUIDACION_URL, salen del dominio del despliegue (el de producción, o el de la rama en preview).
 */
function completarUrlsDeVercel() {
  const e = process.env
  if (!e.VERCEL) return
  const dominio =
    e.VERCEL_ENV === 'production' ? (e.VERCEL_PROJECT_PRODUCTION_URL ?? e.VERCEL_URL) : (e.VERCEL_BRANCH_URL ?? e.VERCEL_URL)
  if (!dominio) return
  const base = `https://${dominio}`
  e.APP_BASE_URL ||= base
  e.API_BASE_URL ||= `${base}/api`
  e.LIQUIDACION_URL ||= `${base}/api/liquidacion`
}

/** Solo para pruebas: cambia una variable y vuelve a validar. */
export function reiniciarConfig(cambios: Record<string, string> = {}): Config {
  Object.assign(process.env, cambios)
  cache = undefined
  return config()
}

/** A qué base se conecta la API. `descripcion` sirve para logs y para /salud: nunca lleva la contraseña. */
export type BaseDeDatos =
  | { tipo: 'postgres'; url: string; descripcion: string; aviso?: string }
  | { tipo: 'pglite'; ruta: string | null; descripcion: string; aviso?: string }

const AYUDA_URL =
  'si la contraseña tiene @, #, +, /, ?, : o %, escríbelos codificados (%40, %23, %2B, %2F, %3F, %3A, %25)'

function local(valor: string, aviso?: string): BaseDeDatos {
  const resto = valor.slice('pglite:'.length)
  if (resto === '' || resto === 'memoria') return { tipo: 'pglite', ruta: null, descripcion: 'PostgreSQL en memoria (PGlite)', aviso }
  const ruta = path.resolve(RAIZ_API, resto)
  return { tipo: 'pglite', ruta, descripcion: `PostgreSQL local (PGlite) en ${path.relative(RAIZ_REPO, ruta)}`, aviso }
}

/**
 * La base que indica DATABASE_URL. Una URL de PostgreSQL se revisa sin mostrarla: si la
 * contraseña trae caracteres sin codificar, el servidor que se lee no es el real (D-44).
 */
export function baseDeDatos(): BaseDeDatos {
  const valor = config().DATABASE_URL
  if (valor.startsWith('pglite:')) return local(valor)
  if (valor.startsWith('file:')) {
    // api/.env de la rama `piloto` (SQLite): en v2 se usa la base local hasta que llegue la de Supabase
    return local(BASE_LOCAL, 'DATABASE_URL apunta a SQLite (rama piloto); piloto-v2 usa PostgreSQL: se usa la base local')
  }
  if (!/^postgres(ql)?:\/\//.test(valor)) {
    throw new Error('Configuración inválida: DATABASE_URL debe empezar con postgresql://, postgres:// o pglite:')
  }
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    throw new Error(`Configuración inválida: DATABASE_URL no se puede leer; ${AYUDA_URL}`)
  }
  if (url.hash || !url.hostname.includes('.') || !url.username || !url.pathname.slice(1)) {
    throw new Error(`Configuración inválida: DATABASE_URL está mal armada; ${AYUDA_URL}`)
  }
  const puerto = url.port || '5432'
  return { tipo: 'postgres', url: valor, descripcion: `PostgreSQL en ${url.hostname}:${puerto}/${url.pathname.slice(1)}` }
}

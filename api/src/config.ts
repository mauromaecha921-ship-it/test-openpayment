import { existsSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { normalizarBilletera } from './comun/billeteras.js'

/** Carpeta `api/`, para resolver `.env` y `data/` sin depender del directorio actual. */
export const RAIZ_API = path.resolve(import.meta.dirname, '..')

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
  DATABASE_URL: z.string().startsWith('file:').default('file:./data/tatu.db'),

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
  TOKEN_RENOVAR_CADA_SEG: entero(240),
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
 * Lee `api/.env` (si existe) y valida todo con Zod. Si algo falla, el error lista las
 * variables con su problema, nunca sus valores.
 */
export function config(): Config {
  if (cache) return cache
  const archivo = path.join(RAIZ_API, '.env')
  if (!process.env.TATU_SIN_ENV_ARCHIVO && existsSync(archivo)) process.loadEnvFile(archivo)

  const r = esquema.safeParse(process.env)
  if (!r.success) {
    const lista = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración inválida en api/.env:\n${lista}`)
  }
  if (r.data.OP_PRIVATE_KEY_BASE64 && r.data.OP_PRIVATE_KEY_PATH) {
    throw new Error('Configuración inválida: usa OP_PRIVATE_KEY_BASE64 u OP_PRIVATE_KEY_PATH, no las dos')
  }
  cache = r.data
  return cache
}

/** Solo para pruebas: cambia una variable y vuelve a validar. */
export function reiniciarConfig(cambios: Record<string, string> = {}): Config {
  Object.assign(process.env, cambios)
  cache = undefined
  return config()
}

/** Ruta del archivo SQLite, o ':memory:'. */
export function rutaBaseDeDatos(): string {
  const valor = config().DATABASE_URL.slice('file:'.length)
  if (valor === ':memory:') return valor
  return path.resolve(RAIZ_API, valor)
}

import { z } from 'zod'

// Única lectura de process.env en toda la API (Estructura del proyecto § 2).
// Variables: Historias § Variables y Estructura § 6.
//
// TODO (antes de conectar Open Payments y la base): endurecer los secretos con
// `.min(1)` para que la API no arranque sin ellos. Hoy son opcionales para que
// el esqueleto corra sin .env.

const bandera = z.enum(['true', 'false']).transform((v) => v === 'true')

const esquema = z.object({
  PORT: z.coerce.number().default(3000),

  // Cliente Open Payments — solo backend (RNF-01)
  OP_CLIENT_WALLET_ADDRESS: z.string().default(''),
  OP_KEY_ID: z.string().default(''),
  OP_PRIVATE_KEY_PATH: z.string().default('./private.key'),

  DATABASE_URL: z.string().default(''),
  LIQUIDACION_URL: z.string().default('http://localhost:3000/liquidacion'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  API_BASE_URL: z.string().default('http://localhost:3000'),
  POLL_INTERVALO_MS: z.coerce.number().default(1000),

  EXTRA_BONO: bandera.default(false),
  EXTRA_QR: bandera.default(false),
  EXTRA_PDF417: bandera.default(false),
  EXTRA_CONTRATO: bandera.default(false),
  EXTRA_DEPLOY: bandera.default(false),
})

export const config = esquema.parse(process.env)

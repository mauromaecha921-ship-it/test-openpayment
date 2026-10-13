import { readFileSync } from 'node:fs'
import path from 'node:path'
import { config } from '../../config.js'
import * as liquidacion from '../../liquidacion/datos.js'
import { conexion, transaccion } from '../conexion.js'
import * as beneficiarios from '../repositorios/beneficiarios.js'
import * as cuentas from '../repositorios/cuentas.js'
import * as eventos from '../repositorios/eventos.js'
import * as puntos from '../repositorios/puntos.js'

/**
 * Semilla base (Plan backend § 4.4): las 4 personas ficticias de la demo, el punto con
 * DEMO_WALLET_PUNTO y la cuenta de Ana ya Verificada con DEMO_WALLET_ANA. Luis queda sin cuenta,
 * para probar HU-07 en serio. El programa no se siembra: se crea desde la app (HU-01).
 *
 * Tatú guarda solo la cédula de cada persona (db/001, «somos pasarela»); el nombre, el PIN y el
 * monto van al gobierno simulado (esquema `piloto_gobierno`).
 */
export const IDS = {
  ana: 'c0000000-0000-0000-0000-000000000001',
  luis: 'c0000000-0000-0000-0000-000000000002',
  jorge: 'c0000000-0000-0000-0000-000000000003',
  rosa: 'c0000000-0000-0000-0000-000000000004',
  punto: 'b0000000-0000-0000-0000-000000000001',
  cuentaAna: 'd0000000-0000-0000-0000-000000000001',
} as const

export const NOMBRE_PUNTO = 'Tienda Marta — corresponsal'

/**
 * La liquidación de las 4 personas de la demo: 3 cédulas y $690.000; Rosa recibe el doble y es
 * novedad, así que no cuenta para el tope (RN-08).
 */
const LIQUIDACION_DEMO = [
  { documento: '900000001', nombre: 'Ana', veces: 1, pin: '1111', novedad: false, id: IDS.ana },
  { documento: '900000002', nombre: 'Luis', veces: 1, pin: '2222', novedad: false, id: IDS.luis },
  { documento: '900000003', nombre: 'Jorge', veces: 1, pin: '3333', novedad: false, id: IDS.jorge },
  { documento: '900000004', nombre: 'Rosa', veces: 2, pin: '4444', novedad: true, id: IDS.rosa },
]

/** Lo que el gobierno sabe de las 4 personas de la demo (nombre, PIN y monto). */
export async function sembrarLiquidacionDemo() {
  await liquidacion.sembrarDemo(LIQUIDACION_DEMO)
}

export async function sembrarBase() {
  const { DEMO_WALLET_PUNTO, DEMO_WALLET_ANA } = config()
  const faltan = [!DEMO_WALLET_PUNTO && 'DEMO_WALLET_PUNTO', !DEMO_WALLET_ANA && 'DEMO_WALLET_ANA'].filter(Boolean)
  if (faltan.length) throw new Error(`Faltan en el .env para la semilla base: ${faltan.join(', ')}`)

  await transaccion(async () => {
    for (const p of LIQUIDACION_DEMO) await beneficiarios.crear({ id: p.id, numero_documento: p.documento })
    await puntos.crear({ id: IDS.punto, nombre: NOMBRE_PUNTO, direccion: 'Calle 1 # 2-3', billetera: DEMO_WALLET_PUNTO!, tipo: 'retiro' })
    await cuentas.crear({
      id: IDS.cuentaAna,
      beneficiario_id: IDS.ana,
      billetera: DEMO_WALLET_ANA!,
      estado: 'Verificada',
      verificada_en: new Date().toISOString(),
    })
    await eventos.registrar({ tipo: 'cuenta', id: IDS.cuentaAna, hacia: 'Verificada', detalle: { texto: 'Cuenta de prueba sembrada ya verificada.' } })
    await sembrarLiquidacionDemo()
  })
  return { beneficiarios: LIQUIDACION_DEMO.length, punto: NOMBRE_PUNTO }
}

/** La semilla «solo UI»: el escenario de db/002_datos_prueba.sql con token falso. Nunca paga. */
export async function sembrarSoloUi() {
  await conexion().script(readFileSync(path.join(import.meta.dirname, 'solo-ui.sql'), 'utf8'))
  await sembrarLiquidacionDemo()
}

import type { DatabaseSync } from 'node:sqlite'
import { config } from '../../config.js'
import { hashPin } from '../../liquidacion/datos.js'

/**
 * Semilla base (Plan backend § 4.4): los 3 municipios y las 4 personas ficticias de
 * db/002_datos_prueba.sql, el punto con DEMO_WALLET_PUNTO y la cuenta de Ana ya Verificada
 * con DEMO_WALLET_ANA. Luis queda sin cuenta, para probar HU-07 en serio. El programa no se
 * siembra: se crea desde la app, que es lo que valida HU-01.
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
 * La liquidación de las 4 personas de la demo (antes fija en liquidacion/datos.ts): 3 cédulas y
 * $690.000; Rosa recibe el doble y es novedad, así que no cuenta para el tope (RN-08).
 */
const LIQUIDACION_DEMO = [
  { documento: '900000001', veces: 1, pin: '1111', novedad: 0 }, // Ana
  { documento: '900000002', veces: 1, pin: '2222', novedad: 0 }, // Luis
  { documento: '900000003', veces: 1, pin: '3333', novedad: 0 }, // Jorge
  { documento: '900000004', veces: 2, pin: '4444', novedad: 1 }, // Rosa
]

export function sembrarLiquidacionDemo(bd: DatabaseSync) {
  const insertar = bd.prepare('INSERT INTO liquidacion_persona (documento, veces, pin_hash, novedad) VALUES (?, ?, ?, ?)')
  for (const f of LIQUIDACION_DEMO) insertar.run(f.documento, f.veces, hashPin(f.pin), f.novedad)
}

export function sembrarBase(bd: DatabaseSync) {
  const { DEMO_WALLET_PUNTO, DEMO_WALLET_ANA } = config()
  const faltan = [!DEMO_WALLET_PUNTO && 'DEMO_WALLET_PUNTO', !DEMO_WALLET_ANA && 'DEMO_WALLET_ANA'].filter(Boolean)
  if (faltan.length) throw new Error(`Faltan en api/.env para la semilla base: ${faltan.join(', ')}`)

  bd.exec('BEGIN IMMEDIATE')
  try {
    bd.exec(`
      INSERT INTO municipio (codigo_dane, nombre, departamento) VALUES
        ('11001', 'Bogotá, D.C.', 'Bogotá, D.C.'),
        ('05001', 'Medellín',     'Antioquia'),
        ('76001', 'Cali',         'Valle del Cauca');

      INSERT INTO beneficiario (id, tipo_documento, numero_documento, fecha_expedicion,
                                primer_nombre, primer_apellido, segundo_apellido,
                                fecha_nacimiento, sexo, celular, municipio_id, estrato,
                                categoria_afiliacion, autoriza_datos, fecha_autorizacion, version_politica)
      VALUES
        ('${IDS.ana}', 'CC', '900000001', '1977-07-01',
         'Ana', 'Prueba', 'Uno', '1959-06-02', 'F', '3000000001', '11001', 2,
         'A', 1, '2026-10-01T00:00:00.000Z', 'v1'),
        ('${IDS.luis}', 'CC', '900000002', '1990-01-15',
         'Luis', 'Prueba', 'Dos', '1972-01-10', 'M', '3000000002', '05001', 1,
         'A', 1, '2026-10-01T00:00:00.000Z', 'v1'),
        ('${IDS.jorge}', 'CC', '900000003', '1972-03-20',
         'Jorge', 'Prueba', 'Tres', '1954-03-01', 'M', NULL, '11001', 1,
         'A', 1, '2026-10-01T00:00:00.000Z', 'v1'),
        ('${IDS.rosa}', 'CC', '900000004', '1985-09-09',
         'Rosa', 'Prueba', 'Cuatro', '1967-09-01', 'F', '3000000004', '76001', 2,
         'A', 1, '2026-10-01T00:00:00.000Z', 'v1');
    `)
    bd.prepare(`INSERT INTO punto (id, nombre, direccion, billetera, tipo)
                VALUES (?, ?, 'Calle 1 # 2-3', ?, 'retiro')`).run(IDS.punto, NOMBRE_PUNTO, DEMO_WALLET_PUNTO!)
    bd.prepare(`INSERT INTO cuenta_beneficiario (id, beneficiario_id, billetera, estado, verificada_en)
                VALUES (?, ?, ?, 'Verificada', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .run(IDS.cuentaAna, IDS.ana, DEMO_WALLET_ANA!)
    bd.prepare(`INSERT INTO evento (tipo_entidad, id_entidad, estado_anterior, estado_nuevo, detalle)
                VALUES ('cuenta', ?, NULL, 'Verificada', '{"texto":"Cuenta de prueba sembrada ya verificada."}')`)
      .run(IDS.cuentaAna)
    sembrarLiquidacionDemo(bd)
    bd.exec('COMMIT')
  } catch (e) {
    bd.exec('ROLLBACK')
    throw e
  }
  return { beneficiarios: 4, punto: NOMBRE_PUNTO }
}

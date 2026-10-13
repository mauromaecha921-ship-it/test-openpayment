import { beforeEach, describe, expect, it } from 'vitest'
import { IDS, prepararBd } from '../../test/ayuda.js'
import { conexion } from './conexion.js'

/**
 * V-16: las protecciones de db/README.md («Qué protege la base») funcionan en PostgreSQL con las
 * migraciones de verdad (db/001 y db/003 de main, más 010_piloto.sql). Cada caso intenta una
 * violación directa con SQL y la base la tiene que rechazar.
 */
const PROGRAMA = 'a0000000-0000-0000-0000-00000000000a'
const PUNTO = IDS.punto

const sql = <T = Record<string, unknown>>(texto: string, parametros: unknown[] = []) => conexion().filas<T>(texto, parametros)

async function insertarPrograma(estado = 'Activo', id = PROGRAMA, tipo = 'subsidio') {
  await sql(
    `INSERT INTO programa (id, entidad, nombre, tipo, destino, billetera_programa, codigo_moneda, escala_moneda,
       vigencia_inicio, vigencia_fin, tope_total, estado, token_acceso, url_gestion)
     VALUES ($1, 'Entidad de prueba', 'Programa de prueba', $3, $4, 'https://ilp.prueba.dev/programa',
       'COP', 2, '2026-01-01T00:00:00Z', '2099-12-31T00:00:00Z', 69000000, $2, 'token', 'https://auth.prueba.dev/t')`,
    [id, estado, tipo, tipo === 'subsidio' ? 'libre' : 'restringido'],
  )
}

let n = 0
async function cobro(campos: Record<string, string | number | null> = {}) {
  const fila: Record<string, string | number | null> = {
    id: `e0000000-0000-0000-0000-${String(++n).padStart(12, '0')}`,
    programa_id: PROGRAMA,
    punto_id: PUNTO,
    cuenta_id: null,
    beneficiario_id: IDS.jorge,
    canal: 'retiro',
    monto: 23000000,
    estado: 'PorConfirmar',
    motivo_rechazo: null,
    llave_idempotencia: `llave-${n}`,
    ...campos,
  }
  const columnas = Object.keys(fila)
  await sql(`INSERT INTO cobro (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(fila))
  return fila.id as string
}

const mover = (id: string, estado: string, extra = '') => sql(`UPDATE cobro SET estado = $1${extra} WHERE id = $2`, [estado, id])

beforeEach(async () => {
  await prepararBd()
  await insertarPrograma()
})

describe('protecciones de la base (V-16, db/001)', () => {
  it('1 · nadie cobra dos veces: índice único parcial (RN-02)', async () => {
    await cobro()
    await expect(cobro()).rejects.toThrow(/un_cobro_vivo_por_persona/)
  })

  it('2 · Fallido libera a la persona; Rechazado no ocupa el lugar', async () => {
    const a = await cobro()
    await mover(a, 'Pagando')
    await mover(a, 'Fallido', ", motivo_rechazo = 'TopeSuperado'")
    await cobro({ estado: 'Rechazado', motivo_rechazo: 'YaCobrado', monto: null })
    await expect(cobro()).resolves.toBeTruthy()
  })

  it('3 · doble clic: llave_idempotencia única', async () => {
    await cobro({ llave_idempotencia: 'misma' })
    await expect(cobro({ llave_idempotencia: 'misma', beneficiario_id: IDS.rosa })).rejects.toThrow(/cobro_llave_idempotencia_key/)
  })

  it('4 · bloqueo optimista: el trigger sube version en cada cambio', async () => {
    const a = await cobro()
    await sql(`UPDATE cobro SET intentos_pin = 1 WHERE id = $1`, [a])
    await sql(`UPDATE cobro SET estado = 'Pagando' WHERE id = $1`, [a])
    const [f] = await sql<{ version: number }>(`SELECT version FROM cobro WHERE id = $1`, [a])
    expect(f!.version).toBe(2)
    // Quien leyó la versión 0 ya no puede escribir: así gana una sola petición (HU-14)
    const viejo = await sql(`UPDATE cobro SET estado = 'Rechazado', motivo_rechazo = 'Cancelado' WHERE id = $1 AND version = 0 RETURNING id`, [a])
    expect(viejo).toHaveLength(0)
  })

  it('5 · estados: rechaza saltos como PorConfirmar → Pagado o Fallido → Pagado', async () => {
    const a = await cobro()
    await expect(mover(a, 'Pagado', ", url_pago_saliente = 'https://x'")).rejects.toThrow(/Transición de cobro no permitida/)
    await mover(a, 'Pagando')
    await mover(a, 'Fallido', ", motivo_rechazo = 'ErrorPago'")
    await expect(mover(a, 'Pagado', ", url_pago_saliente = 'https://x'")).rejects.toThrow(/Transición de cobro no permitida/)
  })

  it('6 · un cobro no puede nacer en Pagando, Pagado ni Fallido', async () => {
    await expect(cobro({ estado: 'Pagando' })).rejects.toThrow(/no puede nacer/)
    await expect(cobro({ estado: 'Pagado' })).rejects.toThrow(/no puede nacer/)
  })

  it('7 · montos: enteros positivos; el bono no supera la compra', async () => {
    await expect(cobro({ monto: 0 })).rejects.toThrow(/cobro_monto_check/)
    await expect(cobro({ monto: -5 })).rejects.toThrow(/cobro_monto_check/)
    await expect(cobro({ monto: 230000.5 })).rejects.toThrow() // bigint: nada de decimales
    await expect(cobro({ estado: 'Rechazado', motivo_rechazo: 'X', canal: 'compra', total_compra: 100, monto: 200 })).rejects.toThrow(/bono_no_supera_compra/)
  })

  it('8 · canal coherente: retiro exige punto; cuenta exige cuenta y no punto', async () => {
    await expect(cobro({ punto_id: null })).rejects.toThrow(/canal_y_punto/)
    await expect(cobro({ canal: 'cuenta', beneficiario_id: IDS.ana })).rejects.toThrow() // con punto
    await expect(cobro({ canal: 'cuenta', punto_id: null, beneficiario_id: IDS.ana })).rejects.toThrow() // sin cuenta
    await expect(cobro({ canal: 'cuenta', punto_id: null, cuenta_id: IDS.cuentaAna, beneficiario_id: IDS.ana })).resolves.toBeTruthy()
  })

  it('9 · se paga a la cuenta correcta: FK compuesta (cuenta del mismo beneficiario)', async () => {
    await expect(cobro({ canal: 'cuenta', punto_id: null, cuenta_id: IDS.cuentaAna, beneficiario_id: IDS.luis })).rejects.toThrow(
      /cuenta_del_beneficiario|RN-04/,
    )
  })

  it('10 · historial intocable: cobro no admite DELETE ni TRUNCATE', async () => {
    const a = await cobro()
    await expect(sql('DELETE FROM cobro WHERE id = $1', [a])).rejects.toThrow(/no admite DELETE/)
    await expect(sql('TRUNCATE cobro CASCADE')).rejects.toThrow(/no admite DELETE/)
  })

  it('11 · evento es de solo inserción (UPDATE y DELETE) y su detalle es JSON', async () => {
    await sql(`INSERT INTO evento (tipo_entidad, id_entidad) VALUES ('cobro', 'x')`)
    await expect(sql(`UPDATE evento SET detalle = '{}'`)).rejects.toThrow(/solo inserción/)
    await expect(sql('DELETE FROM evento')).rejects.toThrow(/solo inserción/)
    await expect(sql(`INSERT INTO evento (tipo_entidad, id_entidad, detalle) VALUES ('cobro', 'x', 'no-json')`)).rejects.toThrow()
  })

  it('12 · moneda fija: la billetera y la moneda no cambian fuera de Borrador', async () => {
    await expect(sql(`UPDATE programa SET codigo_moneda = 'USD' WHERE id = $1`, [PROGRAMA])).rejects.toThrow(/fuera de Borrador/)
    await expect(sql(`UPDATE programa SET billetera_programa = 'https://otra' WHERE id = $1`, [PROGRAMA])).rejects.toThrow(/fuera de Borrador/)
  })

  it('13 · Pagado exige url_pago_saliente; Rechazado y Fallido exigen motivo', async () => {
    const a = await cobro()
    await mover(a, 'Pagando')
    await expect(mover(a, 'Pagado')).rejects.toThrow(/pagado_con_pago_saliente/)
    await expect(mover(a, 'Fallido')).rejects.toThrow(/motivo_si_termina_mal/)
    await expect(cobro({ estado: 'Rechazado', beneficiario_id: IDS.rosa })).rejects.toThrow(/motivo_si_termina_mal/)
  })

  it('14 · un programa Activo necesita su permiso; sin tope no sale de Borrador', async () => {
    await expect(sql(`UPDATE programa SET token_acceso = NULL WHERE id = $1`, [PROGRAMA])).rejects.toThrow(/activo_con_permiso/)
    await expect(
      sql(
        `INSERT INTO programa (entidad, nombre, tipo, destino, billetera_programa, codigo_moneda, escala_moneda,
           vigencia_inicio, vigencia_fin, estado, aprobacion_solicitada_en)
         VALUES ('Entidad', 'Programa', 'subsidio', 'libre', 'https://x', 'COP', 2,
           '2026-10-01T00:00:00Z', '2026-12-31T00:00:00Z', 'EsperandoAprobacion', now())`,
      ),
    ).rejects.toThrow(/tope_antes_de_aprobar/)
  })

  it('15 · una sola cuenta vigente por persona', async () => {
    await expect(
      sql(`INSERT INTO cuenta_beneficiario (beneficiario_id, billetera, estado) VALUES ($1, 'https://otra', 'PorVerificar')`, [IDS.ana]),
    ).rejects.toThrow(/una_cuenta_vigente/)
  })

  it('16 · ON DELETE RESTRICT y llaves foráneas', async () => {
    await cobro()
    await expect(sql('DELETE FROM beneficiario WHERE id = $1', [IDS.jorge])).rejects.toThrow(/foreign key/)
    await expect(cobro({ beneficiario_id: 'f0000000-0000-0000-0000-000000000000', llave_idempotencia: 'otra' })).rejects.toThrow(/foreign key/)
  })

  it('17 · Verificada exige fecha', async () => {
    await expect(sql(`UPDATE cuenta_beneficiario SET verificada_en = NULL WHERE id = $1`, [IDS.cuentaAna])).rejects.toThrow(/verificada_con_fecha/)
  })
})

describe('reglas del cobro en la base (db/003) y lo que agrega el piloto (010)', () => {
  it('RN-06 · un programa Pausado no acepta cobros vivos; el Rechazado sí queda registrado', async () => {
    await sql(`UPDATE programa SET estado = 'Pausado' WHERE id = $1`, [PROGRAMA])
    await expect(cobro()).rejects.toThrow(/RN-06/)
    await expect(cobro({ estado: 'Rechazado', motivo_rechazo: 'ProgramaNoRecibe', monto: null })).resolves.toBeTruthy()
  })

  it('RN-07 · con el PIN bloqueado en el programa no se puede cobrar (bloqueo_pin)', async () => {
    const rechazado = await cobro({ estado: 'Rechazado', motivo_rechazo: 'PinBloqueado' })
    await sql(`INSERT INTO bloqueo_pin (programa_id, beneficiario_id, bloqueado_hasta, cobro_id) VALUES ($1, $2, now() + interval '15 minutes', $3)`, [
      PROGRAMA,
      IDS.jorge,
      rechazado,
    ])
    await expect(cobro()).rejects.toThrow(/RN-07/)
  })

  it('RN-04 · el canal cuenta exige una cuenta Verificada', async () => {
    await sql(`UPDATE cuenta_beneficiario SET estado = 'SinEnlazar', verificada_en = NULL WHERE id = $1`, [IDS.cuentaAna])
    await expect(cobro({ canal: 'cuenta', punto_id: null, cuenta_id: IDS.cuentaAna, beneficiario_id: IDS.ana })).rejects.toThrow(/RN-04/)
  })

  it('D-39 · un bono se acepta en la sede de un comercio verificado de su categoría', async () => {
    const BONO = 'a0000000-0000-0000-0000-00000000000b'
    const SEDE = 'b0000000-0000-0000-0000-00000000000c'
    await insertarPrograma('Activo', BONO, 'bono')
    await sql(`INSERT INTO programa_categoria (programa_id, categoria) VALUES ($1, 'alimentos')`, [BONO])
    const [c] = await sql<{ id: string }>(
      `INSERT INTO comercio (nit, razon_social, ciiu, categoria) VALUES ('900123456', 'Tienda de prueba', '4711', 'alimentos') RETURNING id`,
    )
    await sql(`INSERT INTO punto (id, nombre, direccion, billetera, tipo, comercio_id) VALUES ($1, 'Sede 1', 'Calle 1', 'https://ilp.prueba.dev/sede', 'compra', $2)`, [
      SEDE,
      c!.id,
    ])
    const compra = { programa_id: BONO, punto_id: SEDE, canal: 'compra', total_compra: 8000000, monto: 6000000 }
    // Sin verificar, el comercio no acepta el bono
    await expect(cobro(compra)).rejects.toThrow(/RN-03: este comercio no acepta este bono/)
    await sql(`UPDATE comercio SET verificado_en = now() WHERE id = $1`, [c!.id])
    await expect(cobro(compra)).resolves.toBeTruthy()
    // Un punto de retiro no hace compras
    await expect(cobro({ ...compra, punto_id: PUNTO, beneficiario_id: IDS.rosa })).rejects.toThrow(/RN-03/)
  })

  it('base compartida: los triggers leen las tablas del esquema piloto, no las de public (la base de Pablo)', async () => {
    // Un «programa» en public con el mismo id, Cerrado: si el trigger lo leyera, rechazaría el cobro
    await sql(`CREATE TABLE public.programa (id uuid PRIMARY KEY, estado text, vigencia_inicio timestamptz, vigencia_fin timestamptz)`)
    await sql(`INSERT INTO public.programa VALUES ($1, 'Cerrado', now(), now())`, [PROGRAMA])
    try {
      await sql('SET search_path TO public, piloto, piloto_gobierno')
      await expect(
        sql(
          `INSERT INTO piloto.cobro (programa_id, punto_id, beneficiario_id, canal, monto, estado, llave_idempotencia)
           VALUES ($1, $2, $3, 'retiro', 23000000, 'PorConfirmar', 'llave-compartida')`,
          [PROGRAMA, PUNTO, IDS.jorge],
        ),
      ).resolves.toBeTruthy()
    } finally {
      await sql('SET search_path TO piloto, piloto_gobierno')
      await sql('DROP TABLE public.programa')
    }
  })

  it('somos pasarela: Tatú guarda solo la cédula; el nombre y el PIN están en el esquema del gobierno', async () => {
    const columnas = await sql<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'piloto' AND table_name = 'beneficiario' ORDER BY ordinal_position`,
    )
    expect(columnas.map((c) => c.column_name)).toEqual(['id', 'tipo_documento', 'numero_documento', 'creado_en'])
    const [ana] = await sql<{ nombre: string }>(`SELECT nombre FROM piloto_gobierno.persona WHERE documento = '900000001'`)
    expect(ana!.nombre).toBe('Ana')
  })
})

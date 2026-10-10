import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDS, prepararBd } from '../../test/ayuda.js'

/**
 * V-16: las protecciones de db/README.md («Qué protege la base») también funcionan en SQLite.
 * Cada caso intenta una violación directa con SQL y la base la tiene que rechazar.
 */
let bd: DatabaseSync

const PROGRAMA = 'a0000000-0000-0000-0000-00000000000a'
const PUNTO = IDS.punto

function insertarPrograma(estado = 'Activo') {
  bd.prepare(
    `INSERT INTO programa (id, entidad, nombre, tipo, destino, billetera_programa, codigo_moneda, escala_moneda,
       vigencia_inicio, vigencia_fin, tope_total, estado, token_acceso, url_gestion)
     VALUES (?, 'Entidad de prueba', 'Subsidio de prueba', 'subsidio', 'libre', 'https://ilp.prueba.dev/programa',
       'COP', 2, '2026-10-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 69000000, ?, 'token', 'https://auth.prueba.dev/t')`,
  ).run(PROGRAMA, estado)
}

let n = 0
function cobro(campos: Record<string, string | number | null> = {}) {
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
    referencia: `SUB-${String(n).padStart(4, '0')}`,
    llave_idempotencia: `llave-${n}`,
    ...campos,
  }
  const columnas = Object.keys(fila)
  bd.prepare(`INSERT INTO cobro (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`).run(
    ...Object.values(fila),
  )
  return fila.id as string
}

const mover = (id: string, estado: string, extra = '') =>
  bd.prepare(`UPDATE cobro SET estado = ?, version = version + 1${extra} WHERE id = ?`).run(estado, id)

beforeEach(() => {
  bd = prepararBd()
  insertarPrograma()
})

describe('protecciones de la base (V-16)', () => {
  it('1 · nadie cobra dos veces: índice único parcial (RN-02)', () => {
    cobro()
    expect(() => cobro()).toThrow(/UNIQUE/)
  })

  it('2 · Fallido libera a la persona; Rechazado no ocupa el lugar', () => {
    const a = cobro()
    mover(a, 'Pagando')
    mover(a, 'Fallido', ", motivo_rechazo = 'TopeSuperado'")
    cobro({ estado: 'Rechazado', motivo_rechazo: 'YaCobrado', monto: null })
    expect(() => cobro()).not.toThrow()
  })

  it('3 · doble clic: llave_idempotencia única', () => {
    cobro({ llave_idempotencia: 'misma' })
    expect(() => cobro({ llave_idempotencia: 'misma', beneficiario_id: IDS.rosa })).toThrow(/UNIQUE/)
  })

  it('4 · bloqueo optimista: un cambio que no sube version se rechaza', () => {
    const a = cobro()
    expect(() => bd.prepare(`UPDATE cobro SET estado = 'Pagando' WHERE id = ?`).run(a)).toThrow(/version/)
    expect(() => bd.prepare(`UPDATE cobro SET version = version + 2 WHERE id = ?`).run(a)).toThrow(/version/)
  })

  it('5 · estados: rechaza saltos como Fallido → Pagado o PorConfirmar → Pagado', () => {
    const a = cobro()
    expect(() => mover(a, 'Pagado')).toThrow(/Transición/)
    mover(a, 'Pagando')
    mover(a, 'Fallido', ", motivo_rechazo = 'ErrorPago'")
    expect(() => mover(a, 'Pagado', ", url_pago_saliente = 'https://x'")).toThrow(/Transición/)
  })

  it('6 · un cobro no puede nacer en Pagando, Pagado ni Fallido', () => {
    expect(() => cobro({ estado: 'Pagando' })).toThrow(/nacer/)
    expect(() => cobro({ estado: 'Pagado' })).toThrow(/nacer/)
  })

  it('7 · montos: enteros positivos; el bono no supera la compra', () => {
    expect(() => cobro({ monto: 0 })).toThrow(/CHECK/)
    expect(() => cobro({ monto: -5 })).toThrow(/CHECK/)
    expect(() => cobro({ monto: 230000.5 })).toThrow() // STRICT: nada de float
    expect(() => cobro({ canal: 'compra', total_compra: 100, monto: 200 })).toThrow(/CHECK/)
  })

  it('8 · canal coherente: retiro exige punto; cuenta exige cuenta y no punto', () => {
    expect(() => cobro({ punto_id: null })).toThrow(/CHECK/)
    expect(() => cobro({ canal: 'cuenta', beneficiario_id: IDS.ana })).toThrow(/CHECK/) // con punto
    expect(() => cobro({ canal: 'cuenta', punto_id: null, beneficiario_id: IDS.ana })).toThrow(/CHECK/) // sin cuenta
    expect(() => cobro({ canal: 'cuenta', punto_id: null, cuenta_id: IDS.cuentaAna, beneficiario_id: IDS.ana })).not.toThrow()
  })

  it('9 · se paga a la cuenta correcta: FK compuesta (cuenta del mismo beneficiario)', () => {
    expect(() => cobro({ canal: 'cuenta', punto_id: null, cuenta_id: IDS.cuentaAna, beneficiario_id: IDS.luis })).toThrow(
      /FOREIGN KEY/,
    )
  })

  it('10 · historial intocable: cobro no admite DELETE', () => {
    const a = cobro()
    expect(() => bd.prepare('DELETE FROM cobro WHERE id = ?').run(a)).toThrow(/DELETE/)
  })

  it('11 · evento es de solo inserción (UPDATE y DELETE)', () => {
    bd.prepare(`INSERT INTO evento (tipo_entidad, id_entidad) VALUES ('cobro', 'x')`).run()
    expect(() => bd.prepare(`UPDATE evento SET detalle = '{}'`).run()).toThrow(/solo inserción/)
    expect(() => bd.prepare('DELETE FROM evento').run()).toThrow(/solo inserción/)
    expect(() => bd.prepare(`INSERT INTO evento (tipo_entidad, id_entidad, detalle) VALUES ('cobro', 'x', 'no-json')`).run()).toThrow(
      /CHECK/,
    )
  })

  it('12 · moneda fija: la billetera y la moneda no cambian fuera de Borrador', () => {
    expect(() => bd.prepare(`UPDATE programa SET codigo_moneda = 'USD' WHERE id = ?`).run(PROGRAMA)).toThrow(/Borrador/)
    expect(() => bd.prepare(`UPDATE programa SET billetera_programa = 'https://otra' WHERE id = ?`).run(PROGRAMA)).toThrow(
      /Borrador/,
    )
  })

  it('13 · Pagado exige url_pago_saliente; Rechazado y Fallido exigen motivo', () => {
    const a = cobro()
    mover(a, 'Pagando')
    expect(() => mover(a, 'Pagado')).toThrow(/CHECK/)
    expect(() => mover(a, 'Fallido')).toThrow(/CHECK/)
    expect(() => cobro({ estado: 'Rechazado', beneficiario_id: IDS.rosa })).toThrow(/CHECK/)
  })

  it('14 · un programa Activo necesita su permiso; sin tope no sale de Borrador', () => {
    expect(() => bd.prepare(`UPDATE programa SET token_acceso = NULL WHERE id = ?`).run(PROGRAMA)).toThrow(/CHECK/)
    expect(() =>
      bd
        .prepare(
          `INSERT INTO programa (id, entidad, nombre, tipo, destino, billetera_programa, codigo_moneda, escala_moneda,
             vigencia_inicio, vigencia_fin, estado)
           VALUES ('p2', 'Entidad', 'Programa', 'subsidio', 'libre', 'https://x', 'COP', 2,
             '2026-10-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 'EsperandoAprobacion')`,
        )
        .run(),
    ).toThrow(/CHECK/)
  })

  it('15 · una sola cuenta vigente por persona', () => {
    expect(() =>
      bd
        .prepare(
          `INSERT INTO cuenta_beneficiario (id, beneficiario_id, billetera, estado) VALUES ('c2', ?, 'https://otra', 'PorVerificar')`,
        )
        .run(IDS.ana),
    ).toThrow(/UNIQUE/)
  })

  it('16 · ON DELETE RESTRICT y FK revisadas (PRAGMA foreign_keys)', () => {
    cobro()
    expect(() => bd.prepare('DELETE FROM beneficiario WHERE id = ?').run(IDS.jorge)).toThrow(/FOREIGN KEY/)
    expect(() => cobro({ beneficiario_id: 'no-existe', llave_idempotencia: 'otra' })).toThrow(/FOREIGN KEY/)
  })

  it('17 · Verificada exige fecha, y la vista calcula la edad', () => {
    expect(() => bd.prepare(`UPDATE cuenta_beneficiario SET verificada_en = NULL WHERE id = ?`).run(IDS.cuentaAna)).toThrow(/CHECK/)
    const fila = bd.prepare(`SELECT edad FROM beneficiario_con_edad WHERE id = ?`).get(IDS.ana) as { edad: number }
    expect(fila.edad).toBeGreaterThanOrEqual(67)
  })
})

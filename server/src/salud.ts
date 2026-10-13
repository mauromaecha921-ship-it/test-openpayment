import { Router } from 'express'
import { baseDeDatos, config } from './config.js'
import { conexion } from './db/conexion.js'
import * as programas from './db/repositorios/programas.js'
import { diagnosticoLlave } from './openPaymentsService.js'

/** El token de la semilla «solo UI» (src/db/semillas/solo-ui.sql): nunca paga. */
export const TOKEN_FALSO = 'token-falso-solo-demo'

/**
 * GET /salud y GET /estado: BD, cliente de Open Payments y si la llave coincide con el jwks.json.
 * La BD se describe por su servidor y su nombre, nunca con la URL completa (lleva la contraseña).
 */
export function rutasSalud(): Router {
  const r = Router()

  r.get('/salud', async (_req, res) => {
    let bd: { ok: boolean; donde?: string; migraciones?: number; detalle?: string }
    try {
      const [f] = await conexion().filas<{ n: number }>('SELECT count(*)::int AS n FROM piloto.migracion')
      bd = { ok: true, donde: conexion().descripcion, migraciones: f?.n ?? 0 }
    } catch (e) {
      bd = { ok: false, detalle: (e as Error).message }
    }
    const llave = await diagnosticoLlave()
    const ok = bd.ok && llave.coincide === true
    res.status(ok ? 200 : 503).json({
      ok,
      bd,
      openPayments: llave,
      verificacionCuenta: config().VERIFICACION_CUENTA,
      liquidacionSimulaFalla: config().LIQUIDACION_SIMULAR_FALLA,
    })
  })

  // Para la web (Plan de ajustes § 3, F3): siempre 200, con «pagos reales o simulados» y qué falta.
  // No incluye la wallet cliente ni el OP_KEY_ID: el equipo los mantiene fuera de lo que se comparte.
  r.get('/estado', async (_req, res) => {
    const [llave, conTokenFalso] = await Promise.all([diagnosticoLlave(), programas.cuantosConToken(TOKEN_FALSO)])
    const faltan: string[] = []
    if (llave.coincide !== true) faltan.push(llave.detalle)
    if (conTokenFalso) {
      faltan.push(
        `${conTokenFalso === 1 ? 'Hay 1 programa' : `Hay ${conTokenFalso} programas`} de la semilla «solo UI», con token falso: ` +
          'reinicia la BD con «pnpm --filter api db:reset»',
      )
    }
    const base = baseDeDatos()
    res.json({
      pagosReales: faltan.length === 0,
      faltan,
      openPayments: llave,
      programasConTokenFalso: conTokenFalso,
      verificacionCuenta: config().VERIFICACION_CUENTA,
      // Dónde quedan los datos: Supabase o la base local (PGlite)
      baseDeDatos: { tipo: base.tipo, donde: base.descripcion },
    })
  })

  return r
}

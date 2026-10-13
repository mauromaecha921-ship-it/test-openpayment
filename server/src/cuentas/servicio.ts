/**
 * Cuentas del beneficiario: O3 y HU-07 (Plan backend § 8.7). Permiso con subject para probar
 * que la wallet es de la persona, o el plan B (VERIFICACION_CUENTA=simulada).
 */
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { ErrorApi, noEncontrado } from '../comun/errores.js'
import { log } from '../comun/log.js'
import { vistaCuenta } from '../comun/vistas.js'
import { ahoraIso, transaccion } from '../db/conexion.js'
import * as beneficiarios from '../db/repositorios/beneficiarios.js'
import * as repo from '../db/repositorios/cuentas.js'
import type { FilaCuenta } from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import { actorBeneficiario } from '../db/repositorios/eventos.js'
import * as liquidacion from '../liquidacion/cliente.js'
import * as op from '../openPaymentsService.js'
import { verificarHash } from '../programas/hash.js'
import { errorOpApi, resolverWallet } from '../programas/servicio.js'

const TEMPORALES_EN_NULL = {
  nonce_cliente: null,
  nonce_cierre: null,
  uri_continuacion: null,
  token_continuacion: null,
} as const

async function persona(documento: string) {
  const b = await beneficiarios.porDocumento(documento)
  if (!b) throw noEncontrado('Esa cédula no está registrada')
  return b
}

/** PorVerificar → SinEnlazar, con su evento. */
async function desenlazar(c: FilaCuenta, texto: string) {
  await transaccion(async () => {
    if (await repo.actualizar(c.id, { estado: 'SinEnlazar', verificada_en: null, ...TEMPORALES_EN_NULL }, c.estado)) {
      await eventos.registrar({ tipo: 'cuenta', id: c.id, desde: c.estado, hacia: 'SinEnlazar', detalle: { texto } })
    }
  })
}

/** HU-07: pasados APROBACION_TTL_MIN sin respuesta, la cuenta vuelve a SinEnlazar. */
async function aplicarVencimiento(c: FilaCuenta | undefined): Promise<FilaCuenta | undefined> {
  if (!c || c.estado !== 'PorVerificar') return c
  const desde = (await eventos.ultimoHacia('cuenta', c.id, 'PorVerificar'))?.creado_en ?? c.creado_en
  if (Date.now() - Date.parse(desde) > config().APROBACION_TTL_MIN * 60_000) {
    await desenlazar(c, 'La verificación venció sin respuesta.')
    return repo.obtener(c.id)
  }
  return c
}

export interface EntradaCuenta {
  documento: string
  billetera: string
  pin?: string
}

export async function enlazar(e: EntradaCuenta) {
  const b = await persona(e.documento)
  // Sin PIN registrado no hay qué validar; si lo tiene, es obligatorio y debe coincidir
  if ((await liquidacion.persona(e.documento))?.tienePin && !(e.pin && (await liquidacion.validarPin(e.documento, e.pin)))) {
    throw new ErrorApi(422, 'PinIncorrecto', 'PIN incorrecto')
  }
  const wallet = await resolverWallet(e.billetera)
  const billetera = wallet.id.replace(/\/+$/, '')
  const id = randomUUID()
  const simulada = config().VERIFICACION_CUENTA === 'simulada'

  let pendiente: op.PermisoPendiente | undefined
  const nonce = randomUUID()
  if (!simulada) {
    try {
      pendiente = await op.pedirVerificacionCuenta({
        billetera,
        nonce,
        urlRetorno: `${config().API_BASE_URL}/cuentas/callback/${id}`,
      })
    } catch (err) {
      throw errorOpApi(err, 'No pudimos pedir la verificación a tu banco')
    }
  }

  const actor = actorBeneficiario(b.id)
  await transaccion(async () => {
    // Una sola cuenta vigente por persona (índice una_cuenta_vigente)
    const vigente = await repo.vigenteDe(b.id)
    if (vigente) {
      await repo.actualizar(vigente.id, { estado: 'SinEnlazar', verificada_en: null, ...TEMPORALES_EN_NULL })
      await eventos.registrar({
        tipo: 'cuenta',
        id: vigente.id,
        desde: vigente.estado,
        hacia: 'SinEnlazar',
        detalle: { texto: 'Se reemplazó por una cuenta nueva.' },
        actor,
      })
    }
    if (simulada) {
      await repo.crear({ id, beneficiario_id: b.id, billetera, estado: 'Verificada', verificada_en: ahoraIso(), ...TEMPORALES_EN_NULL })
      await eventos.registrar({
        tipo: 'cuenta',
        id,
        hacia: 'Verificada',
        detalle: { texto: 'Verificación simulada (plan B de HU-07): en producción la confirma el banco.', simulada: true },
        actor,
      })
    } else {
      await repo.crear({
        id,
        beneficiario_id: b.id,
        billetera,
        estado: 'PorVerificar',
        nonce_cliente: nonce,
        nonce_cierre: pendiente!.nonceCierre,
        uri_continuacion: pendiente!.uriContinuacion,
        token_continuacion: pendiente!.tokenContinuacion,
      })
      await eventos.registrar({ tipo: 'cuenta', id, hacia: 'PorVerificar', detalle: { texto: 'Esperando que apruebes en tu banco.' }, actor })
    }
  })

  return { redirect: pendiente?.redirect ?? null, cuenta: vistaCuenta(await repo.obtener(id), b.numero_documento) }
}

export type ResultadoCuenta = 'verificada' | 'rechazada' | 'invalido'

function urlRegreso(resultado: ResultadoCuenta) {
  return `${config().APP_BASE_URL}/beneficiario/cuenta?resultado=${resultado}`
}

/** GET /cuentas/callback/:id → a dónde redirigir. */
export async function callback(id: string, q: { hash?: string; interact_ref?: string; result?: string }): Promise<string> {
  const c = await aplicarVencimiento(await repo.obtener(id))
  if (!c) return urlRegreso('invalido')
  if (c.estado === 'Verificada') return urlRegreso('verificada')
  if (c.estado !== 'PorVerificar') return urlRegreso('rechazada')

  if (q.result === 'grant_rejected' || q.result === 'grant_invalid') {
    await desenlazar(c, 'La verificación fue rechazada en el banco.')
    return urlRegreso('rechazada')
  }

  let urlPermiso: string
  try {
    // grant_url = el authServer de la wallet del beneficiario
    urlPermiso = (await op.leerWallet(c.billetera)).authServer
  } catch {
    return urlRegreso('invalido')
  }
  const coincide =
    q.hash && q.interact_ref && c.nonce_cliente && c.nonce_cierre
      ? verificarHash(q.hash, { nonceCliente: c.nonce_cliente, nonceCierre: c.nonce_cierre, interactRef: q.interact_ref, urlPermiso })
      : null
  if (!coincide) {
    await eventos.registrar({ tipo: 'cuenta', id, detalle: { texto: 'Callback con hash inválido: se ignoró.' } })
    return urlRegreso('invalido')
  }

  let propia = false
  try {
    propia = await op.continuarVerificacion({
      uriContinuacion: c.uri_continuacion!,
      tokenContinuacion: c.token_continuacion!,
      interactRef: q.interact_ref!,
      billetera: c.billetera,
    })
  } catch (e) {
    if ((await repo.obtener(id))?.estado === 'Verificada') return urlRegreso('verificada')
    log.warn('grant.continue de la verificación falló', { error: e, cuenta: id })
  }
  if (!propia) {
    await desenlazar(c, 'El banco no confirmó que la cuenta sea tuya.')
    return urlRegreso('rechazada')
  }

  await transaccion(async () => {
    if (await repo.actualizar(id, { estado: 'Verificada', verificada_en: ahoraIso(), ...TEMPORALES_EN_NULL }, 'PorVerificar')) {
      await eventos.registrar({
        tipo: 'cuenta',
        id,
        desde: 'PorVerificar',
        hacia: 'Verificada',
        detalle: { texto: 'Tu banco confirmó que la cuenta es tuya.', varianteHash: coincide.variante },
        actor: 'banco',
      })
    }
  })
  return urlRegreso('verificada')
}

/** Estado de la cuenta, que la web consulta mientras la persona aprueba. 404 si nunca enlazó una. */
export async function estado(documento: string) {
  const b = await persona(documento)
  const c = vistaCuenta(await aplicarVencimiento(await repo.ultimaDe(b.id)), b.numero_documento)
  if (!c) throw noEncontrado('Todavía no has enlazado una cuenta')
  return c
}

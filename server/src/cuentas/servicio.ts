/**
 * Cuentas del beneficiario: O3 y HU-07 (Plan backend § 8.7). Una llave Bre-B que resuelve el banco
 * puente (Plan Bre-B, RN-14 a RN-18) o una wallet Open Payments escrita a mano: permiso con
 * subject para probar que es de la persona, o el plan B (VERIFICACION_CUENTA=simulada).
 */
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { ErrorApi, noEncontrado } from '../comun/errores.js'
import type { FilaBeneficiario } from '../db/repositorios/beneficiarios.js'
import { log } from '../comun/log.js'
import { vistaCuenta } from '../comun/vistas.js'
import { ahoraIso, transaccion } from '../db/conexion.js'
import * as beneficiarios from '../db/repositorios/beneficiarios.js'
import * as repo from '../db/repositorios/cuentas.js'
import type { FilaCuenta } from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import { actorBeneficiario, type Actor } from '../db/repositorios/eventos.js'
import * as liquidacion from '../liquidacion/cliente.js'
import * as op from '../openPaymentsService.js'
import { verificarHash } from '../programas/hash.js'
import * as puente from '../puente/cliente.js'
import { normalizarLlave, type TipoLlave } from '../puente/contrato.js'
import { enmascararLlave } from '../puente/enmascarar.js'
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

/** Una wallet escrita a mano, o una llave Bre-B con su tipo (RN-14). */
export type EntradaCuenta =
  | { documento: string; billetera: string; tipoLlave?: undefined; llave?: undefined; pin?: string }
  | { documento: string; billetera?: undefined; tipoLlave: TipoLlave; llave: string; pin?: string }

/** Sin PIN registrado no hay qué validar; si lo tiene, es obligatorio y debe coincidir. */
async function exigirPin(documento: string, pin: string | undefined) {
  if ((await liquidacion.persona(documento))?.tienePin && !(pin && (await liquidacion.validarPin(documento, pin)))) {
    throw new ErrorApi(422, 'PinIncorrecto', 'PIN incorrecto')
  }
}

/**
 * Deja una cuenta nueva como la vigente de la persona; la anterior queda como historial (índice
 * una_cuenta_vigente). Va dentro de la transacción de quien la llama.
 */
async function reemplazarVigente(b: FilaBeneficiario, actor: Actor) {
  const vigente = await repo.vigenteDe(b.id)
  if (!vigente) return
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

const LLAVE_NO_EXISTE = 'No encontramos esa llave en Bre-B'
const LLAVE_AJENA = 'Esa llave no está a tu nombre'

function llaveLimpia(tipo: TipoLlave, valor: string): string {
  const limpia = normalizarLlave(tipo, valor)
  if (!limpia) throw new ErrorApi(400, 'LlaveInvalida', 'Eso no parece una llave de ese tipo; revisa el tipo que elegiste')
  return limpia
}

/** «¿Eres Ana M*** R***?»: lo que la persona ve antes de enlazar (HU-07). */
export async function consultarLlave(tipo: TipoLlave, valor: string) {
  const llave = llaveLimpia(tipo, valor)
  const r = await puente.resolverLlave(tipo, llave)
  if (!r) throw new ErrorApi(404, 'LlaveNoExiste', LLAVE_NO_EXISTE)
  return { tipoLlave: tipo, llave: enmascararLlave(tipo, llave), titular: r.titular }
}

/**
 * HU-07 con llave Bre-B. RN-15: una llave tipo cédula que es la cédula de la persona queda
 * Verificada sola. RN-16: las demás piden el PIN (si la persona lo tiene) y que el banco puente
 * confirme que el titular es esta cédula. Ninguna pasa por el permiso interactivo.
 */
async function enlazarLlave(b: FilaBeneficiario, tipo: TipoLlave, valor: string, pin: string | undefined) {
  const llave = llaveLimpia(tipo, valor)
  if (tipo === 'cedula') {
    if (llave !== b.numero_documento) throw new ErrorApi(422, 'LlaveDeOtraPersona', LLAVE_AJENA)
  } else {
    await exigirPin(b.numero_documento, pin)
  }
  const r = await puente.resolverLlave(tipo, llave)
  if (!r) throw new ErrorApi(404, 'LlaveNoExiste', LLAVE_NO_EXISTE)
  if (tipo !== 'cedula' && !(await puente.pertenece(tipo, llave, b.numero_documento))) {
    throw new ErrorApi(422, 'LlaveDeOtraPersona', LLAVE_AJENA)
  }
  const billetera = (await resolverWallet(r.billetera)).id.replace(/\/+$/, '')
  const id = randomUUID()
  const actor = actorBeneficiario(b.id)
  await transaccion(async () => {
    await reemplazarVigente(b, actor)
    await repo.crear({ id, beneficiario_id: b.id, billetera, estado: 'Verificada', verificada_en: ahoraIso(), tipo_llave: tipo, llave })
    await eventos.registrar({
      tipo: 'cuenta',
      id,
      hacia: 'Verificada',
      detalle: { texto: tipo === 'cedula' ? 'Tu cédula es tu llave Bre-B: queda lista para recibir.' : 'Bre-B confirmó que la llave es tuya.', tipoLlave: tipo },
      actor,
    })
  })
  return { redirect: null, cuenta: vistaCuenta(await repo.obtener(id), b.numero_documento) }
}

/**
 * RN-17: «Cobrar a mi cuenta» sin cuenta enlazada. Si la cédula de la persona es una llave Bre-B,
 * se enlaza sola (RN-15) y se devuelve; si no, undefined. Puede lanzar `PuenteNoResponde`.
 */
export async function cuentaPorCedula(b: FilaBeneficiario): Promise<FilaCuenta | undefined> {
  const r = await puente.resolverLlave('cedula', b.numero_documento)
  if (!r) return undefined
  let billetera: string
  try {
    billetera = (await op.leerWallet(r.billetera)).id.replace(/\/+$/, '')
  } catch {
    return undefined
  }
  const id = randomUUID()
  try {
    await transaccion(async () => {
      await repo.crear({ id, beneficiario_id: b.id, billetera, estado: 'Verificada', verificada_en: ahoraIso(), tipo_llave: 'cedula', llave: b.numero_documento })
      await eventos.registrar({
        tipo: 'cuenta',
        id,
        hacia: 'Verificada',
        detalle: { texto: 'Tu cédula es una llave Bre-B: la enlazamos sola para cobrar.', tipoLlave: 'cedula', automatica: true },
        actor: actorBeneficiario(b.id),
      })
    })
  } catch (e) {
    // Dos «Cobrar» a la vez: el índice una_cuenta_vigente deja pasar una sola
    const vigente = await repo.vigenteDe(b.id)
    if (vigente) return vigente
    throw e
  }
  return repo.obtener(id)
}

/**
 * RN-18: antes de pagar, la llave se vuelve a resolver. Si cambió de wallet (la persona la movió a
 * otro banco), se guarda la nueva; si ya no existe, 'LlaveNoExiste'. Puede lanzar `PuenteNoResponde`.
 */
export async function refrescarLlave(c: FilaCuenta): Promise<FilaCuenta | 'LlaveNoExiste'> {
  if (!c.tipo_llave || !c.llave) return c
  const r = await puente.resolverLlave(c.tipo_llave, c.llave)
  if (!r) return 'LlaveNoExiste'
  const billetera = r.billetera.replace(/\/+$/, '')
  if (billetera === c.billetera) return c
  await transaccion(async () => {
    if (await repo.actualizar(c.id, { billetera }, 'Verificada')) {
      await eventos.registrar({ tipo: 'cuenta', id: c.id, detalle: { texto: 'Tu llave Bre-B ahora llega a otra cuenta: el pago va a la nueva.' } })
    }
  })
  return (await repo.obtener(c.id)) ?? c
}

export async function enlazar(e: EntradaCuenta) {
  const b = await persona(e.documento)
  if (e.tipoLlave !== undefined) return enlazarLlave(b, e.tipoLlave, e.llave, e.pin)
  await exigirPin(e.documento, e.pin)
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
    await reemplazarVigente(b, actor)
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

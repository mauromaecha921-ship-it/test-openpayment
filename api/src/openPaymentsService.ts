/**
 * Adaptador de Open Payments: el ÚNICO archivo que importa el SDK (AD-07, Plan backend § 6).
 * El resto de la API habla con estas funciones y nunca ve objetos del SDK.
 */
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  createAuthenticatedClient,
  createUnauthenticatedClient,
  isFinalizedGrantWithAccessToken,
  isFinalizedGrantWithSubject,
  isPendingGrant,
  OpenPaymentsClientError,
  type AuthenticatedClient,
  type UnauthenticatedClient,
  type WalletAddress,
} from '@interledger/open-payments'
import { config, RAIZ_API } from './config.js'
import { mismaBilletera, normalizarBilletera } from './comun/billeteras.js'
import { log } from './comun/log.js'
import { montoOP, type Moneda } from './comun/montos.js'

// ---------------------------------------------------------------------------------------------
// Errores (§ 6, «Cómo se traducen los errores»)
// ---------------------------------------------------------------------------------------------

export type TipoErrorOP = 'TopeSuperado' | 'TokenVencido' | 'SinRespuesta' | 'ErrorOpenPayments' | 'NoConfigurado'

export class ErrorOP extends Error {
  constructor(
    readonly tipo: TipoErrorOP,
    readonly status?: number,
    readonly code?: string,
    readonly description?: string,
  ) {
    super(`Open Payments: ${tipo}${status ? ` (${status})` : ''}${description ? ` ${description}` : ''}`)
  }
}

type Operacion = 'pagoSaliente' | 'otra'

export function traducir(e: unknown, operacion: Operacion): ErrorOP {
  if (e instanceof ErrorOP) return e
  if (e instanceof OpenPaymentsClientError) {
    const { status, code, description } = e
    // Solo status, code y description: nunca tokens (RNF-09).
    log.warn('Error de Open Payments', { status, code, description, operacion })
    // La Test Wallet responde 403 «Inactive Token» (no 401) cuando el token del permiso venció:
    // es TokenVencido, y conToken lo rota. Confundirlo con el tope dejaba el programa sin pagar (D-34).
    if (status === 401 || (status === 403 && /inactive token/i.test(description ?? ''))) {
      return new ErrorOP('TokenVencido', status, code, description)
    }
    // Cualquier otro 403 al crear el pago saliente: el candidato a InsufficientGrant (se confirma en V-02).
    if (status === 403 && operacion === 'pagoSaliente') return new ErrorOP('TopeSuperado', status, code, description)
    // Sin status (tiempo agotado, red) o un 5xx: no sabemos si pasó. Nunca se marca Fallido por esto.
    if (status === undefined || status >= 500) return new ErrorOP('SinRespuesta', status, code, description)
    return new ErrorOP('ErrorOpenPayments', status, code, description)
  }
  log.warn('Error sin respuesta de Open Payments', { error: e, operacion })
  return new ErrorOP('SinRespuesta', undefined, undefined, (e as Error)?.message)
}

async function op<T>(operacion: Operacion, fn: (c: AuthenticatedClient) => Promise<T>): Promise<T> {
  const c = await cliente()
  try {
    return await fn(c)
  } catch (e) {
    throw traducir(e, operacion)
  }
}

// ---------------------------------------------------------------------------------------------
// Cliente y llave
// ---------------------------------------------------------------------------------------------

let clientePromesa: Promise<AuthenticatedClient> | undefined

/** La llave privada: OP_PRIVATE_KEY_BASE64 (el PEM en base64, o el DER pkcs8) u OP_PRIVATE_KEY_PATH. */
export function cargarLlave(): KeyObject {
  const { OP_PRIVATE_KEY_BASE64, OP_PRIVATE_KEY_PATH } = config()
  let llave: KeyObject
  if (OP_PRIVATE_KEY_BASE64) {
    const bytes = Buffer.from(OP_PRIVATE_KEY_BASE64, 'base64')
    const texto = bytes.toString('utf8')
    llave = texto.includes('-----BEGIN')
      ? createPrivateKey(texto)
      : createPrivateKey({ key: bytes, format: 'der', type: 'pkcs8' })
  } else if (OP_PRIVATE_KEY_PATH) {
    llave = createPrivateKey(readFileSync(path.resolve(RAIZ_API, OP_PRIVATE_KEY_PATH)))
  } else {
    throw new ErrorOP('NoConfigurado', undefined, undefined, 'Falta OP_PRIVATE_KEY_BASE64 u OP_PRIVATE_KEY_PATH en api/.env')
  }
  if (llave.asymmetricKeyType !== 'ed25519') {
    throw new ErrorOP('NoConfigurado', undefined, undefined, 'La llave privada no es Ed25519')
  }
  return llave
}

function datosCliente() {
  const { OP_CLIENT_WALLET_ADDRESS, OP_KEY_ID } = config()
  const faltan = [!OP_CLIENT_WALLET_ADDRESS && 'OP_CLIENT_WALLET_ADDRESS', !OP_KEY_ID && 'OP_KEY_ID'].filter(Boolean)
  if (faltan.length) throw new ErrorOP('NoConfigurado', undefined, undefined, `Faltan en api/.env: ${faltan.join(', ')}`)
  return { walletAddressUrl: OP_CLIENT_WALLET_ADDRESS!, keyId: OP_KEY_ID! }
}

/** Crea el cliente una sola vez (Plan backend § 6). */
export function cliente(): Promise<AuthenticatedClient> {
  if (!clientePromesa) {
    clientePromesa = (async () => {
      const { walletAddressUrl, keyId } = datosCliente()
      return createAuthenticatedClient({
        walletAddressUrl,
        keyId,
        privateKey: cargarLlave(),
        logLevel: 'warn',
        requestTimeoutMs: 15000,
      })
    })()
    clientePromesa.catch(() => {
      clientePromesa = undefined
    })
  }
  return clientePromesa
}

/** GET /salud: ¿la llave pública coincide con la publicada en el jwks.json de la wallet cliente? */
export async function diagnosticoLlave(): Promise<{ configurado: boolean; coincide: boolean | null; detalle: string }> {
  let llave: KeyObject
  let datos: ReturnType<typeof datosCliente>
  try {
    datos = datosCliente()
    llave = cargarLlave()
  } catch (e) {
    return { configurado: false, coincide: null, detalle: (e as ErrorOP).description ?? 'Sin configurar' }
  }
  const publica = createPublicKey(llave).export({ format: 'jwk' }) as { x?: string }
  try {
    const c = await cliente()
    const jwks = await c.walletAddress.getKeys({ url: datos.walletAddressUrl })
    const publicada = jwks.keys.find((k) => k.kid === datos.keyId)
    if (!publicada) return { configurado: true, coincide: false, detalle: 'El OP_KEY_ID no está en el jwks.json de la wallet cliente' }
    const coincide = publicada.x === publica.x
    return {
      configurado: true,
      coincide,
      detalle: coincide ? 'La llave coincide con el jwks.json' : 'El OP_KEY_ID existe, pero la llave pública no coincide',
    }
  } catch (e) {
    const t = traducir(e, 'otra')
    return { configurado: true, coincide: null, detalle: `No se pudo leer el jwks.json: ${t.tipo}` }
  }
}

// ---------------------------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------------------------

export interface Wallet {
  id: string
  codigoMoneda: string
  escala: number
  authServer: string
  resourceServer: string
  nombre?: string
}

const cacheWallets = new Map<string, { wallet: Wallet; vence: number }>()
const CINCO_MIN = 5 * 60 * 1000

function aWallet(w: WalletAddress): Wallet {
  return {
    id: w.id,
    codigoMoneda: w.assetCode,
    escala: w.assetScale,
    authServer: w.authServer,
    resourceServer: w.resourceServer,
    nombre: w.publicName,
  }
}

let clientePublicoPromesa: Promise<UnauthenticatedClient> | undefined

/** Leer una wallet address es público: no necesita la llave, así se registra gente sin el `.env` lleno. */
function clientePublico(): Promise<UnauthenticatedClient> {
  clientePublicoPromesa ??= createUnauthenticatedClient({ logLevel: 'warn', requestTimeoutMs: 15000 })
  clientePublicoPromesa.catch(() => {
    clientePublicoPromesa = undefined
  })
  return clientePublicoPromesa
}

/** walletAddress.get con caché de 5 minutos. Acepta `$…` o `https://…`. */
export async function leerWallet(direccion: string): Promise<Wallet> {
  const url = normalizarBilletera(direccion)
  const guardada = cacheWallets.get(url)
  if (guardada && guardada.vence > Date.now()) return guardada.wallet
  const c = await clientePublico()
  let w: WalletAddress
  try {
    w = await c.walletAddress.get({ url })
  } catch (e) {
    throw traducir(e, 'otra')
  }
  const wallet = aWallet(w)
  cacheWallets.set(url, { wallet, vence: Date.now() + CINCO_MIN })
  return wallet
}

// ---------------------------------------------------------------------------------------------
// Permiso del programa (O2, HU-04 a HU-06, O8)
// ---------------------------------------------------------------------------------------------

export interface PermisoPendiente {
  redirect: string
  /** interact.finish de la respuesta: el nonce del servidor (nonce_cierre). */
  nonceCierre: string
  uriContinuacion: string
  tokenContinuacion: string
  /** La URL del servidor de autorización: el grant_url del hash (url_permiso). */
  urlPermiso: string
}

export interface TokenPermiso {
  token: string
  urlGestion: string
  expiraEnSeg?: number
}

interface PedidoInteractivo {
  nonce: string
  urlRetorno: string
}

function interaccion({ nonce, urlRetorno }: PedidoInteractivo) {
  return { start: ['redirect' as const], finish: { method: 'redirect' as const, uri: urlRetorno, nonce } }
}

/** grant.request de outgoing-payment con tope y sin receptor (AD-09), interactivo. */
export async function pedirPermisoPrograma(args: {
  billetera: string
  tope: number
  moneda: Moneda
} & PedidoInteractivo): Promise<PermisoPendiente> {
  const wallet = await leerWallet(args.billetera)
  const g = await op('otra', (c) =>
    c.grant.request(
      { url: wallet.authServer },
      {
        access_token: {
          access: [
            {
              type: 'outgoing-payment',
              actions: ['create', 'read'],
              identifier: wallet.id,
              limits: { debitAmount: montoOP(args.tope, args.moneda) },
            },
          ],
        },
        interact: interaccion(args),
      },
    ),
  )
  if (!isPendingGrant(g)) throw new ErrorOP('ErrorOpenPayments', undefined, undefined, 'El permiso no quedó pendiente de aprobación')
  return {
    redirect: g.interact.redirect,
    nonceCierre: g.interact.finish,
    uriContinuacion: g.continue.uri,
    tokenContinuacion: g.continue.access_token.value,
    urlPermiso: wallet.authServer,
  }
}

/** grant.continue con el interact_ref; exige un permiso con token. */
export async function continuarPermiso(args: {
  uriContinuacion: string
  tokenContinuacion: string
  interactRef: string
}): Promise<TokenPermiso> {
  const g = await op('otra', (c) =>
    c.grant.continue({ url: args.uriContinuacion, accessToken: args.tokenContinuacion }, { interact_ref: args.interactRef }),
  )
  if (!isFinalizedGrantWithAccessToken(g)) {
    throw new ErrorOP('ErrorOpenPayments', undefined, undefined, 'La continuación no entregó un token de acceso')
  }
  return { token: g.access_token.value, urlGestion: g.access_token.manage, expiraEnSeg: g.access_token.expires_in }
}

/** grant.cancel: solo para una aprobación pendiente (HU-05, D-09). */
export async function cancelarPermisoPendiente(args: { uriContinuacion: string; tokenContinuacion: string }) {
  await op('otra', (c) => c.grant.cancel({ url: args.uriContinuacion, accessToken: args.tokenContinuacion }))
}

/** token.rotate (HU-06). */
export async function rotarToken(args: { urlGestion: string; token: string }): Promise<TokenPermiso> {
  const r = await op('otra', (c) => c.token.rotate({ url: args.urlGestion, accessToken: args.token }))
  return { token: r.access_token.value, urlGestion: r.access_token.manage, expiraEnSeg: r.access_token.expires_in }
}

/** token.revoke (O8, HU-17). */
export async function revocarPermiso(args: { urlGestion: string; token: string }) {
  await op('otra', (c) => c.token.revoke({ url: args.urlGestion, accessToken: args.token }))
}

// ---------------------------------------------------------------------------------------------
// Verificación de la cuenta del beneficiario (O3, HU-07)
// ---------------------------------------------------------------------------------------------

/** grant.request con subject.sub_ids = la wallet del beneficiario; interactivo obligatorio. */
export async function pedirVerificacionCuenta(args: { billetera: string } & PedidoInteractivo): Promise<PermisoPendiente> {
  const wallet = await leerWallet(args.billetera)
  const g = await op('otra', (c) =>
    c.grant.request(
      { url: wallet.authServer },
      { subject: { sub_ids: [{ id: wallet.id, format: 'uri' }] }, interact: interaccion(args) },
    ),
  )
  if (!isPendingGrant(g)) throw new ErrorOP('ErrorOpenPayments', undefined, undefined, 'La verificación no quedó pendiente')
  return {
    redirect: g.interact.redirect,
    nonceCierre: g.interact.finish,
    uriContinuacion: g.continue.uri,
    tokenContinuacion: g.continue.access_token.value,
    urlPermiso: wallet.authServer,
  }
}

/** grant.continue; true solo si devuelve el subject y el sub_id es la wallet enlazada. */
export async function continuarVerificacion(args: {
  uriContinuacion: string
  tokenContinuacion: string
  interactRef: string
  billetera: string
}): Promise<boolean> {
  const g = await op('otra', (c) =>
    c.grant.continue({ url: args.uriContinuacion, accessToken: args.tokenContinuacion }, { interact_ref: args.interactRef }),
  )
  if (!isFinalizedGrantWithSubject(g)) return false
  return g.subject.sub_ids.some((s) => mismaBilletera(s.id, args.billetera))
}

// ---------------------------------------------------------------------------------------------
// Pagos (O4, O5, O6, O7)
// ---------------------------------------------------------------------------------------------

/** Tokens de pago entrante por wallet de destino: permisos no interactivos, se reutilizan mientras duren. */
const tokensEntrantes = new Map<string, { token: string; vence: number }>()

async function tokenEntrante(wallet: Wallet): Promise<string> {
  const guardado = tokensEntrantes.get(wallet.id)
  if (guardado && guardado.vence > Date.now()) return guardado.token
  const g = await op('otra', (c) =>
    c.grant.request(
      { url: wallet.authServer },
      { access_token: { access: [{ type: 'incoming-payment', actions: ['create', 'read'] }] } },
    ),
  )
  if (!isFinalizedGrantWithAccessToken(g)) {
    throw new ErrorOP('ErrorOpenPayments', undefined, undefined, 'El permiso de pago entrante pidió interacción')
  }
  const duracion = (g.access_token.expires_in ?? 300) * 1000
  tokensEntrantes.set(wallet.id, { token: g.access_token.value, vence: Date.now() + duracion - 30_000 })
  return g.access_token.value
}

export interface PagoEntrante {
  id: string
  completado: boolean
  recibido: string
  esperado?: string
}

/** Pago entrante de monto fijo en la wallet de destino (cuenta o punto). */
export async function crearPagoEntrante(args: {
  billetera: string
  monto: number
  moneda: Moneda
  referencia: string
  descripcion: string
}): Promise<PagoEntrante> {
  const wallet = await leerWallet(args.billetera)
  const token = await tokenEntrante(wallet)
  const p = await op('otra', (c) =>
    c.incomingPayment.create(
      { url: wallet.resourceServer, accessToken: token },
      {
        walletAddress: wallet.id,
        incomingAmount: montoOP(args.monto, args.moneda),
        metadata: { description: args.descripcion, referencia: args.referencia },
      },
    ),
  )
  return { id: p.id, completado: p.completed, recibido: p.receivedAmount.value, esperado: p.incomingAmount?.value }
}

export async function leerPagoEntrante(args: { url: string; billetera: string }): Promise<PagoEntrante> {
  const wallet = await leerWallet(args.billetera)
  const token = await tokenEntrante(wallet)
  const p = await op('otra', (c) => c.incomingPayment.get({ url: args.url, accessToken: token }))
  return { id: p.id, completado: p.completed, recibido: p.receivedAmount.value, esperado: p.incomingAmount?.value }
}

export interface PagoSaliente {
  id: string
  fallido: boolean
  debitado: string
  enviado: string
}

/** outgoingPayment.create con incomingPayment y debitAmount: la forma B, sin cotización (AD-10). */
export async function crearPagoSaliente(args: {
  billeteraPrograma: string
  token: string
  urlPagoEntrante: string
  monto: number
  moneda: Moneda
  referencia: string
}): Promise<PagoSaliente> {
  const wallet = await leerWallet(args.billeteraPrograma)
  const p = await op('pagoSaliente', (c) =>
    c.outgoingPayment.create(
      { url: wallet.resourceServer, accessToken: args.token },
      {
        walletAddress: wallet.id,
        incomingPayment: args.urlPagoEntrante,
        debitAmount: montoOP(args.monto, args.moneda),
        metadata: { referencia: args.referencia },
      },
    ),
  )
  return { id: p.id, fallido: p.failed, debitado: p.debitAmount.value, enviado: p.sentAmount.value }
}

export async function leerPagoSaliente(args: { url: string; token: string }): Promise<PagoSaliente> {
  const p = await op('otra', (c) => c.outgoingPayment.get({ url: args.url, accessToken: args.token }))
  return { id: p.id, fallido: p.failed, debitado: p.debitAmount.value, enviado: p.sentAmount.value }
}

/** getGrantSpentAmounts → spentDebitAmount (O7). null si el permiso todavía no gastó nada. */
export async function gastadoDelPermiso(args: { billeteraPrograma: string; token: string }): Promise<string | null> {
  const wallet = await leerWallet(args.billeteraPrograma)
  const r = await op('otra', (c) =>
    c.outgoingPayment.getGrantSpentAmounts({ url: wallet.resourceServer, accessToken: args.token }),
  )
  return r.spentDebitAmount?.value ?? null
}

/** Solo para pruebas y para el script de la Fase 1. */
export function olvidarCaches() {
  cacheWallets.clear()
  tokensEntrantes.clear()
}

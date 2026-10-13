/**
 * Programas: O1, O2, O7 y O8, más HU-05, HU-06 y HU-18 (Plan backend § 7 y § 8.1, § 8.8).
 * Aquí vive RN-08 (el tope) y el manejo del token del permiso.
 */
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { conflicto, ErrorApi, noEncontrado } from '../comun/errores.js'
import { log } from '../comun/log.js'
import { aTexto, desdeDecimal, deTexto } from '../comun/montos.js'
import { moneda, vistaCobro, vistaPrograma } from '../comun/vistas.js'
import { ahoraIso, transaccion } from '../db/conexion.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as comercios from '../db/repositorios/comercios.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as repo from '../db/repositorios/programas.js'
import type { FilaPrograma, NuevoPrograma } from '../db/repositorios/programas.js'
import * as liquidacion from '../liquidacion/cliente.js'
import * as op from '../openPaymentsService.js'
import { ErrorOP } from '../openPaymentsService.js'
import { puedeTransicionarPrograma, type EstadoPrograma } from './estados.js'
import { verificarHash } from './hash.js'

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

export function exigir(id: string): FilaPrograma {
  const p = repo.obtener(id)
  if (!p) throw noEncontrado('Ese programa no existe')
  return p
}

function exigirEstado(p: FilaPrograma, ...estados: EstadoPrograma[]) {
  if (!estados.includes(p.estado)) {
    throw conflicto('EstadoNoPermite', `El programa está en ${p.estado}; esta acción pide ${estados.join(' o ')}`)
  }
}

/** Cambia de estado con su evento, solo si la transición existe y nadie lo cambió antes. */
function transicion(p: FilaPrograma, hacia: EstadoPrograma, campos: repo.CamposPrograma, detalle: Record<string, unknown>) {
  if (!puedeTransicionarPrograma(p.estado, hacia)) {
    throw conflicto('TransicionNoPermitida', `El programa no puede pasar de ${p.estado} a ${hacia}`)
  }
  return transaccion(() => {
    const cambio = repo.actualizar(p.id, { ...campos, estado: hacia }, p.estado)
    if (cambio) eventos.registrar({ tipo: 'programa', id: p.id, desde: p.estado, hacia, detalle })
    return cambio
  })
}

const TEMPORALES_EN_NULL = {
  uri_continuacion: null,
  token_continuacion: null,
  nonce_cliente: null,
  nonce_cierre: null,
} as const

export async function resolverWallet(direccion: string) {
  try {
    return await op.leerWallet(direccion)
  } catch (e) {
    if (e instanceof ErrorOP && e.tipo === 'NoConfigurado') throw new ErrorApi(503, 'OpenPaymentsNoConfigurado', e.description ?? '')
    // Sin respuesta (red caída o la Test Wallet no contesta): no es lo mismo que «no existe»
    if (e instanceof ErrorOP && e.tipo === 'SinRespuesta') {
      throw new ErrorApi(503, 'BilleteraSinRespuesta', 'No pudimos consultar esa wallet; revisa la conexión e intenta de nuevo')
    }
    // HU-01: si no resuelve, «No encontramos esa cuenta»
    throw new ErrorApi(404, 'BilleteraNoEncontrada', 'No encontramos esa cuenta')
  }
}

// ---------------------------------------------------------------------------------------------
// O1 · crear, editar, leer
// ---------------------------------------------------------------------------------------------

export interface EntradaPrograma {
  entidad: string
  nombre: string
  billetera: string
  vigenciaInicio: string
  vigenciaFin: string
  tipo: 'subsidio' | 'bono'
  /** En pesos («10000»); se guarda en unidades mínimas con la escala de la wallet. */
  montoPorPersona?: string
  /** § 11: las categorías de comercio que acepta un bono. */
  categorias?: string[]
}

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** «2026-10-01» = desde las 00:00 en Bogotá (UTC−5); un instante ISO se respeta tal cual. */
export function inicioVigencia(v: string): string {
  return SOLO_FECHA.test(v) ? `${v}T05:00:00.000Z` : new Date(v).toISOString()
}

/** «2026-12-31» = hasta las 23:59:59.999 en Bogotá, es decir el día completo. */
export function finVigencia(v: string): string {
  if (!SOLO_FECHA.test(v)) return new Date(v).toISOString()
  const [y, m, d] = v.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999)).toISOString()
}

/** «10000» en pesos → unidades mínimas con la escala de la wallet del programa. */
function montoPorPersona(valor: string, escala: number): number {
  let unidades: bigint
  try {
    unidades = desdeDecimal(valor, escala)
  } catch (e) {
    throw new ErrorApi(400, 'EntradaInvalida', `Monto por persona: ${(e as Error).message.toLowerCase()}`)
  }
  if (unidades <= 0n) throw new ErrorApi(400, 'EntradaInvalida', 'El monto por persona debe ser mayor que cero')
  return deTexto(unidades.toString())
}

function exigirVigencia(inicio: string, fin: string) {
  if (Date.parse(fin) <= Date.parse(inicio)) {
    throw new ErrorApi(400, 'EntradaInvalida', 'La vigencia debe terminar después de empezar')
  }
}

async function datosDesdeEntrada(e: EntradaPrograma): Promise<NuevoPrograma> {
  const vigencia_inicio = inicioVigencia(e.vigenciaInicio)
  const vigencia_fin = finVigencia(e.vigenciaFin)
  exigirVigencia(vigencia_inicio, vigencia_fin)
  // Convierte $ en https:// y toma la moneda y la escala de la wallet (HU-01)
  const wallet = await resolverWallet(e.billetera)
  return {
    entidad: e.entidad,
    nombre: e.nombre,
    tipo: e.tipo,
    destino: e.tipo === 'subsidio' ? 'libre' : 'restringido',
    billetera_programa: wallet.id.replace(/\/+$/, ''),
    codigo_moneda: wallet.codigoMoneda,
    escala_moneda: wallet.escala,
    vigencia_inicio,
    vigencia_fin,
    monto_por_persona: e.montoPorPersona === undefined ? null : montoPorPersona(e.montoPorPersona, wallet.escala),
  }
}

export async function crear(entrada: EntradaPrograma) {
  const datos = await datosDesdeEntrada(entrada)
  const p = transaccion(() => {
    const nuevo = repo.crear(datos)
    if (nuevo.tipo === 'bono') comercios.ponerCategorias(nuevo.id, entrada.categorias ?? [])
    eventos.registrar({ tipo: 'programa', id: nuevo.id, hacia: 'Borrador', detalle: { texto: 'Programa creado en borrador.' } })
    return nuevo
  })
  return vistaPrograma(p)
}

export async function editar(id: string, entrada: Partial<EntradaPrograma>) {
  const p = exigir(id)
  exigirEstado(p, 'Borrador')
  const campos: repo.CamposPrograma = {}
  if (entrada.entidad !== undefined) campos.entidad = entrada.entidad
  if (entrada.nombre !== undefined) campos.nombre = entrada.nombre
  if (entrada.vigenciaInicio !== undefined) campos.vigencia_inicio = inicioVigencia(entrada.vigenciaInicio)
  if (entrada.vigenciaFin !== undefined) campos.vigencia_fin = finVigencia(entrada.vigenciaFin)
  exigirVigencia(campos.vigencia_inicio ?? p.vigencia_inicio, campos.vigencia_fin ?? p.vigencia_fin)
  if (entrada.tipo !== undefined) {
    campos.tipo = entrada.tipo
    campos.destino = entrada.tipo === 'subsidio' ? 'libre' : 'restringido'
  }
  if (entrada.billetera !== undefined) {
    const w = await resolverWallet(entrada.billetera)
    campos.billetera_programa = w.id.replace(/\/+$/, '')
    campos.codigo_moneda = w.codigoMoneda
    campos.escala_moneda = w.escala
  }
  if (entrada.montoPorPersona !== undefined) {
    campos.monto_por_persona = montoPorPersona(entrada.montoPorPersona, campos.escala_moneda ?? p.escala_moneda)
  }
  if (Object.keys(campos).length && !repo.actualizar(id, campos, 'Borrador')) {
    throw conflicto('EstadoNoPermite', 'El programa ya no está en Borrador')
  }
  if (entrada.categorias !== undefined || entrada.tipo !== undefined) {
    const actual = exigir(id)
    comercios.ponerCategorias(id, actual.tipo === 'bono' ? (entrada.categorias ?? comercios.categoriasDe(id)) : [])
  }
  return vistaPrograma(exigir(id))
}

/** HU-05: si lleva más de APROBACION_TTL_MIN en EsperandoAprobacion, vuelve a Borrador. */
export async function aplicarVencimiento(p: FilaPrograma): Promise<FilaPrograma> {
  if (p.estado !== 'EsperandoAprobacion') return p
  const desde = eventos.ultimoHacia('programa', p.id, 'EsperandoAprobacion')?.creado_en
  const ttl = config().APROBACION_TTL_MIN * 60_000
  if (!desde || Date.now() - Date.parse(desde) <= ttl) return p
  await cancelarEnServidor(p)
  transicion(p, 'Borrador', TEMPORALES_EN_NULL, { texto: 'La aprobación venció sin respuesta.', resultado: 'vencido' })
  return exigir(p.id)
}

async function cancelarEnServidor(p: FilaPrograma) {
  if (!p.uri_continuacion || !p.token_continuacion) return
  try {
    await op.cancelarPermisoPendiente({ uriContinuacion: p.uri_continuacion, tokenContinuacion: p.token_continuacion })
  } catch (e) {
    // Si el servidor ya no lo tiene, da igual: el permiso nunca se aprobó.
    log.warn('No se pudo cancelar el permiso pendiente', { error: e, programa: p.id })
  }
}

export async function leer(id: string) {
  return vistaPrograma(await aplicarVencimiento(exigir(id)))
}

export async function listar() {
  const lista = []
  for (const p of repo.listar()) lista.push(vistaPrograma(await aplicarVencimiento(p)))
  return lista
}

export async function resumenLiquidacion(id: string) {
  const p = exigir(id)
  const r = await liquidacion.resumen(p.id)
  return { cedulas: r.cedulas, total: r.total, moneda: moneda(p) }
}

// ---------------------------------------------------------------------------------------------
// O2 · autorizar y callback
// ---------------------------------------------------------------------------------------------

export async function autorizar(id: string) {
  const p = exigir(id)
  exigirEstado(p, 'Borrador')
  // RN-08: el tope es el total de la liquidación al pedir la aprobación, y queda fijo.
  const tope = deTexto((await liquidacion.resumen(p.id)).total)
  if (tope <= 0) throw conflicto('SinLiquidacion', 'La liquidación no tiene cédulas para este programa')
  // § 11: un bono sin categorías no lo acepta ningún comercio
  if (p.tipo === 'bono' && !comercios.categoriasDe(p.id).length) {
    throw conflicto('BonoSinCategorias', 'Elige al menos una categoría de comercio que acepte el bono')
  }

  const nonce = randomUUID()
  let pendiente: op.PermisoPendiente
  try {
    pendiente = await op.pedirPermisoPrograma({
      billetera: p.billetera_programa,
      tope,
      moneda: moneda(p),
      nonce,
      urlRetorno: `${config().API_BASE_URL}/callback/${p.id}`,
    })
  } catch (e) {
    throw errorOpApi(e, 'No pudimos pedir la aprobación al banco')
  }

  const cambio = transicion(
    p,
    'EsperandoAprobacion',
    {
      tope_total: tope,
      nonce_cliente: nonce,
      nonce_cierre: pendiente.nonceCierre,
      uri_continuacion: pendiente.uriContinuacion,
      token_continuacion: pendiente.tokenContinuacion,
      url_permiso: pendiente.urlPermiso,
    },
    { texto: 'Se pidió la aprobación del permiso con tope.', tope: aTexto(tope) },
  )
  if (!cambio) throw conflicto('EstadoNoPermite', 'El programa cambió mientras se pedía la aprobación')
  // interact.redirect no se guarda (Historias § Variables de Open Payments)
  return { redirect: pendiente.redirect, programa: vistaPrograma(exigir(id)) }
}

export function errorOpApi(e: unknown, mensaje: string): ErrorApi {
  if (e instanceof ErrorApi) return e
  if (e instanceof ErrorOP) {
    if (e.tipo === 'NoConfigurado') return new ErrorApi(503, 'OpenPaymentsNoConfigurado', e.description ?? mensaje)
    return new ErrorApi(502, 'ErrorOpenPayments', mensaje)
  }
  return new ErrorApi(500, 'ErrorInterno', mensaje)
}

export type ResultadoCallback = 'aprobado' | 'rechazado' | 'invalido' | 'vencido'

function urlRegreso(id: string, resultado: ResultadoCallback) {
  return `${config().APP_BASE_URL}/entidad/programas/${encodeURIComponent(id)}/aprobar?resultado=${resultado}`
}

/** GET /callback/:id → devuelve a dónde redirigir (302). Plan backend § 8.1, pasos 6 a 9. */
export async function callback(id: string, q: { hash?: string; interact_ref?: string; result?: string }): Promise<string> {
  const original = repo.obtener(id)
  if (!original) return `${config().APP_BASE_URL}/entidad?resultado=invalido`
  const p = await aplicarVencimiento(original)

  // D-35: vuelve de renovar el permiso (el programa sigue Activo o Pausado)
  if ((p.estado === 'Activo' || p.estado === 'Pausado') && p.uri_continuacion) return callbackRenovacion(p, q)
  // HU-04: un callback repetido con el programa ya Activo redirige igual sin cambiar nada
  if (p.estado === 'Activo' || p.estado === 'Pausado') return urlRegreso(id, 'aprobado')
  if (p.estado !== 'EsperandoAprobacion') return urlRegreso(id, 'vencido')

  if (q.result === 'grant_rejected' || q.result === 'grant_invalid') {
    transicion(p, 'Borrador', TEMPORALES_EN_NULL, {
      texto: q.result === 'grant_rejected' ? 'La aprobación fue rechazada en el banco.' : 'El banco marcó la aprobación como inválida.',
      resultado: q.result,
    })
    return urlRegreso(id, 'rechazado')
  }

  const coincide =
    q.hash && q.interact_ref && p.nonce_cliente && p.nonce_cierre && p.url_permiso
      ? verificarHash(q.hash, {
          nonceCliente: p.nonce_cliente,
          nonceCierre: p.nonce_cierre,
          interactRef: q.interact_ref,
          urlPermiso: p.url_permiso,
        })
      : null
  if (!coincide) {
    // El programa no cambia; queda el evento (HU-04, RNF-01)
    eventos.registrar({ tipo: 'programa', id, detalle: { texto: 'Callback con hash inválido: se ignoró.', resultado: 'invalido' } })
    return urlRegreso(id, 'invalido')
  }

  let permiso: op.TokenPermiso
  try {
    permiso = await op.continuarPermiso({
      uriContinuacion: p.uri_continuacion!,
      tokenContinuacion: p.token_continuacion!,
      interactRef: q.interact_ref!,
    })
  } catch (e) {
    // Dos callbacks a la vez: el segundo falla al continuar, pero el primero ya activó
    const ahora = exigir(id)
    if (ahora.estado === 'Activo') return urlRegreso(id, 'aprobado')
    log.warn('grant.continue falló', { error: e, programa: id })
    eventos.registrar({ tipo: 'programa', id, detalle: { texto: 'El banco no confirmó el permiso.', resultado: 'invalido' } })
    return urlRegreso(id, 'invalido')
  }

  const cambio = transicion(
    p,
    'Activo',
    { ...TEMPORALES_EN_NULL, token_acceso: permiso.token, url_gestion: permiso.urlGestion },
    // V-05 y V-03: la variante del hash y la duración del token, nunca el token
    { texto: 'Permiso aprobado en el banco.', varianteHash: coincide.variante, grantUrl: coincide.grantUrl, expiresIn: permiso.expiraEnSeg ?? null },
  )
  if (!cambio && exigir(id).estado !== 'Activo') return urlRegreso(id, 'invalido')
  return urlRegreso(id, 'aprobado')
}

/** «Cancelar» mientras espera la aprobación (D-09): grant.cancel y vuelve a Borrador. */
export async function cancelarAprobacion(id: string) {
  const p = exigir(id)
  exigirEstado(p, 'EsperandoAprobacion')
  await cancelarEnServidor(p)
  transicion(p, 'Borrador', TEMPORALES_EN_NULL, { texto: 'La entidad canceló la aprobación.', resultado: 'cancelado' })
  return vistaPrograma(exigir(id))
}

// ---------------------------------------------------------------------------------------------
// D-35 · renovar el permiso cuando el banco ya no acepta el token (la API estuvo apagada)
// ---------------------------------------------------------------------------------------------

export type ResultadoRenovacion = 'aprobada' | 'rechazada' | 'invalida'

function urlTablero(id: string, renovacion: ResultadoRenovacion) {
  return `${config().APP_BASE_URL}/entidad/programas/${encodeURIComponent(id)}?renovacion=${renovacion}`
}

/** Pide un permiso nuevo por lo que falta del tope. El programa no cambia de estado. */
export async function renovarPermiso(id: string) {
  const p = exigir(id)
  exigirEstado(p, 'Activo', 'Pausado')
  if (!p.permiso_vencido_en) throw conflicto('PermisoVigente', 'El permiso sigue vigente: no hace falta renovarlo')
  const restante = (p.tope_total ?? 0) - cobros.sumaComprometida(p.id)
  if (restante <= 0) throw conflicto('TopeAgotado', 'Ya se pagó todo el tope: no queda nada por autorizar')

  const nonce = randomUUID()
  let pendiente: op.PermisoPendiente
  try {
    pendiente = await op.pedirPermisoPrograma({
      billetera: p.billetera_programa,
      tope: restante,
      moneda: moneda(p),
      nonce,
      urlRetorno: `${config().API_BASE_URL}/callback/${p.id}`,
    })
  } catch (e) {
    throw errorOpApi(e, 'No pudimos pedir la renovación al banco')
  }
  transaccion(() => {
    repo.actualizar(p.id, {
      nonce_cliente: nonce,
      nonce_cierre: pendiente.nonceCierre,
      uri_continuacion: pendiente.uriContinuacion,
      token_continuacion: pendiente.tokenContinuacion,
      url_permiso: pendiente.urlPermiso,
    })
    eventos.registrar({ tipo: 'programa', id: p.id, detalle: { texto: 'Se pidió renovar el permiso en el banco.', tope: aTexto(restante) } })
  })
  return { redirect: pendiente.redirect, programa: vistaPrograma(exigir(id)) }
}

async function callbackRenovacion(p: FilaPrograma, q: { hash?: string; interact_ref?: string; result?: string }): Promise<string> {
  const limpiar = (texto: string, resultado: string) =>
    transaccion(() => {
      repo.actualizar(p.id, TEMPORALES_EN_NULL)
      eventos.registrar({ tipo: 'programa', id: p.id, detalle: { texto, resultado } })
    })

  if (q.result === 'grant_rejected' || q.result === 'grant_invalid') {
    limpiar('La renovación del permiso fue rechazada en el banco.', q.result)
    return urlTablero(p.id, 'rechazada')
  }
  const coincide =
    q.hash && q.interact_ref && p.nonce_cliente && p.nonce_cierre && p.url_permiso
      ? verificarHash(q.hash, { nonceCliente: p.nonce_cliente, nonceCierre: p.nonce_cierre, interactRef: q.interact_ref, urlPermiso: p.url_permiso })
      : null
  if (!coincide) {
    eventos.registrar({ tipo: 'programa', id: p.id, detalle: { texto: 'Callback de renovación con hash inválido: se ignoró.', resultado: 'invalido' } })
    return urlTablero(p.id, 'invalida')
  }

  let permiso: op.TokenPermiso
  try {
    permiso = await op.continuarPermiso({ uriContinuacion: p.uri_continuacion!, tokenContinuacion: p.token_continuacion!, interactRef: q.interact_ref! })
  } catch (e) {
    if (!exigir(p.id).permiso_vencido_en) return urlTablero(p.id, 'aprobada') // otro callback ya la completó
    log.warn('grant.continue de la renovación falló', { error: e, programa: p.id })
    limpiar('El banco no confirmó la renovación del permiso.', 'invalido')
    return urlTablero(p.id, 'invalida')
  }

  // Lo que ya salió (o está saliendo) quedó en el permiso viejo: el tablero lo suma al nuevo
  const yaSalio = cobros.sumaComprometida(p.id)
  transaccion(() => {
    repo.actualizar(p.id, {
      ...TEMPORALES_EN_NULL,
      token_acceso: permiso.token,
      url_gestion: permiso.urlGestion,
      permiso_vencido_en: null,
      gastado_permisos_anteriores: yaSalio,
    })
    eventos.registrar({
      tipo: 'programa',
      id: p.id,
      detalle: { texto: 'Permiso renovado en el banco.', yaSalio: aTexto(yaSalio), expiresIn: permiso.expiraEnSeg ?? null },
    })
  })
  cacheGastado.delete(p.id)
  return urlTablero(p.id, 'aprobada')
}

// ---------------------------------------------------------------------------------------------
// HU-18 · pausar y reanudar
// ---------------------------------------------------------------------------------------------

export function pausar(id: string) {
  const p = exigir(id)
  exigirEstado(p, 'Activo')
  transicion(p, 'Pausado', {}, { texto: 'La entidad pausó el programa.' })
  return vistaPrograma(exigir(id))
}

export function reanudar(id: string) {
  const p = exigir(id)
  exigirEstado(p, 'Pausado')
  transicion(p, 'Activo', {}, { texto: 'La entidad reanudó el programa.' })
  return vistaPrograma(exigir(id))
}

// ---------------------------------------------------------------------------------------------
// HU-06 · el token del permiso: rotar ante un 401 y un solo reintento
// ---------------------------------------------------------------------------------------------

export class PermisoVencido extends Error {
  constructor() {
    super('El permiso venció: apruébalo de nuevo')
  }
}

const rotaciones = new Map<string, Promise<string>>()

async function rotar(programaId: string, tokenViejo: string): Promise<string> {
  const actual = exigir(programaId)
  // Otra petición ya lo rotó: se usa el nuevo
  if (actual.token_acceso && actual.token_acceso !== tokenViejo) return actual.token_acceso
  const enCurso = rotaciones.get(programaId)
  if (enCurso) return enCurso

  const promesa = (async () => {
    if (!actual.token_acceso || !actual.url_gestion || actual.permiso_vencido_en) throw new PermisoVencido()
    try {
      const nuevo = await op.rotarToken({ urlGestion: actual.url_gestion, token: actual.token_acceso })
      transaccion(() => {
        repo.actualizar(programaId, { token_acceso: nuevo.token, url_gestion: nuevo.urlGestion })
        eventos.registrar({
          tipo: 'programa',
          id: programaId,
          detalle: { texto: 'Se rotó el token del permiso.', expiresIn: nuevo.expiraEnSeg ?? null },
        })
      })
      return nuevo.token
    } catch (e) {
      log.warn('No se pudo rotar el token', { error: e, programa: programaId })
      // Sin respuesta (red, 5xx): no se sabe si el permiso murió; se reintenta en la próxima vuelta
      if (e instanceof ErrorOP && e.tipo === 'SinRespuesta') throw e
      marcarPermisoVencido(programaId)
      throw new PermisoVencido()
    }
  })()
  rotaciones.set(programaId, promesa)
  try {
    return await promesa
  } finally {
    rotaciones.delete(programaId)
  }
}

/** El banco ya no acepta el token ni su rotación: queda así hasta que la entidad lo renueve. */
function marcarPermisoVencido(programaId: string) {
  transaccion(() => {
    const p = exigir(programaId)
    if (p.permiso_vencido_en || (p.estado !== 'Activo' && p.estado !== 'Pausado')) return
    repo.actualizar(programaId, { permiso_vencido_en: ahoraIso() })
    eventos.registrar({
      tipo: 'programa',
      id: programaId,
      detalle: { texto: 'El permiso venció en el banco: hay que renovarlo para seguir pagando.', permisoVencido: true },
    })
  })
  cacheGastado.delete(programaId)
}

/** Rota el token del permiso ya, sin esperar a que falle (renovación en segundo plano, D-35). */
export async function rotarPermiso(programaId: string): Promise<string> {
  const p = exigir(programaId)
  if (!p.token_acceso || p.permiso_vencido_en) throw new PermisoVencido()
  return rotar(programaId, p.token_acceso)
}

/** Corre `fn` con el token del programa; ante TokenVencido, rota y reintenta una sola vez. */
export async function conToken<T>(programaId: string, fn: (token: string, p: FilaPrograma) => Promise<T>): Promise<T> {
  const p = exigir(programaId)
  if (!p.token_acceso || p.permiso_vencido_en) throw new PermisoVencido()
  try {
    return await fn(p.token_acceso, p)
  } catch (e) {
    if (!(e instanceof ErrorOP && e.tipo === 'TokenVencido')) throw e
    const token = await rotar(programaId, p.token_acceso)
    try {
      return await fn(token, exigir(programaId))
    } catch (e2) {
      if (e2 instanceof ErrorOP && e2.tipo === 'TokenVencido') {
        marcarPermisoVencido(programaId)
        throw new PermisoVencido()
      }
      throw e2
    }
  }
}

// ---------------------------------------------------------------------------------------------
// O7 · tablero y O8 · cierre (Plan backend § 8.8)
// ---------------------------------------------------------------------------------------------

/** «banco»: leído del permiso (getGrantSpentAmounts); «plataforma»: suma de lo Pagado en la BD. */
type Fuente = 'banco' | 'plataforma'

const cacheGastado = new Map<string, { valor: number; vence: number }>()

/**
 * Cobrado = spentDebitAmount del permiso (más lo que salió con permisos anteriores, si se renovó);
 * si falla, lo Pagado en la BD con fuente «plataforma».
 */
async function cobrado(p: FilaPrograma): Promise<{ valor: number; fuente: Fuente }> {
  if (p.estado === 'Cerrado') {
    const d = datosDelCierre(p.id)
    if (d) return { valor: deTexto(d.cobrado), fuente: d.fuente }
  }
  if ((p.estado === 'Activo' || p.estado === 'Pausado') && p.token_acceso && !p.permiso_vencido_en) {
    const guardado = cacheGastado.get(p.id)
    if (guardado && guardado.vence > Date.now()) return { valor: guardado.valor, fuente: 'banco' }
    try {
      const gastado = await conToken(p.id, (token, actual) =>
        op.gastadoDelPermiso({ billeteraPrograma: actual.billetera_programa, token }),
      )
      const valor = exigir(p.id).gastado_permisos_anteriores + (gastado === null ? 0 : deTexto(gastado))
      cacheGastado.set(p.id, { valor, vence: Date.now() + 3000 })
      return { valor, fuente: 'banco' }
    } catch (e) {
      log.warn('No se pudo leer el gastado del permiso', { error: e, programa: p.id })
    }
  }
  return { valor: cobros.sumaPagada(p.id), fuente: 'plataforma' }
}

/** D-18: las cifras que se guardaron en el evento de cierre, antes de revocar. */
function datosDelCierre(programaId: string) {
  const e = eventos.ultimoHacia('programa', programaId, 'Cerrado')
  if (!e) return null
  const d = eventos.detalleDe(e)
  if (typeof d.cobrado !== 'string') return null
  return {
    autorizado: String(d.autorizado),
    cobrado: d.cobrado,
    nuncaSalio: String(d.nuncaSalio),
    cerradoEn: e.creado_en,
    fuente: (d.fuente === 'plataforma' ? 'plataforma' : 'banco') as Fuente,
  }
}

function segundosEntre(a?: string, b?: string): number | null {
  if (!a || !b) return null
  return (Date.parse(b) - Date.parse(a)) / 1000
}

const sumar = (lista: { monto: number | null }[]) => lista.reduce((t, c) => t + (c.monto ?? 0), 0)

export async function tablero(id: string) {
  const p = await aplicarVencimiento(exigir(id))
  const lista = cobros.dePrograma(p.id)
  const pagados = lista.filter((c) => c.estado === 'Pagado')
  const { valor, fuente } = await cobrado(p)
  const autorizado = p.tope_total ?? 0

  // Reembolso al punto: t(Pagado) − t(PorConfirmar → Pagando), en los retiros
  const tiempos = pagados
    .filter((c) => c.canal === 'retiro')
    .map((c) =>
      segundosEntre(eventos.ultimoHacia('cobro', c.id, 'Pagando')?.creado_en, eventos.ultimoHacia('cobro', c.id, 'Pagado')?.creado_en),
    )
    .filter((t): t is number => t !== null)
  const reembolsoSegundos = tiempos.length ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10 : null

  // Sin cobrar todavía: las cédulas de la liquidación menos los cobros pagados
  let sinCobrar: { cedulas: number; monto: string } | null = null
  try {
    const r = await liquidacion.resumen(p.id)
    sinCobrar = {
      cedulas: Math.max(0, r.cedulas - pagados.length),
      monto: aTexto(Math.max(0, deTexto(r.total) - sumar(pagados))),
    }
  } catch {
    sinCobrar = null
  }

  const porCanal = (canal: 'cuenta' | 'retiro' | 'compra') => {
    const deCanal = pagados.filter((c) => c.canal === canal)
    return { cobros: deCanal.length, monto: aTexto(sumar(deCanal)) }
  }
  const cierre = p.estado === 'Cerrado' ? datosDelCierre(p.id) : null

  return {
    programa: vistaPrograma(p),
    moneda: moneda(p),
    autorizado: aTexto(autorizado),
    cobrado: aTexto(valor),
    fuente,
    noHaSalido: aTexto(Math.max(0, autorizado - valor)),
    cobrosPagados: pagados.length,
    porCanal: { cuenta: porCanal('cuenta'), retiro: porCanal('retiro'), compra: porCanal('compra') },
    reembolsoSegundos,
    // El modelo no gira nada antes del cobro: cada pago sale cuando la persona cobra
    giradoPorAdelantado: '0',
    sinCobrar,
    cobrosPagando: lista.filter((c) => c.estado === 'Pagando').length,
    rechazadosYFallidos: lista.filter((c) => c.estado === 'Rechazado' || c.estado === 'Fallido').length,
    cobros: lista.map((c) => vistaCobro(c, { eventos: false })),
    cierre: cierre && { autorizado: cierre.autorizado, cobrado: cierre.cobrado, nuncaSalio: cierre.nuncaSalio, cerradoEn: cierre.cerradoEn },
    actualizado: ahoraIso(),
  }
}

export async function cerrar(id: string, confirmacion: string) {
  if (confirmacion !== 'CERRAR') throw new ErrorApi(400, 'ConfirmacionRequerida', 'Escribe CERRAR para confirmar')
  const p = exigir(id)
  exigirEstado(p, 'Activo', 'Pausado')
  if (cobros.cuantosEnEstado(p.id, 'Pagando') > 0) {
    throw conflicto('CobrosEnCurso', 'Hay cobros enviándose; espera a que terminen para cerrar')
  }

  // D-18: antes de revocar se lee el gastado y se guarda en el evento de cierre
  const { valor, fuente } = await cobrado(p)
  try {
    await conToken(p.id, (token, actual) => op.revocarPermiso({ urlGestion: actual.url_gestion!, token }))
  } catch (e) {
    // Si el token ya no sirve ni rotándolo, el permiso está muerto de todos modos.
    if (!(e instanceof PermisoVencido)) throw errorOpApi(e, 'El banco no confirmó la revocación del permiso')
    log.warn('El token ya no servía al cerrar; se cierra igual', { programa: id })
  }

  const actual = exigir(id)
  const autorizado = actual.tope_total ?? 0
  transicion(
    actual,
    'Cerrado',
    { token_acceso: null, url_gestion: null, ...TEMPORALES_EN_NULL },
    {
      texto: 'Programa cerrado: se revocó el permiso.',
      autorizado: aTexto(autorizado),
      cobrado: aTexto(valor),
      nuncaSalio: aTexto(Math.max(0, autorizado - valor)),
      fuente,
    },
  )
  cacheGastado.delete(id)
  return tablero(id)
}

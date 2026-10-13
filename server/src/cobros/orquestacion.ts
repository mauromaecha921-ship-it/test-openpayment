/**
 * Orquestación del cobro (P-20, Plan backend § 8.2 a § 8.6):
 * liquidación → transición → pagar → guardar. Las rutas solo reciben y validan.
 */
import { waitUntil } from '@vercel/functions'
import { config } from '../config.js'
import { conflicto, ErrorApi, noEncontrado } from '../comun/errores.js'
import { enmascararDocumento, log } from '../comun/log.js'
import { deTexto } from '../comun/montos.js'
import { moneda, vistaCobroDe, type VistaCobro } from '../comun/vistas.js'
import { esRestriccion, mensajeDeTrigger, puntoDeGuardado, transaccion } from '../db/conexion.js'
import * as beneficiarios from '../db/repositorios/beneficiarios.js'
import * as bloqueos from '../db/repositorios/bloqueos.js'
import * as repo from '../db/repositorios/cobros.js'
import type { FilaCobro } from '../db/repositorios/cobros.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import { actorBeneficiario, actorPunto, type Actor } from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import type { FilaPrograma } from '../db/repositorios/programas.js'
import * as puntos from '../db/repositorios/puntos.js'
import type { FilaPunto } from '../db/repositorios/puntos.js'
import type { Pago } from '../liquidacion/contrato.js'
import * as liquidacion from '../liquidacion/cliente.js'
import { LiquidacionNoResponde } from '../liquidacion/cliente.js'
import * as op from '../openPaymentsService.js'
import { ErrorOP } from '../openPaymentsService.js'
import { conToken, PermisoVencido } from '../programas/servicio.js'
import { despuesDeSolicitado, exigirTransicion, type Canal, type EstadoCobro } from './estados.js'
import { MOTIVOS, mensajePinIncorrecto, type Motivo } from './mensajes.js'
import * as reglas from './reglas.js'

// ---------------------------------------------------------------------------------------------
// Textos de la línea de tiempo (wireframe 05)
// ---------------------------------------------------------------------------------------------

function textoEvento(c: Pick<FilaCobro, 'canal'>, hacia: EstadoCobro, punto?: FilaPunto, motivo?: Motivo): string {
  if (motivo) return MOTIVOS[motivo].mensaje
  const enCuenta = c.canal === 'cuenta'
  if (c.canal === 'compra') {
    // § 11: una compra con bono en un comercio
    if (hacia === 'Solicitado') return `${punto?.nombre ?? 'El comercio'} registró una compra con bono.`
    if (hacia === 'Pagando') return 'PIN correcto. Pagando el bono al comercio.'
    if (hacia === 'Pagado') return 'Pago recibido. El bono quedó aplicado a la compra.'
  }
  switch (hacia) {
    case 'Solicitado':
      return enCuenta ? 'Solicitaste el cobro a tu cuenta.' : `${punto?.nombre ?? 'El punto'} digitó la cédula.`
    case 'PorConfirmar':
      return 'Esperando el PIN de la persona.'
    case 'Pagando':
      return enCuenta ? 'Enviando el pago a tu cuenta.' : 'PIN correcto. Enviando el pago al punto.'
    case 'Pagado':
      return enCuenta ? 'El pago llegó a tu cuenta.' : 'Pago recibido. Ya se puede entregar el efectivo.'
    default:
      return hacia
  }
}

/** Quién mueve el cobro: el punto (o comercio) que digitó la cédula, o la persona en el canal cuenta. */
function actorDe(c: Pick<FilaCobro, 'canal' | 'punto_id' | 'beneficiario_id'>): Actor {
  return c.punto_id ? actorPunto(c.punto_id) : actorBeneficiario(c.beneficiario_id)
}

/**
 * Cambia el estado del cobro con bloqueo optimista y escribe su evento, en una transacción.
 * Devuelve false si otra petición lo cambió antes (no se hace nada).
 */
async function mover(
  c: FilaCobro,
  hacia: EstadoCobro,
  extra: Partial<Omit<FilaCobro, 'id' | 'version' | 'creado_en' | 'actualizado_en'>> = {},
  detalle: Record<string, unknown> = {},
  actor: Actor = 'sistema',
): Promise<boolean> {
  exigirTransicion(c.estado, hacia)
  const motivo = (extra.motivo_rechazo ?? undefined) as Motivo | undefined
  const punto = c.punto_id ? await puntos.obtener(c.punto_id) : undefined
  return transaccion(async () => {
    if (!(await repo.actualizar(c.id, c.version, { ...extra, estado: hacia }))) return false
    await eventos.registrar({
      tipo: 'cobro',
      id: c.id,
      desde: c.estado,
      hacia,
      detalle: { texto: textoEvento(c, hacia, punto, motivo), ...(motivo ? { motivo } : {}), ...detalle },
      actor,
    })
    return true
  })
}

async function exigir(id: string): Promise<FilaCobro> {
  const c = await repo.obtener(id)
  if (!c) throw noEncontrado('Ese cobro no existe')
  return c
}

/**
 * Las reglas del cobro que también hace cumplir la base (trigger `fn_cobro_reglas` de db/003 y
 * 010_piloto.sql). La API las revisa antes, pero si algo cambió en ese instante (por ejemplo, el
 * programa se pausó), el error de la base se traduce al mismo motivo.
 */
function motivoDeLaBase(e: unknown): Motivo | null {
  const m = mensajeDeTrigger(e)
  if (!m) return null
  if (m.startsWith('RN-06')) return m.includes('Cerrado') ? 'ProgramaCerrado' : 'ProgramaNoRecibe'
  if (m.startsWith('RN-03: un bono')) return 'SoloEnComercios'
  if (m.startsWith('RN-03: este comercio')) return 'ComercioNoAutorizado'
  if (m.startsWith('RN-03')) return 'ProgramaNoRecibe'
  if (m.startsWith('RN-04')) return 'CuentaNoVerificada'
  if (m.startsWith('RN-07')) return 'PinBloqueado'
  return null
}

// ---------------------------------------------------------------------------------------------
// Pagos en curso: un solo pagar() por cobro a la vez
// ---------------------------------------------------------------------------------------------

const enCurso = new Map<string, Promise<void>>()

function disparar(id: string) {
  if (enCurso.has(id)) return
  const promesa = pagar(id)
    .catch((e) => log.error('pagar() falló sin control', { error: e, cobro: id }))
    .finally(() => enCurso.delete(id))
  enCurso.set(id, promesa)
  // En Vercel la función se congela al responder: waitUntil la mantiene viva hasta que el pago
  // termine. Fuera de Vercel no hace nada (la promesa sigue igual en el proceso).
  waitUntil(promesa)
}

/** Para pruebas y para el cierre ordenado: espera los pagos que estén en curso. */
export async function esperarPagos() {
  while (enCurso.size) await Promise.all([...enCurso.values()])
}

// ---------------------------------------------------------------------------------------------
// § 8.2 · Solicitar un cobro
// ---------------------------------------------------------------------------------------------

export interface EntradaCobro {
  programaId?: string
  documento: string
  canal: Canal
  puntoId?: string
  llaveIdempotencia: string
  totalCompra?: string
}

type PagoConsultado = Pago | 'falla'

async function consultarPago(programaId: string, documento: string): Promise<PagoConsultado> {
  try {
    return await liquidacion.pago(programaId, documento)
  } catch (e) {
    if (e instanceof LiquidacionNoResponde) return 'falla'
    throw e
  }
}

const PRIORIDAD: Record<string, number> = { Activo: 0, Pausado: 1, Cerrado: 2 }

/**
 * D-21: el punto no elige programa. Entre los subsidios activos se toma el que tenga un pago
 * disponible para esa cédula; si ninguno, el más relevante (activo, pausado o cerrado) para
 * que el rechazo quede en su tablero.
 */
export async function resolverPrograma(documento: string, canal?: Canal): Promise<{ programa: FilaPrograma; pago?: PagoConsultado }> {
  const todos = (await programas.listar())
    .filter((p) => p.estado in PRIORIDAD)
    .sort((a, b) => PRIORIDAD[a.estado]! - PRIORIDAD[b.estado]!)
  // § 11: en un comercio se buscan primero los bonos; en un punto de retiro, los subsidios. Así el
  // rechazo habla del programa que corresponde («Este comercio no acepta este bono»).
  const destino = canal === 'compra' ? 'restringido' : canal === 'retiro' ? 'libre' : undefined
  const delCanal = destino ? todos.filter((p) => p.destino === destino) : todos
  const candidatos = delCanal.length ? delCanal : todos
  if (!candidatos.length) throw conflicto('SinProgramas', 'No hay programas recibiendo cobros')
  const ahora = new Date()
  for (const p of candidatos) {
    const recibe = !reglas.rn06ProgramaRecibe({ estado: p.estado, vigenciaInicio: p.vigencia_inicio, vigenciaFin: p.vigencia_fin, ahora })
    if (!recibe) continue
    const pago = await consultarPago(p.id, documento)
    if (pago === 'falla' || pago.disponible) return { programa: p, pago }
  }
  return { programa: candidatos[0]! }
}

export async function solicitar(e: EntradaCobro): Promise<VistaCobro> {
  const previo = await repo.porLlave(e.llaveIdempotencia)
  if (previo) return vistaCobroDe(previo) // HU-10: doble clic

  // Canal y punto (la BD también lo exige con canal_y_punto y con el tipo del punto)
  let punto: FilaPunto | undefined
  if (e.canal === 'cuenta') {
    if (e.puntoId) throw new ErrorApi(400, 'EntradaInvalida', 'El cobro a la cuenta no lleva punto')
  } else {
    if (!e.puntoId) throw new ErrorApi(400, 'EntradaInvalida', 'El cobro en un punto necesita puntoId')
    punto = await puntos.obtener(e.puntoId)
    if (!punto) throw noEncontrado('Ese punto no existe')
    // db/003: un punto de retiro no hace compras ni una sede de comercio hace retiros
    if (punto.tipo !== e.canal) {
      throw new ErrorApi(400, 'PuntoNoAtiendeCanal', punto.tipo === 'retiro' ? 'Ese punto hace retiros, no compras con bono' : 'Esa sede acepta bonos, no hace retiros')
    }
  }
  if ((e.canal === 'compra') !== (e.totalCompra !== undefined)) {
    throw new ErrorApi(400, 'EntradaInvalida', 'totalCompra va solo en el canal compra')
  }

  // Programa: el indicado o el que resuelva D-21
  let programa: FilaPrograma
  let pago: PagoConsultado | undefined
  if (e.programaId) {
    const p = await programas.obtener(e.programaId)
    if (!p) throw noEncontrado('Ese programa no existe')
    programa = p
  } else {
    ;({ programa, pago } = await resolverPrograma(e.documento, e.canal))
  }

  // La persona: una cédula que no existe no deja cobro, solo un evento con la cédula enmascarada
  const persona = await beneficiarios.porDocumento(e.documento)
  if (!persona) {
    await eventos.registrar({
      tipo: 'programa',
      id: programa.id,
      detalle: { texto: 'Se intentó cobrar con una cédula que no está registrada.', documento: enmascararDocumento(e.documento) },
      actor: punto ? actorPunto(punto.id) : 'sistema',
    })
    throw new ErrorApi(404, 'SinPagoDisponible', MOTIVOS.SinPagoDisponible.mensaje)
  }
  // Registro del equipo: sin PIN no hay cómo confirmar en el punto (Plan de ajustes § 2). El PIN
  // lo tiene el gobierno: se le pregunta si existe, nunca cuál es.
  if (e.canal === 'retiro' && !(await liquidacion.persona(e.documento))?.tienePin) {
    throw new ErrorApi(422, 'SinPin', 'Esta persona no registró un PIN: solo puede cobrar a su cuenta')
  }

  const ahora = new Date()
  let motivo: reglas.Resultado = null
  let cuenta: cuentas.FilaCuenta | undefined
  let monto: number | null = null

  // RN-06 · Activo y en vigencia
  motivo = reglas.rn06ProgramaRecibe({
    estado: programa.estado,
    vigenciaInicio: programa.vigencia_inicio,
    vigenciaFin: programa.vigencia_fin,
    ahora,
  })
  // RN-03 · canal permitido por el destino
  motivo ??= reglas.rn03CanalPermitido({
    destino: programa.destino,
    canal: e.canal,
    puntoAutorizado: punto ? await puntos.autorizadoEnPrograma(programa.id, punto.id) : false,
  })
  // RN-07 · bloqueo por PIN en este programa (tabla bloqueo_pin de db/003; antes D-17)
  if (!motivo) {
    const bloqueo = await bloqueos.vigente(programa.id, persona.id)
    if (reglas.rn07Bloqueada({ bloqueadoHasta: bloqueo?.bloqueado_hasta ?? null, ahora })) motivo = 'PinBloqueado'
  }
  // RN-02 · aviso temprano, antes de ir a la red (la BD lo arbitra igual con el índice)
  motivo ??= reglas.rn02CobroExistente((await repo.vivoDe(programa.id, persona.id))?.estado ?? null)
  // RN-01 · la liquidación
  if (!motivo) {
    pago ??= await consultarPago(programa.id, e.documento)
    if (pago === 'falla') motivo = 'LiquidacionNoResponde'
    else motivo = reglas.rn01PagoDisponible(pago)
  }
  // RN-04 · cuenta Verificada y en la misma moneda
  if (!motivo && e.canal === 'cuenta') {
    cuenta = await cuentas.vigenteDe(persona.id)
    let monedaCuenta: { codigo: string; escala: number } | null = null
    if (cuenta?.estado === 'Verificada') {
      try {
        const w = await op.leerWallet(cuenta.billetera)
        monedaCuenta = { codigo: w.codigoMoneda, escala: w.escala }
      } catch {
        throw new ErrorApi(503, 'SinRespuesta', 'No pudimos revisar tu cuenta; intenta en un momento')
      }
    }
    motivo = reglas.rn04CuentaLista({ cuenta: cuenta ?? null, monedaCuenta, monedaPrograma: moneda(programa) })
  }
  // RN-05 · el monto lo calcula el backend
  if (pago && pago !== 'falla' && pago.disponible) {
    monto = reglas.rn05Monto({
      tipo: programa.tipo,
      valorDisponible: deTexto(pago.monto),
      totalCompra: e.totalCompra ? deTexto(e.totalCompra) : undefined,
    })
  }

  // La novedad (retroactivo) se anota en el primer evento para que el tablero la muestre
  const novedad = pago && pago !== 'falla' && pago.disponible && pago.novedad ? { novedad: true } : {}
  const actor = punto ? actorPunto(punto.id) : actorBeneficiario(persona.id)

  const base = {
    programa_id: programa.id,
    beneficiario_id: persona.id,
    canal: e.canal,
    punto_id: punto?.id ?? null,
    cuenta_id: e.canal === 'cuenta' ? (cuenta?.id ?? null) : null,
    total_compra: e.totalCompra ? deTexto(e.totalCompra) : null,
    llave_idempotencia: e.llaveIdempotencia,
  }

  const crearRechazado = async (m: Motivo): Promise<FilaCobro | null> => {
    // Un rechazo del canal cuenta se guarda con la última cuenta conocida; si la persona nunca
    // tuvo una, se responde 409 sin dejar cobro (D-25: db/003 ya lo permitiría, pero así la web
    // no cambia en esta etapa).
    const cuentaId = base.canal === 'cuenta' ? (base.cuenta_id ?? (await cuentas.ultimaDe(persona.id))?.id ?? null) : null
    if (base.canal === 'cuenta' && !cuentaId) return null
    const c = await repo.crear({ ...base, cuenta_id: cuentaId, monto, estado: 'Rechazado', motivo_rechazo: m })
    await eventos.registrar({ tipo: 'cobro', id: c.id, hacia: 'Rechazado', detalle: { texto: MOTIVOS[m].mensaje, motivo: m, ...novedad }, actor })
    return c
  }

  let creado: FilaCobro | null
  try {
    creado = await transaccion(async () => {
      if (motivo) return crearRechazado(motivo)
      // Solicitado y su evento, y luego PorConfirmar o Pagando, en la misma transacción
      let c: FilaCobro
      try {
        // Punto de guardado: si el índice o el trigger rechazan el INSERT, la transacción sigue viva
        c = await puntoDeGuardado(() => repo.crear({ ...base, monto, estado: 'Solicitado' }))
      } catch (err) {
        if (!esRestriccion(err)) throw err
        const otro = await repo.porLlave(e.llaveIdempotencia)
        if (otro) return otro
        const deLaBase = motivoDeLaBase(err)
        if (deLaBase) return crearRechazado(deLaBase)
        // RN-02 lo decidió el índice único parcial: llegaron dos a la vez
        const vivo = await repo.vivoDe(programa.id, persona.id)
        if (!vivo) throw err
        return crearRechazado(reglas.rn02CobroExistente(vivo.estado)!)
      }
      await eventos.registrar({ tipo: 'cobro', id: c.id, hacia: 'Solicitado', detalle: { texto: textoEvento(c, 'Solicitado', punto), ...novedad }, actor })
      const hacia = despuesDeSolicitado(c.canal)
      await repo.actualizar(c.id, c.version, { estado: hacia })
      await eventos.registrar({ tipo: 'cobro', id: c.id, desde: 'Solicitado', hacia, detalle: { texto: textoEvento(c, hacia, punto) }, actor })
      return (await repo.obtener(c.id))!
    })
  } catch (err) {
    const otro = await repo.porLlave(e.llaveIdempotencia)
    if (otro) return vistaCobroDe(otro)
    throw err
  }

  if (!creado) {
    // Canal cuenta sin ninguna cuenta: se responde sin dejar cobro (ver crearRechazado)
    throw new ErrorApi(409, 'CuentaNoVerificada', MOTIVOS.CuentaNoVerificada.mensaje)
  }
  // P-09: en el canal cuenta se paga sin esperar
  if (creado.estado === 'Pagando') disparar(creado.id)
  return vistaCobroDe(creado)
}

// ---------------------------------------------------------------------------------------------
// § 8.3 · Confirmar con PIN
// ---------------------------------------------------------------------------------------------

/** RN-12: un PorConfirmar vencido pasa a Rechazado. Devuelve el cobro actualizado. */
async function aplicarVencimiento(c: FilaCobro): Promise<FilaCobro> {
  if (reglas.rn12Vencio({ estado: c.estado, desde: c.creado_en, ahora: new Date(), ttlSeg: config().CONFIRMACION_TTL_SEG })) {
    await mover(c, 'Rechazado', { motivo_rechazo: 'TiempoAgotado' })
    return exigir(c.id)
  }
  return c
}

export async function confirmar(id: string, pin: string): Promise<{ status: number; cobro: VistaCobro }> {
  let c = await aplicarVencimiento(await exigir(id))
  if (c.estado === 'Pagando' || c.estado === 'Pagado') return { status: 200, cobro: await vistaCobroDe(c) }
  if (c.estado !== 'PorConfirmar') {
    if (c.estado === 'Rechazado' || c.estado === 'Fallido') return { status: 200, cobro: await vistaCobroDe(c) }
    throw conflicto('EstadoNoPermite', 'Este cobro no está esperando el PIN')
  }

  const persona = (await beneficiarios.obtener(c.beneficiario_id))!
  const valido = await liquidacion.validarPin(persona.numero_documento, pin)

  // Mientras se validaba, otra petición pudo cambiarlo
  c = await exigir(id)
  if (c.estado !== 'PorConfirmar') return { status: 200, cobro: await vistaCobroDe(c) }

  const cfg = config()
  const r = reglas.rn07EvaluarPin({ valido, intentosPrevios: c.intentos_pin, maxIntentos: cfg.PIN_MAX_INTENTOS })
  if (r.resultado === 'incorrecto') {
    if (!(await repo.actualizar(c.id, c.version, { intentos_pin: r.intentos }))) {
      throw conflicto('VersionCambio', 'El cobro cambió; vuelve a intentarlo')
    }
    throw new ErrorApi(422, 'PinIncorrecto', mensajePinIncorrecto(r.restantes))
  }
  if (r.resultado === 'bloqueado') {
    // RN-07: el cobro se rechaza y la persona queda bloqueada en este programa (bloqueo_pin)
    const hasta = new Date(Date.now() + cfg.PIN_BLOQUEO_MIN * 60_000).toISOString()
    await transaccion(async () => {
      if (await mover(c, 'Rechazado', { motivo_rechazo: 'PinBloqueado', intentos_pin: r.intentos }, {}, actorBeneficiario(c.beneficiario_id))) {
        await bloqueos.bloquear({ programaId: c.programa_id, beneficiarioId: c.beneficiario_id, cobroId: c.id, hasta })
      }
    })
    return { status: 200, cobro: await vistaCobroDe(await exigir(id)) }
  }

  // Punto de no retorno (HU-12). Si la versión ya cambió, no se paga dos veces.
  if (await mover(c, 'Pagando', {}, {}, actorBeneficiario(c.beneficiario_id))) disparar(c.id)
  return { status: 202, cobro: await vistaCobroDe(await exigir(id)) }
}

/** «Cancelar cobro» (D-09): PorConfirmar → Rechazado con Cancelado. */
export async function cancelar(id: string): Promise<VistaCobro> {
  const c = await aplicarVencimiento(await exigir(id))
  if (c.estado !== 'PorConfirmar') throw conflicto('EstadoNoPermite', 'Solo se cancela un cobro que espera el PIN')
  if (!(await mover(c, 'Rechazado', { motivo_rechazo: 'Cancelado' }, {}, actorDe(c)))) throw conflicto('VersionCambio', 'El cobro cambió; recarga')
  return vistaCobroDe(await exigir(id))
}

// ---------------------------------------------------------------------------------------------
// § 8.4 · Pagar
// ---------------------------------------------------------------------------------------------

async function destinoDe(c: FilaCobro): Promise<string> {
  if (c.canal === 'cuenta') return (await cuentas.obtener(c.cuenta_id!))!.billetera
  return (await puntos.obtener(c.punto_id!))!.billetera
}

async function guardar(id: string, campos: Partial<Pick<FilaCobro, 'url_pago_entrante' | 'url_pago_saliente'>>): Promise<FilaCobro> {
  const c = await exigir(id)
  if (!(await repo.actualizar(c.id, c.version, campos))) throw new Error('El cobro cambió mientras se guardaba la URL del pago')
  return exigir(id)
}

async function nota(id: string, texto: string, detalle: Record<string, unknown> = {}) {
  await eventos.registrar({ tipo: 'cobro', id, detalle: { texto, ...detalle } })
}

/** Aplica el resultado de RN-10 si es final. */
async function cerrarSegun(c: FilaCobro, resultado: 'Pagado' | 'Fallido' | 'Pagando') {
  if (resultado === 'Pagado') await mover(c, 'Pagado', {}, {}, 'banco')
  else if (resultado === 'Fallido') await mover(c, 'Fallido', { motivo_rechazo: 'ErrorPago' }, {}, 'banco')
}

async function pagar(id: string) {
  let c = await exigir(id)
  if (c.estado !== 'Pagando') return
  const programa = (await programas.obtener(c.programa_id))!
  const m = moneda(programa)
  try {
    // 1-2: el pago entrante se guarda ANTES de crear el saliente; es lo que permite recuperar (§ 8.6)
    if (!c.url_pago_entrante) {
      const entrante = await op.crearPagoEntrante({
        billetera: await destinoDe(c),
        monto: c.monto!,
        moneda: m,
        referencia: c.referencia,
        descripcion: `${programa.nombre} · ${c.referencia}`,
      })
      c = await guardar(id, { url_pago_entrante: entrante.id })
    }
    // 3: el saliente con la forma B (AD-10)
    if (!c.url_pago_saliente) {
      const saliente = await conToken(programa.id, (token) =>
        op.crearPagoSaliente({
          billeteraPrograma: programa.billetera_programa,
          token,
          urlPagoEntrante: c.url_pago_entrante!,
          monto: c.monto!,
          moneda: m,
          referencia: c.referencia,
        }),
      )
      c = await guardar(id, { url_pago_saliente: saliente.id })
      await cerrarSegun(c, reglas.rn10Resultado({ saliente }))
    }
  } catch (e) {
    await manejarErrorPago(id, e)
  }
}

/** La tabla del § 6: qué le pasa al cobro con cada error. */
async function manejarErrorPago(id: string, e: unknown) {
  const c = await exigir(id)
  if (c.estado !== 'Pagando') return
  if (e instanceof PermisoVencido) {
    await mover(c, 'Fallido', { motivo_rechazo: 'PermisoVencido' }, {}, 'banco')
    return
  }
  if (e instanceof ErrorOP) {
    const detalle = { status: e.status ?? null, code: e.code ?? null }
    switch (e.tipo) {
      case 'TopeSuperado': // RN-09: lo rechazó el banco, sin mover dinero
        await mover(c, 'Fallido', { motivo_rechazo: 'TopeSuperado' }, { error: e.code ?? 'InsufficientGrant', status: e.status ?? null }, 'banco')
        return
      case 'SinRespuesta': // Nunca Fallido por un timeout (db/README.md § Pendientes, 1)
        await nota(id, 'El banco no respondió a tiempo. Se reconcilia al consultar.', detalle)
        return
      default: // Respuesta definitiva (4xx o sin configurar): no se creó el pago
        await mover(c, 'Fallido', { motivo_rechazo: 'ErrorPago' }, { ...detalle, tipo: e.tipo }, 'banco')
        return
    }
  }
  log.error('Error inesperado al pagar', { error: e, cobro: id })
  await nota(id, 'Error inesperado al pagar. Se reconcilia al consultar.')
}

// ---------------------------------------------------------------------------------------------
// § 8.5 · Consultar y reconciliar (RN-10)
// ---------------------------------------------------------------------------------------------

const ultimaConsulta = new Map<string, number>()

async function reconciliar(c: FilaCobro) {
  if (enCurso.has(c.id)) return
  // Como máximo una consulta a Open Payments por segundo y por cobro
  const antes = ultimaConsulta.get(c.id) ?? 0
  if (Date.now() - antes < 1000) return
  ultimaConsulta.set(c.id, Date.now())

  // Sin pago entrante no se movió dinero: se puede volver a pagar
  if (!c.url_pago_entrante) {
    disparar(c.id)
    return
  }
  try {
    if (c.url_pago_saliente) {
      const saliente = await conToken(c.programa_id, (token) => op.leerPagoSaliente({ url: c.url_pago_saliente!, token }))
      let resultado = reglas.rn10Resultado({ saliente })
      if (resultado === 'Pagando') {
        const entrante = await op.leerPagoEntrante({ url: c.url_pago_entrante, billetera: await destinoDe(c) })
        resultado = reglas.rn10Resultado({ saliente, entrante })
      }
      await cerrarSegun(await exigir(c.id), resultado)
      return
    }
    // Solo el entrante: la BD exige url_pago_saliente para Pagado (D-23), así que se deja en
    // Pagando con un evento «requiere conciliación» (una vez) si el entrante ya se completó.
    const entrante = await op.leerPagoEntrante({ url: c.url_pago_entrante, billetera: await destinoDe(c) })
    if (entrante.completado) await requiereConciliacion(c.id)
  } catch (e) {
    log.warn('No se pudo reconciliar el cobro', { error: e, cobro: c.id })
  }
}

async function requiereConciliacion(id: string) {
  const ya = (await eventos.deEntidad('cobro', id)).some((e) => eventos.detalleDe(e).conciliacion === true)
  if (!ya) await nota(id, 'Requiere conciliación: el pago entrante existe pero no quedó guardado el saliente.', { conciliacion: true })
}

export async function consultar(id: string): Promise<VistaCobro> {
  let c = await aplicarVencimiento(await exigir(id))
  if (c.estado === 'Pagando') {
    await reconciliar(c)
    c = await exigir(id)
  }
  return vistaCobroDe(c)
}

// ---------------------------------------------------------------------------------------------
// § 8.6 · Recuperar al arrancar (RNF-05, P-08): una sola pasada, no es un worker
// ---------------------------------------------------------------------------------------------

export async function recuperarAlArrancar() {
  const pendientes = await repo.enEstado('Pagando')
  for (const c of pendientes) {
    try {
      if (c.url_pago_saliente) await reconciliar(c)
      else if (c.url_pago_entrante) {
        const entrante = await op.leerPagoEntrante({ url: c.url_pago_entrante, billetera: await destinoDe(c) })
        log.info('Cobro con solo pago entrante', { cobro: c.id, completado: entrante.completado })
        await requiereConciliacion(c.id)
      } else disparar(c.id) // nada guardado: no se movió dinero
    } catch (e) {
      log.warn('No se pudo recuperar el cobro', { error: e, cobro: c.id })
    }
  }
  await esperarPagos()
  return pendientes.length
}

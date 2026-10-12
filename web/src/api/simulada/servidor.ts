// API simulada en el navegador (modo `npm run dev:simulada -w web`). Responde con el contrato del
// Plan backend § 7 para ver y recorrer las pantallas mientras api/ no está lista. Imita las reglas
// principales (RN-01 a RN-07, RN-12, el tope del banco) de forma simplificada: no es la fuente de
// verdad del negocio, solo un doble de pruebas. Nunca se usa con dinero ni con Open Payments.

import type { RespuestaCruda } from '@/api/client'
import type {
  Billetera,
  Canal,
  Cobro,
  CajaPunto,
  CobroResumen,
  Cuenta,
  EstadoCobro,
  EstadoSistema,
  EventoCobro,
  Moneda,
  Motivo,
  PagoPendiente,
  PagosEnPunto,
  PeriodoCaja,
  PersonaRegistrada,
  Programa,
  Punto,
  ResumenBeneficiario,
  Tablero,
} from '@/api/tipos'
import { formatMontoDe, sumarMontos } from '@/lib/montos'
import { billeteraCorta } from '@/lib/textos'

import { CONFIG, COP, HOST_TEST_WALLET, MONTO_BASE, PERSONAS, PUNTO_INICIAL, WALLET_ANA, WALLET_PROGRAMA, type PersonaLiquidacion } from './datos'

// ── Estado guardado ───────────────────────────────────────────────────────────

interface ProgramaS extends Programa {
  creado: string
  /** Cuándo se fijó el tope (RN-08): quien se registra después es novedad. */
  corte: string | null
  pendienteDesde: string | null
  cierre: Tablero['cierre']
}

interface PuntoS extends Omit<Punto, 'moneda'> {
  moneda: Moneda
  programaId: string | null
}

interface CuentaS extends Cuenta {
  creado: string
}

interface CobroS extends Omit<Cobro, 'monto'> {
  monto: string
  documento: string
  llave: string
  pagandoDesde: number | null
  resuelveEn: number | null
  resultado: { estado: 'Pagado' | 'Fallido'; motivo: Motivo | null } | null
}

interface Estado {
  version: 3
  secuencia: number
  personas: PersonaLiquidacion[]
  programas: ProgramaS[]
  puntos: PuntoS[]
  cuentas: CuentaS[]
  cobros: CobroS[]
}

const CLAVE = 'tatu.simulada'

function estadoInicial(): Estado {
  const ahora = new Date().toISOString()
  return {
    version: 3,
    secuencia: 0,
    personas: PERSONAS.map((x) => ({ ...x })),
    programas: [],
    puntos: [
      {
        ...PUNTO_INICIAL,
        billeteraCorta: billeteraCorta(PUNTO_INICIAL.billetera),
        moneda: COP,
        programaId: null,
      },
    ],
    cuentas: [
      {
        id: 'd0000000-0000-0000-0000-000000000001',
        documento: '900000001',
        estado: 'Verificada',
        billetera: WALLET_ANA,
        billeteraCorta: billeteraCorta(WALLET_ANA),
        creado: ahora,
      },
    ],
    cobros: [],
  }
}

function cargar(): Estado {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      const e = JSON.parse(crudo) as Estado
      if (e.version === 3) return e
    }
  } catch {
    // estado dañado: se empieza de nuevo
  }
  return estadoInicial()
}

function guardar(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e))
  } catch {
    // sin almacenamiento: la simulación vive solo en esta pestaña
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

class Falla extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

const MENSAJES: Record<string, string> = {
  YaCobrado: 'Este subsidio ya fue cobrado',
  EnProceso: 'Este subsidio ya está en proceso o fue cobrado',
  TopeSuperado: 'El banco rechazó el pago: el programa llegó a su tope',
  ProgramaCerrado: 'El programa está cerrado y ya no recibe cobros',
  SinPagoDisponible: 'Esta cédula no tiene pagos disponibles en este programa',
  CuentaNoVerificada: 'Primero enlaza y verifica tu cuenta',
  PinBloqueado: 'No pudimos confirmar tu identidad',
  TiempoAgotado: 'No pudimos confirmar tu identidad',
  ProgramaNoRecibe: 'El programa no está recibiendo cobros',
  SinFondos: 'El programa no tiene fondos en este momento',
  LiquidacionNoResponde: 'No pudimos consultar tu pago; intenta en un momento',
  PermisoVencido: 'El permiso venció: apruébalo de nuevo',
  Cancelado: 'El cobro se canceló. No se movió dinero',
  ErrorPago: 'El banco no pudo procesar el pago. No se movió dinero',
}

const motivo = (codigo: string): Motivo => ({ codigo, mensaje: MENSAJES[codigo] })

const uuid = () => crypto.randomUUID()
const iso = (ms = Date.now()) => new Date(ms).toISOString()
const hoy = () => iso().slice(0, 10)
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

function persona(e: Estado, documento: string): PersonaLiquidacion | undefined {
  return e.personas.find((p) => p.documento === documento)
}

/** Lo que recibe la persona en ese programa: el monto por persona por sus «veces». */
function montoDe(prog: Pick<Programa, 'montoPorPersona'>, quien: PersonaLiquidacion): string {
  return (BigInt(prog.montoPorPersona) * BigInt(quien.veces)).toString()
}

function esNovedad(prog: Pick<ProgramaS, 'corte'>, quien: PersonaLiquidacion): boolean {
  return quien.novedad || (!!prog.corte && !!quien.registrada && quien.registrada > prog.corte)
}

/** «10000» en pesos → unidades mínimas con la escala de la wallet. */
function desdePesos(valor: unknown, escala: number): string {
  const texto = String(valor ?? '').trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(texto)
  if (!m || (m[2] ?? '').length > escala) throw new Falla(400, 'EntradaInvalida', 'Escribe el monto por persona en pesos, sin puntos de miles')
  const unidades = BigInt(m[1] + (m[2] ?? '').padEnd(escala, '0'))
  if (unidades <= 0n) throw new Falla(400, 'EntradaInvalida', 'El monto por persona debe ser mayor que cero')
  return unidades.toString()
}

/** `$ilp.interledger-test.dev/ana` → `https://ilp.interledger-test.dev/ana`, si es de la Test Wallet. */
function resolverBilletera(direccion: string): Billetera | null {
  const d = direccion.trim()
  const url = d.startsWith('$') ? `https://${d.slice(1)}` : d
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.host !== HOST_TEST_WALLET) return null
  const ruta = u.pathname.replace(/\/+$/, '')
  if (!ruta || ruta === '/') return null
  const moneda: Moneda = /usd/i.test(ruta) ? { codigo: 'USD', escala: 2 } : COP
  return { id: `https://${u.host}${ruta}`, moneda }
}

function buscarPrograma(e: Estado, id: string): ProgramaS {
  const p = e.programas.find((x) => x.id === id)
  if (!p) throw new Falla(404, 'NoExiste', 'No encontramos ese programa')
  return p
}

function buscarCobro(e: Estado, id: string): CobroS {
  const c = e.cobros.find((x) => x.id === id)
  if (!c) throw new Falla(404, 'NoExiste', 'No encontramos ese cobro')
  return c
}

function publicoPrograma(p: ProgramaS): Programa {
  const { id, nombre, entidad, tipo, billetera, moneda, vigenciaInicio, vigenciaFin, estado, tope, montoPorPersona } = p
  return { id, nombre, entidad, tipo, billetera, moneda, vigenciaInicio, vigenciaFin, estado, tope, montoPorPersona }
}

function publicoPunto(p: PuntoS): Punto {
  // Como la API real: la BD no guarda la moneda del punto, así que no se devuelve.
  const { id, nombre, direccion, billetera, billeteraCorta: corta } = p
  return { id, nombre, direccion, billetera, billeteraCorta: corta }
}

function publicoCuenta(c: CuentaS): Cuenta {
  const { id, documento, estado, billetera, billeteraCorta: corta } = c
  return { id, documento, estado, billetera, billeteraCorta: corta }
}

function publicoCobro(c: CobroS): Cobro {
  const { documento: _d, llave: _l, pagandoDesde: _p, resuelveEn: _r, resultado: _x, ...resto } = c
  return { ...resto, eventos: [...c.eventos] }
}

function resumenCobro(c: CobroS): CobroResumen {
  const { eventos: _e, ...resto } = publicoCobro(c)
  return resto
}

// ── Avance del tiempo (lo que la API real hace al consultar) ─────────────────

function transicion(c: CobroS, hacia: EstadoCobro, texto: string, ms = Date.now()) {
  c.eventos.push({ desde: c.estado, hacia, texto, creado: iso(ms) })
  c.estado = hacia
  c.actualizado = iso(ms)
}

function destinoTexto(c: CobroS): string {
  return c.canal === 'retiro' ? (c.punto?.nombre.split(' — ')[0] ?? 'El punto') : `La cuenta ${c.cuenta?.billeteraCorta ?? ''}`
}

/** Avanza un cobro según el reloj: vencimiento del PIN (RN-12) y resultado del pago (RN-10). */
function avanzar(e: Estado, c: CobroS, ahora = Date.now()) {
  if (c.estado === 'PorConfirmar' && c.confirmarAntesDe && ahora > Date.parse(c.confirmarAntesDe)) {
    c.motivo = motivo('TiempoAgotado')
    c.confirmarAntesDe = null
    transicion(c, 'Rechazado', 'Pasaron 120 segundos sin confirmar el PIN.', Date.parse(c.actualizado) + CONFIG.confirmacionTtlSeg * 1000)
  }
  if (c.estado === 'Pagando' && c.resuelveEn && ahora >= c.resuelveEn && c.resultado) {
    const momento = c.resuelveEn
    if (c.resultado.estado === 'Pagado') {
      c.segundosHastaPagado = Math.round((momento - (c.pagandoDesde ?? momento)) / 100) / 10
      transicion(
        c,
        'Pagado',
        `Pago completado. ${destinoTexto(c)} recibió ${formatMontoDe(c.monto, c.moneda)} con la referencia ${c.referencia}.`,
        momento,
      )
    } else {
      c.motivo = c.resultado.motivo
      transicion(c, 'Fallido', `${c.resultado.motivo?.mensaje ?? 'El pago falló'}. La plata no se movió.`, momento)
    }
    c.resultado = null
    c.resuelveEn = null
  }
  void e
}

function avanzarTodo(e: Estado) {
  const ahora = Date.now()
  for (const c of e.cobros) avanzar(e, c, ahora)
  for (const p of e.programas) {
    if (p.estado === 'EsperandoAprobacion' && p.pendienteDesde) {
      if (ahora - Date.parse(p.pendienteDesde) > CONFIG.aprobacionTtlMin * 60_000) {
        p.estado = 'Borrador'
        p.pendienteDesde = null
      }
    }
  }
}

/** Pone el cobro en Pagando y decide, como lo haría el banco, si el pago pasa o choca con el tope. */
function empezarPago(e: Estado, c: CobroS, texto: string) {
  const programa = buscarPrograma(e, c.programa.id)
  const comprometido = e.cobros
    .filter((x) => x.programa.id === programa.id && x.id !== c.id && (x.estado === 'Pagado' || x.estado === 'Pagando'))
    .map((x) => x.monto)
  const total = BigInt(sumarMontos('0', ...comprometido, c.monto))
  const ahora = Date.now()
  c.pagandoDesde = ahora
  if (programa.tope !== null && total > BigInt(programa.tope)) {
    c.resultado = { estado: 'Fallido', motivo: motivo('TopeSuperado') }
    c.resuelveEn = ahora + 1800
  } else {
    c.resultado = { estado: 'Pagado', motivo: null }
    c.resuelveEn = ahora + 2000 + Math.round(Math.random() * 1500)
  }
  c.confirmarAntesDe = null
  c.intentosRestantes = null
  transicion(c, 'Pagando', texto, ahora)
}

// ── Cálculos del tablero ──────────────────────────────────────────────────────

function liquidacionDe(e: Estado, prog: Pick<ProgramaS, 'corte' | 'montoPorPersona'>): { cedulas: number; total: string } {
  const base = e.personas.filter((x) => !esNovedad(prog, x))
  return { cedulas: base.length, total: sumarMontos('0', ...base.map((x) => montoDe(prog, x))) }
}

function tableroDe(e: Estado, p: ProgramaS): Tablero {
  const cobros = e.cobros.filter((c) => c.programa.id === p.id).sort((a, b) => b.creado.localeCompare(a.creado))
  const pagados = cobros.filter((c) => c.estado === 'Pagado')
  const sumaDe = (lista: CobroS[]) => sumarMontos('0', ...lista.map((c) => c.monto))
  const cobrado = sumaDe(pagados)
  const autorizado = p.tope ?? liquidacionDe(e, p).total
  const retiros = pagados.filter((c) => c.canal === 'retiro')
  const segundos = retiros.map((c) => c.segundosHastaPagado).filter((s): s is number => s !== null)
  const sinCobrar = e.personas.filter((x) => !esNovedad(p, x) && !pagados.some((c) => c.documento === x.documento))
  return {
    programa: publicoPrograma(p),
    autorizado,
    cobrado: p.cierre?.cobrado ?? cobrado,
    fuente: 'banco',
    noHaSalido: (BigInt(autorizado) - BigInt(cobrado)).toString(),
    cobrosPagados: pagados.length,
    porCanal: {
      cuenta: { cobros: pagados.filter((c) => c.canal === 'cuenta').length, monto: sumaDe(pagados.filter((c) => c.canal === 'cuenta')) },
      retiro: { cobros: retiros.length, monto: sumaDe(retiros) },
    },
    reembolsoSegundos: segundos.length ? Math.round((segundos.reduce((a, b) => a + b, 0) / segundos.length) * 10) / 10 : null,
    giradoPorAdelantado: '0',
    sinCobrar: { cedulas: sinCobrar.length, monto: sumarMontos('0', ...sinCobrar.map((x) => montoDe(p, x))) },
    cobrosPagando: cobros.filter((c) => c.estado === 'Pagando').length,
    rechazadosYFallidos: cobros.filter((c) => c.estado === 'Rechazado' || c.estado === 'Fallido').length,
    cobros: cobros.map(resumenCobro),
    cierre: p.cierre,
  }
}

// ── Cobros ────────────────────────────────────────────────────────────────────

interface EntradaCobro {
  programaId?: string
  documento?: string
  canal?: Canal
  puntoId?: string
  llaveIdempotencia?: string
}

function cuentaVerificada(e: Estado, documento: string): CuentaS | undefined {
  return e.cuentas.find((c) => c.documento === documento && c.estado === 'Verificada')
}

/** D-21: el punto no elige programa; se toma el subsidio que tenga un pago para esa cédula. */
function elegirPrograma(e: Estado, programaId: string | undefined): ProgramaS | undefined {
  if (programaId) return buscarPrograma(e, programaId)
  const candidatos = e.programas
    .filter((p) => p.estado === 'Activo' || p.estado === 'Pausado' || p.estado === 'Cerrado')
    .sort((a, b) => b.creado.localeCompare(a.creado))
  return candidatos.find((p) => p.estado === 'Activo') ?? candidatos[0]
}

function crearCobro(e: Estado, entrada: EntradaCobro): Cobro {
  const { documento, canal, llaveIdempotencia } = entrada
  if (!documento || !/^\d{5,12}$/.test(documento)) throw new Falla(400, 'EntradaInvalida', 'Digita un número de cédula válido')
  if (canal !== 'cuenta' && canal !== 'retiro') throw new Falla(400, 'EntradaInvalida', 'Canal inválido')
  if (!llaveIdempotencia) throw new Falla(400, 'EntradaInvalida', 'Falta la llave de idempotencia')

  const repetido = e.cobros.find((c) => c.llave === llaveIdempotencia)
  if (repetido) return publicoCobro(repetido) // HU-10: doble clic

  const quien = persona(e, documento)
  const programa = elegirPrograma(e, entrada.programaId)
  if (!quien || !programa) throw new Falla(404, 'SinPagoDisponible', MENSAJES.SinPagoDisponible)
  if (canal === 'retiro' && !quien.pin) throw new Falla(422, 'SinPin', 'Esta persona no registró un PIN: solo puede cobrar a su cuenta')

  const punto = canal === 'retiro' ? e.puntos.find((p) => p.id === entrada.puntoId) : undefined
  if (canal === 'retiro' && !punto) throw new Falla(400, 'EntradaInvalida', 'Falta el punto de retiro')
  const cuenta = canal === 'cuenta' ? cuentaVerificada(e, documento) : undefined

  e.secuencia += 1
  const ahora = Date.now()
  const c: CobroS = {
    id: uuid(),
    referencia: `SUB-${String(e.secuencia).padStart(4, '0')}`,
    programa: { id: programa.id, nombre: programa.nombre, estado: programa.estado },
    canal,
    punto: punto ? { id: punto.id, nombre: punto.nombre, billeteraCorta: punto.billeteraCorta } : null,
    cuenta: cuenta ? { billetera: cuenta.billetera, billeteraCorta: cuenta.billeteraCorta } : null,
    persona: { nombre: quien.nombre, etiqueta: quien.etiqueta, novedad: esNovedad(programa, quien) },
    monto: montoDe(programa, quien),
    moneda: programa.moneda,
    estado: 'Solicitado',
    motivo: null,
    intentosRestantes: null,
    confirmarAntesDe: null,
    segundosHastaPagado: null,
    creado: iso(ahora),
    actualizado: iso(ahora),
    eventos: [],
    documento,
    llave: llaveIdempotencia,
    pagandoDesde: null,
    resuelveEn: null,
    resultado: null,
  }
  c.eventos.push({
    desde: null,
    hacia: 'Solicitado',
    texto: canal === 'retiro' ? `${punto!.nombre.split(' — ')[0]} digitó la cédula.` : `${quien.nombre} pidió el cobro a su cuenta.`,
    creado: iso(ahora),
  })
  e.cobros.push(c)

  const rechazar = (codigo: string) => {
    c.motivo = motivo(codigo)
    transicion(c, 'Rechazado', `${MENSAJES[codigo]}.`, ahora)
    return publicoCobro(c)
  }

  // Reglas en el orden del Plan backend § 8.2
  if (programa.estado === 'Cerrado') return rechazar('ProgramaCerrado')
  if (programa.estado !== 'Activo') return rechazar('ProgramaNoRecibe')
  if (hoy() < programa.vigenciaInicio || hoy() > programa.vigenciaFin) return rechazar('ProgramaNoRecibe')
  const bloqueos = e.cobros.filter(
    (x) => x.documento === documento && x.motivo?.codigo === 'PinBloqueado' && ahora - Date.parse(x.actualizado) < CONFIG.pinBloqueoMin * 60_000,
  )
  if (bloqueos.length > 0) return rechazar('PinBloqueado')
  if (canal === 'cuenta' && !cuenta) {
    // Como la API real: sin ninguna cuenta verificada responde 409 y no deja cobro.
    e.cobros.pop()
    e.secuencia -= 1
    throw new Falla(409, 'CuentaNoVerificada', MENSAJES.CuentaNoVerificada)
  }

  const otros = e.cobros.filter((x) => x.id !== c.id && x.programa.id === programa.id && x.documento === documento)
  if (otros.some((x) => x.estado === 'Pagado')) return rechazar('YaCobrado')
  if (otros.some((x) => x.estado === 'Solicitado' || x.estado === 'PorConfirmar' || x.estado === 'Pagando')) return rechazar('EnProceso')

  const disponible = `La liquidación respondió: pago disponible de ${formatMontoDe(c.monto, c.moneda)}.`
  if (canal === 'retiro') {
    c.intentosRestantes = CONFIG.pinMaxIntentos
    c.confirmarAntesDe = iso(ahora + CONFIG.confirmacionTtlSeg * 1000)
    transicion(c, 'PorConfirmar', disponible, ahora)
  } else {
    empezarPago(e, c, `${disponible} Se creó el pago desde la cuenta del programa.`)
  }
  return publicoCobro(c)
}

function confirmarCobro(e: Estado, c: CobroS, pin: unknown): RespuestaCruda {
  avanzar(e, c)
  if (c.estado !== 'PorConfirmar') return { status: 200, cuerpo: publicoCobro(c) } // doble confirmación
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new Falla(400, 'EntradaInvalida', 'El PIN tiene 4 dígitos')

  const quien = persona(e, c.documento)
  if (quien?.pin !== pin) {
    c.intentosRestantes = Math.max(0, (c.intentosRestantes ?? CONFIG.pinMaxIntentos) - 1)
    if (c.intentosRestantes === 0) {
      c.motivo = motivo('PinBloqueado')
      c.confirmarAntesDe = null
      transicion(c, 'Rechazado', 'Tres PIN incorrectos: la cédula queda bloqueada 15 minutos.')
      return { status: 200, cuerpo: publicoCobro(c) }
    }
    const n = c.intentosRestantes
    throw new Falla(422, 'PinIncorrecto', `PIN incorrecto, te ${n === 1 ? 'queda 1 intento' : `quedan ${n} intentos`}`)
  }
  empezarPago(e, c, 'El beneficiario confirmó con su PIN. Se creó el pago desde la cuenta del programa.')
  return { status: 202, cuerpo: publicoCobro(c) }
}

// ── Enrutador ─────────────────────────────────────────────────────────────────

type Manejador = (e: Estado, p: Record<string, string>, cuerpo: Record<string, unknown>, q: URLSearchParams) => RespuestaCruda | unknown

const rutas: Array<[string, string, Manejador]> = [
  ['GET', '/config', () => ({
    pollIntervaloMs: CONFIG.pollIntervaloMs,
    confirmacionTtlSeg: CONFIG.confirmacionTtlSeg,
    extras: { bono: false, qr: false, pdf417: false, contrato: false, deploy: false },
  })],
  ['GET', '/salud', () => ({ bd: 'ok', openPayments: 'simulado', llave: 'simulada' })],
  ['GET', '/estado', (): EstadoSistema => ({
    pagosReales: false,
    faltan: ['Modo «API simulada»: todo pasa en el navegador y nada sale de la Test Wallet'],
    openPayments: { configurado: false, coincide: null, detalle: 'API simulada' },
    programasConTokenFalso: 0,
    verificacionCuenta: 'subject',
  })],

  // Programas
  ['GET', '/programas', (e) => e.programas.map(publicoPrograma)],
  ['POST', '/programas', (e, _p, b) => {
    const datos = validarPrograma(b)
    const w = resolverBilletera(datos.billetera)
    if (!w) throw new Falla(400, 'BilleteraNoEncontrada', 'No encontramos esa cuenta')
    const p: ProgramaS = {
      id: uuid(),
      ...datos,
      billetera: w.id,
      moneda: w.moneda,
      estado: 'Borrador',
      tope: null,
      montoPorPersona: b.montoPorPersona === undefined ? MONTO_BASE : desdePesos(b.montoPorPersona, w.moneda.escala),
      creado: iso(),
      corte: null,
      pendienteDesde: null,
      cierre: null,
    }
    e.programas.push(p)
    return { status: 201, cuerpo: publicoPrograma(p) }
  }],
  ['GET', '/programas/:id', (e, p) => publicoPrograma(buscarPrograma(e, p.id))],
  ['PATCH', '/programas/:id', (e, p, b) => {
    const prog = buscarPrograma(e, p.id)
    if (prog.estado !== 'Borrador') throw new Falla(409, 'TransicionNoPermitida', 'Solo se puede editar un programa en Borrador')
    const datos = validarPrograma(b)
    const w = resolverBilletera(datos.billetera)
    if (!w) throw new Falla(400, 'BilleteraNoEncontrada', 'No encontramos esa cuenta')
    Object.assign(prog, datos, { billetera: w.id, moneda: w.moneda })
    if (b.montoPorPersona !== undefined) prog.montoPorPersona = desdePesos(b.montoPorPersona, w.moneda.escala)
    return publicoPrograma(prog)
  }],
  ['GET', '/programas/:id/liquidacion', (e, p) => {
    const prog = buscarPrograma(e, p.id)
    return { ...liquidacionDe(e, prog), moneda: prog.moneda }
  }],
  ['POST', '/programas/:id/autorizar', (e, p) => {
    const prog = buscarPrograma(e, p.id)
    if (prog.estado !== 'Borrador') throw new Falla(409, 'TransicionNoPermitida', 'El programa ya no está en Borrador')
    prog.tope = liquidacionDe(e, prog).total // RN-08
    prog.corte = iso()
    prog.estado = 'EsperandoAprobacion'
    prog.pendienteDesde = iso()
    return { redirect: `/simulada/banco?tipo=programa&id=${prog.id}` }
  }],
  ['POST', '/programas/:id/cancelar-aprobacion', (e, p) => {
    const prog = buscarPrograma(e, p.id)
    if (prog.estado === 'EsperandoAprobacion') {
      prog.estado = 'Borrador'
      prog.pendienteDesde = null
      prog.corte = null
    }
    return publicoPrograma(prog)
  }],
  ['GET', '/programas/:id/tablero', (e, p) => tableroDe(e, buscarPrograma(e, p.id))],
  ['POST', '/programas/:id/pausar', (e, p) => {
    const prog = buscarPrograma(e, p.id)
    if (prog.estado !== 'Activo') throw new Falla(409, 'TransicionNoPermitida', 'Solo se puede pausar un programa activo')
    prog.estado = 'Pausado'
    return publicoPrograma(prog)
  }],
  ['POST', '/programas/:id/reanudar', (e, p) => {
    const prog = buscarPrograma(e, p.id)
    if (prog.estado !== 'Pausado') throw new Falla(409, 'TransicionNoPermitida', 'El programa no está en pausa')
    prog.estado = 'Activo'
    return publicoPrograma(prog)
  }],
  ['POST', '/programas/:id/cerrar', (e, p, b) => {
    const prog = buscarPrograma(e, p.id)
    if (b.confirmacion !== 'CERRAR') throw new Falla(400, 'EntradaInvalida', 'Escribe CERRAR para confirmar')
    if (prog.estado !== 'Activo' && prog.estado !== 'Pausado') throw new Falla(409, 'TransicionNoPermitida', 'El programa no se puede cerrar en este estado')
    const t = tableroDe(e, prog)
    if (t.cobrosPagando > 0) throw new Falla(409, 'CobrosPagando', 'Hay cobros pagándose. Espera a que terminen para cerrar')
    prog.estado = 'Cerrado'
    prog.cierre = { autorizado: t.autorizado, cobrado: t.cobrado, nuncaSalio: t.noHaSalido, cerradoEn: iso() }
    // Los cobros que esperaban el PIN ya no pueden pagarse.
    for (const c of e.cobros.filter((x) => x.programa.id === prog.id && x.estado === 'PorConfirmar')) {
      c.motivo = motivo('ProgramaCerrado')
      c.confirmarAntesDe = null
      transicion(c, 'Rechazado', `${MENSAJES.ProgramaCerrado}.`)
    }
    return publicoPrograma(prog)
  }],

  // Billeteras y puntos
  ['GET', '/billeteras/resolver', (_e, _p, _b, q) => {
    const w = resolverBilletera(q.get('direccion') ?? '')
    if (!w) throw new Falla(404, 'BilleteraNoEncontrada', 'No encontramos esa cuenta')
    return w
  }],
  ['GET', '/puntos', (e) => e.puntos.map(publicoPunto)],
  ['POST', '/puntos', (e, _p, b) => {
    const nombre = String(b.nombre ?? '').trim()
    const direccion = String(b.direccion ?? '').trim() || 'Sin dirección'
    if (!nombre) throw new Falla(400, 'EntradaInvalida', 'Escribe el nombre del punto')
    const w = resolverBilletera(String(b.billetera ?? ''))
    if (!w) throw new Falla(400, 'BilleteraNoEncontrada', 'No encontramos esa cuenta')
    const programaId = typeof b.programaId === 'string' ? b.programaId : null
    if (programaId) {
      const prog = buscarPrograma(e, programaId)
      if (prog.moneda.codigo !== w.moneda.codigo) {
        throw new Falla(400, 'MonedaDistinta', `La wallet del punto usa ${w.moneda.codigo} y el programa usa ${prog.moneda.codigo}: no se guardó`)
      }
    }
    const p: PuntoS = { id: uuid(), nombre, direccion, billetera: w.id, billeteraCorta: billeteraCorta(w.id), moneda: w.moneda, programaId }
    e.puntos.push(p)
    return { status: 201, cuerpo: publicoPunto(p) }
  }],
  ['GET', '/puntos/:id/pagos', (e, _p, _b, q): PagosEnPunto => {
    const quien = persona(e, q.get('documento') ?? '')
    if (!quien) throw new Falla(404, 'SinPagoDisponible', 'Esta cédula no tiene pagos disponibles')
    return { persona: { nombre: quien.nombre, etiqueta: quien.etiqueta, tienePin: !!quien.pin }, pagos: pagosPendientes(e, quien, true) }
  }],
  ['GET', '/puntos/:id/cobros', (e, p, _b, q) => cobrosDePunto(e, p.id, q.get('desde')).map(resumenCobro)],
  ['GET', '/puntos/:id/resumen', (e, p, _b, q): CajaPunto => {
    const punto = e.puntos.find((x) => x.id === p.id)
    if (!punto) throw new Falla(404, 'NoEncontrado', 'Ese punto no existe')
    const periodo: PeriodoCaja = q.get('desde') === '7d' || q.get('desde') === 'todo' ? (q.get('desde') as PeriodoCaja) : 'hoy'
    const lista = cobrosDePunto(e, p.id, periodo)
    const pagados = lista.filter((c) => c.estado === 'Pagado')
    const entregado = sumarMontos('0', ...pagados.map((c) => c.monto))
    const segundos = pagados.map((c) => c.segundosHastaPagado).filter((s): s is number => s !== null)
    return {
      punto: publicoPunto(punto),
      periodo,
      totales: lista.length
        ? [{ moneda: COP, entregado, reembolsado: entregado, pendiente: sumarMontos('0', ...lista.filter((c) => c.estado === 'Pagando').map((c) => c.monto)) }]
        : [],
      cobros: {
        pagados: pagados.length,
        enCurso: lista.filter((c) => c.estado === 'Solicitado' || c.estado === 'PorConfirmar' || c.estado === 'Pagando').length,
        rechazados: lista.filter((c) => c.estado === 'Rechazado' || c.estado === 'Fallido').length,
      },
      reembolsoSegundos: segundos.length ? Math.round((segundos.reduce((a, b) => a + b, 0) / segundos.length) * 10) / 10 : null,
      giradoPorAdelantado: '0',
    }
  }],

  // Beneficiarios y cuentas
  ['GET', '/beneficiarios/demo', (e) =>
    e.personas.filter((x) => x.usaApp).map((x) => ({
      documento: x.documento,
      nombre: x.nombre,
      etiqueta: x.etiqueta,
    })),
  ],
  ['GET', '/beneficiarios', (e) => e.personas.map((x) => personaRegistrada(e, x))],
  ['POST', '/beneficiarios', (e, _p, b) => {
    const documento = String(b.documento ?? '').trim()
    if (!/^\d{5,12}$/.test(documento)) throw new Falla(400, 'EntradaInvalida', 'La cédula va sin puntos ni espacios: de 5 a 12 dígitos')
    const pin = String(b.pin ?? '').trim()
    if (pin && !/^\d{4}$/.test(pin)) throw new Falla(400, 'EntradaInvalida', 'El PIN tiene 4 dígitos')
    if (persona(e, documento)) throw new Falla(409, 'PersonaExiste', 'Esa cédula ya está registrada')
    const w = resolverBilletera(String(b.billetera ?? ''))
    if (!w) throw new Falla(404, 'BilleteraNoEncontrada', 'No encontramos esa cuenta')
    const ajena = e.cuentas.find((c) => c.billetera === w.id && c.estado !== 'SinEnlazar')
    if (ajena) throw new Falla(409, 'BilleteraEnUso', `Esa wallet ya está registrada para ${persona(e, ajena.documento)?.nombre ?? 'otra persona'}`)
    const nombre = String(b.nombre ?? '').trim() || w.id.split('/').pop() || `Persona ${documento.slice(-4)}`
    const nueva: PersonaLiquidacion = {
      documento,
      nombre,
      etiqueta: `C.C. de prueba ${Number(documento.slice(-3))}`,
      veces: 1,
      pin: pin || null,
      novedad: false,
      usaApp: true,
      registrada: iso(),
    }
    e.personas.push(nueva)
    e.cuentas.push({ id: uuid(), documento, estado: 'Verificada', billetera: w.id, billeteraCorta: billeteraCorta(w.id), creado: iso() })
    return { status: 201, cuerpo: personaRegistrada(e, nueva) }
  }],
  ['POST', '/beneficiarios/:documento/pin', (e, p, b) => {
    const quien = persona(e, p.documento)
    if (!quien) throw new Falla(404, 'NoEncontrado', 'Esa cédula no está registrada')
    const pin = String(b.pin ?? '')
    if (!/^\d{4}$/.test(pin)) throw new Falla(400, 'EntradaInvalida', 'El PIN tiene 4 dígitos')
    quien.pin = pin
    return { documento: quien.documento, tienePin: true }
  }],
  ['GET', '/beneficiarios/:documento/resumen', (e, p): ResumenBeneficiario => {
    const quien = persona(e, p.documento)
    if (!quien) throw new Falla(404, 'NoExiste', 'No encontramos esa cédula')
    const propios = e.cobros.filter((c) => c.documento === quien.documento).sort((a, b) => b.creado.localeCompare(a.creado))
    const pagos = pagosPendientes(e, quien, false)
    const ultimo = propios.find((c) => c.estado === 'Pagado' || c.estado === 'Pagando')
    return {
      persona: { nombre: quien.nombre, documento: quien.documento, tienePin: !!quien.pin },
      pagos,
      pago: pagos[0] ?? null,
      cuenta: cuentaVigente(e, quien.documento),
      ultimoCobro: ultimo ? resumenCobro(ultimo) : null,
    }
  }],
  ['POST', '/cuentas', (e, _p, b) => {
    const documento = String(b.documento ?? '')
    const quien = persona(e, documento)
    if (!quien) throw new Falla(404, 'NoExiste', 'No encontramos esa cédula')
    if (quien.pin && String(b.pin ?? '') !== quien.pin) throw new Falla(422, 'PinIncorrecto', 'El PIN no coincide con el de tu subsidio')
    const w = resolverBilletera(String(b.billetera ?? ''))
    if (!w) throw new Falla(400, 'BilleteraNoEncontrada', 'No encontramos esa billetera')
    for (const c of e.cuentas.filter((x) => x.documento === documento && x.estado === 'PorVerificar')) c.estado = 'SinEnlazar'
    const cuenta: CuentaS = { id: uuid(), documento, estado: 'PorVerificar', billetera: w.id, billeteraCorta: billeteraCorta(w.id), creado: iso() }
    e.cuentas.push(cuenta)
    return { status: 201, cuerpo: { cuenta: publicoCuenta(cuenta), redirect: `/simulada/banco?tipo=cuenta&id=${cuenta.id}` } }
  }],
  ['GET', '/cuentas/:documento', (e, p) => {
    const c = cuentaVigente(e, p.documento)
    if (!c) throw new Falla(404, 'NoExiste', 'Todavía no has enlazado una cuenta')
    return c
  }],

  // Cobros
  ['POST', '/cobros', (e, _p, b) => crearCobro(e, b as EntradaCobro)],
  ['GET', '/cobros/:id', (e, p) => publicoCobro(buscarCobro(e, p.id))],
  ['POST', '/cobros/:id/confirmar', (e, p, b) => confirmarCobro(e, buscarCobro(e, p.id), b.pin)],
  ['POST', '/cobros/:id/cancelar', (e, p) => {
    const c = buscarCobro(e, p.id)
    avanzar(e, c)
    if (c.estado === 'PorConfirmar') {
      c.motivo = motivo('Cancelado')
      c.confirmarAntesDe = null
      c.intentosRestantes = null
      transicion(c, 'Rechazado', 'El punto canceló el cobro. No se movió dinero.')
    } else if (c.estado !== 'Rechazado') {
      throw new Falla(409, 'TransicionNoPermitida', 'Este cobro ya no se puede cancelar')
    }
    return publicoCobro(c)
  }],
]

/** Cobros del punto en el periodo de «Mi caja» (hoy, últimos 7 días o todo). */
function cobrosDePunto(e: Estado, puntoId: string, desde: string | null): CobroS[] {
  const limite = desde === 'todo' ? '' : desde === '7d' ? iso(Date.now() - 6 * 86_400_000).slice(0, 10) : hoy()
  return e.cobros.filter((c) => c.punto?.id === puntoId && c.creado.slice(0, 10) >= limite).sort((a, b) => b.creado.localeCompare(a.creado))
}

/** Como la API: todos los programas Activos o Pausados donde no ha cobrado; en el punto, solo los que reciben hoy. */
function pagosPendientes(e: Estado, quien: PersonaLiquidacion, soloQueReciben: boolean): PagoPendiente[] {
  return e.programas
    .filter((x) => (soloQueReciben ? x.estado === 'Activo' && hoy() >= x.vigenciaInicio && hoy() <= x.vigenciaFin : x.estado === 'Activo' || x.estado === 'Pausado'))
    .filter((x) => !e.cobros.some((c) => c.documento === quien.documento && c.programa.id === x.id && c.estado === 'Pagado'))
    .map((x) => ({
      programa: { id: x.id, nombre: x.nombre, estado: x.estado },
      monto: montoDe(x, quien),
      moneda: x.moneda,
      vigenciaFin: x.vigenciaFin,
    }))
}

function personaRegistrada(e: Estado, x: PersonaLiquidacion): PersonaRegistrada {
  const c = cuentaVigente(e, x.documento)
  return {
    documento: x.documento,
    nombre: x.nombre,
    billetera: c?.billetera ?? null,
    billeteraCorta: c?.billeteraCorta ?? null,
    moneda: c ? (resolverBilletera(c.billetera)?.moneda ?? null) : null,
    estadoCuenta: c?.estado ?? null,
    tienePin: !!x.pin,
    registrado: x.registrada ?? iso(0),
  }
}

function cuentaVigente(e: Estado, documento: string): Cuenta | null {
  const propias = e.cuentas.filter((c) => c.documento === documento).sort((a, b) => b.creado.localeCompare(a.creado))
  const c = propias.find((x) => x.estado === 'PorVerificar') ?? propias.find((x) => x.estado === 'Verificada') ?? propias[0]
  return c ? publicoCuenta(c) : null
}

function validarPrograma(b: Record<string, unknown>) {
  const texto = (k: string) => String(b[k] ?? '').trim()
  const datos = {
    nombre: texto('nombre'),
    entidad: texto('entidad'),
    tipo: (b.tipo === 'bono' ? 'bono' : 'subsidio') as Programa['tipo'],
    billetera: texto('billetera'),
    vigenciaInicio: texto('vigenciaInicio'),
    vigenciaFin: texto('vigenciaFin'),
  }
  if (!datos.nombre || !datos.entidad) throw new Falla(400, 'EntradaInvalida', 'Escribe el nombre del programa y de la entidad')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.vigenciaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(datos.vigenciaFin)) {
    throw new Falla(400, 'EntradaInvalida', 'Escribe las fechas de la vigencia')
  }
  if (datos.vigenciaFin < datos.vigenciaInicio) throw new Falla(400, 'EntradaInvalida', 'La vigencia termina antes de empezar')
  if (datos.tipo === 'bono') throw new Falla(400, 'ExtraApagado', 'El bono con destino es un extra y está apagado')
  return datos
}

function coincidir(patron: string, ruta: string): Record<string, string> | null {
  const a = patron.split('/')
  const b = ruta.split('/')
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

export async function responder(metodo: string, rutaCompleta: string, cuerpo?: unknown): Promise<RespuestaCruda> {
  await espera(120 + Math.random() * 220)
  const [ruta, consulta = ''] = rutaCompleta.split('?')
  const e = cargar()
  avanzarTodo(e)
  try {
    for (const [m, patron, manejador] of rutas) {
      if (m !== metodo) continue
      const params = coincidir(patron, ruta)
      if (!params) continue
      const r = manejador(e, params, (cuerpo ?? {}) as Record<string, unknown>, new URLSearchParams(consulta))
      guardar(e)
      if (r && typeof r === 'object' && 'status' in r && 'cuerpo' in r) return r as RespuestaCruda
      return { status: 200, cuerpo: r }
    }
    return { status: 404, cuerpo: { error: { codigo: 'RutaNoExiste', mensaje: `No existe ${metodo} ${ruta}` } } }
  } catch (err) {
    guardar(e)
    if (err instanceof Falla) return { status: err.status, cuerpo: { error: { codigo: err.codigo, mensaje: err.message } } }
    console.error('[api simulada]', err)
    return { status: 500, cuerpo: { error: { codigo: 'ErrorInterno', mensaje: 'Algo falló en la API simulada' } } }
  }
}

// ── Lo que hace la «Test Wallet» simulada ─────────────────────────────────────

export interface Consentimiento {
  tipo: 'programa' | 'cuenta'
  titulo: string
  filas: Array<[string, string]>
}

export function consentimiento(tipo: string, id: string): Consentimiento | null {
  const e = cargar()
  if (tipo === 'programa') {
    const p = e.programas.find((x) => x.id === id)
    if (!p || p.estado !== 'EsperandoAprobacion' || !p.tope) return null
    return {
      tipo,
      titulo: `${p.entidad} pide permiso para pagar desde tu cuenta`,
      filas: [
        ['Cuenta', p.billetera],
        ['Tope total', formatMontoDe(p.tope, p.moneda)],
        ['A quién', 'Cualquier cuenta (sin receptor fijo)'],
        ['Acciones', 'Crear y leer pagos salientes'],
      ],
    }
  }
  if (tipo === 'cuenta') {
    const c = e.cuentas.find((x) => x.id === id)
    if (!c || c.estado !== 'PorVerificar') return null
    return {
      tipo,
      titulo: 'Tatú quiere confirmar que esta cuenta es tuya',
      filas: [
        ['Cuenta', c.billetera],
        ['Qué comparte', 'Solo la dirección de la cuenta. No mueve dinero.'],
      ],
    }
  }
  return null
}

/** Imita el callback de la API: cambia el estado y devuelve a dónde redirige la web. */
export function resolverConsentimiento(tipo: string, id: string, aprobado: boolean): string {
  const e = cargar()
  let destino = '/'
  if (tipo === 'programa') {
    const p = e.programas.find((x) => x.id === id)
    if (p && p.estado === 'EsperandoAprobacion') {
      p.estado = aprobado ? 'Activo' : 'Borrador'
      p.pendienteDesde = null
      if (!aprobado) {
        p.tope = null
        p.corte = null
      }
    }
    destino = `/entidad/programas/${id}/aprobar?resultado=${aprobado ? 'aprobado' : 'rechazado'}`
  } else if (tipo === 'cuenta') {
    const c = e.cuentas.find((x) => x.id === id)
    if (c && c.estado === 'PorVerificar') {
      if (aprobado) {
        for (const otra of e.cuentas.filter((x) => x.documento === c.documento && x.id !== c.id)) otra.estado = 'SinEnlazar'
        c.estado = 'Verificada'
      } else {
        c.estado = 'SinEnlazar'
      }
    }
    destino = `/beneficiario/cuenta?resultado=${aprobado ? 'verificada' : 'rechazada'}`
  }
  guardar(e)
  return destino
}

// ── Datos de la demo ──────────────────────────────────────────────────────────

export function reiniciarSimulacion() {
  guardar(estadoInicial())
}

/** El escenario de db/002_datos_prueba.sql: programa Activo con cobros ya hechos («solo UI»). */
export function cargarEscenarioDemo() {
  const e = estadoInicial()
  const t0 = Date.now() - 40 * 60_000
  const inicio = hoy().slice(0, 8) + '01'
  const fin = `${new Date().getFullYear()}-12-31`
  const programa: ProgramaS = {
    id: 'a0000000-0000-0000-0000-000000000001',
    nombre: 'Subsidio adulto mayor (simulado)',
    entidad: 'Entidad de prueba',
    tipo: 'subsidio',
    billetera: WALLET_PROGRAMA,
    moneda: COP,
    vigenciaInicio: inicio,
    vigenciaFin: fin,
    estado: 'Activo',
    tope: null,
    montoPorPersona: MONTO_BASE,
    creado: iso(t0),
    corte: iso(t0),
    pendienteDesde: null,
    cierre: null,
  }
  programa.tope = liquidacionDe(e, programa).total
  e.programas.push(programa)
  const punto = e.puntos[0]

  const hecho = (documento: string, canal: Canal, minuto: number, final: 'Pagado' | 'YaCobrado' | 'TopeSuperado') => {
    const quien = persona(e, documento)!
    e.secuencia += 1
    const t = t0 + minuto * 60_000
    const ev = (desde: EstadoCobro | null, hacia: EstadoCobro, texto: string, s: number): EventoCobro => ({ desde, hacia, texto, creado: iso(t + s * 1000) })
    const montoTxt = formatMontoDe(montoDe(programa, quien), COP)
    const referencia = `SUB-${String(e.secuencia).padStart(4, '0')}`
    const eventos: EventoCobro[] = [
      ev(null, 'Solicitado', canal === 'retiro' ? 'Tienda Marta digitó la cédula.' : `${quien.nombre} pidió el cobro a su cuenta.`, 0),
    ]
    let estado: EstadoCobro = 'Pagado'
    let mot: Motivo | null = null
    let segundos: number | null = null
    if (final === 'YaCobrado') {
      estado = 'Rechazado'
      mot = motivo('YaCobrado')
      eventos.push(ev('Solicitado', 'Rechazado', `${MENSAJES.YaCobrado}.`, 1))
    } else if (canal === 'retiro') {
      eventos.push(ev('Solicitado', 'PorConfirmar', `La liquidación respondió: pago disponible de ${montoTxt}.`, 1))
      eventos.push(ev('PorConfirmar', 'Pagando', 'El beneficiario confirmó con su PIN. Se creó el pago desde la cuenta del programa.', 40))
      if (final === 'TopeSuperado') {
        estado = 'Fallido'
        mot = motivo('TopeSuperado')
        eventos.push(ev('Pagando', 'Fallido', `${MENSAJES.TopeSuperado}. La plata no se movió.`, 42))
      } else {
        segundos = 3.2
        eventos.push(ev('Pagando', 'Pagado', `Pago completado. Tienda Marta recibió ${montoTxt} con la referencia ${referencia}.`, 43.2))
      }
    } else {
      eventos.push(ev('Solicitado', 'Pagando', `La liquidación respondió: pago disponible de ${montoTxt}. Se creó el pago desde la cuenta del programa.`, 1))
      segundos = 2.6
      eventos.push(ev('Pagando', 'Pagado', `Pago completado. La cuenta …/tatu-ana recibió ${montoTxt} con la referencia ${referencia}.`, 3.6))
    }
    e.cobros.push({
      id: uuid(),
      referencia,
      programa: { id: programa.id, nombre: programa.nombre },
      canal,
      punto: canal === 'retiro' ? { id: punto.id, nombre: punto.nombre, billeteraCorta: punto.billeteraCorta } : null,
      cuenta: canal === 'cuenta' ? { billetera: WALLET_ANA, billeteraCorta: billeteraCorta(WALLET_ANA) } : null,
      persona: { nombre: quien.nombre, etiqueta: quien.etiqueta, novedad: esNovedad(programa, quien) },
      monto: montoDe(programa, quien),
      moneda: COP,
      estado,
      motivo: mot,
      intentosRestantes: null,
      confirmarAntesDe: null,
      segundosHastaPagado: segundos,
      creado: eventos[0].creado,
      actualizado: eventos[eventos.length - 1].creado,
      eventos,
      documento,
      llave: uuid(),
      pagandoDesde: null,
      resuelveEn: null,
      resultado: null,
    })
  }

  hecho('900000001', 'cuenta', 0, 'Pagado')
  hecho('900000003', 'retiro', 6, 'Pagado')
  hecho('900000003', 'retiro', 9, 'YaCobrado')
  hecho('900000004', 'retiro', 15, 'TopeSuperado')
  guardar(e)
  return programa.id
}

/**
 * Lo que la web ve de cada fila: funciones que eligen los campos (lista blanca). Ninguna
 * respuesta incluye token_acceso, url_gestion, uri_continuacion, token_continuacion, nonce_*
 * ni url_permiso (V-20); seguridad.test.ts lo comprueba.
 *
 * Con la base lejos (Supabase en otra región), una consulta por fila vuelve lenta la app (D-43):
 * las listas cargan primero todo lo que necesitan, una consulta por tabla y en paralelo
 * (`contextoDe`), y luego arman cada vista sin ir a la base.
 */
import { config } from '../config.js'
import { confirmarAntesDe } from '../cobros/reglas.js'
import { motivoDesdeBd } from '../cobros/mensajes.js'
import { nombreCategoria } from '../comercios/categorias.js'
import * as beneficiarios from '../db/repositorios/beneficiarios.js'
import type { FilaBeneficiario } from '../db/repositorios/beneficiarios.js'
import type { FilaCobro } from '../db/repositorios/cobros.js'
import * as comercios from '../db/repositorios/comercios.js'
import type { FilaComercio } from '../db/repositorios/comercios.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import type { FilaCuenta } from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import type { FilaEvento } from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import type { FilaPrograma } from '../db/repositorios/programas.js'
import * as puntos from '../db/repositorios/puntos.js'
import type { FilaPunto } from '../db/repositorios/puntos.js'
import * as liquidacion from '../liquidacion/cliente.js'
import type { Persona } from '../liquidacion/contrato.js'
import { enmascararLlave } from '../puente/enmascarar.js'
import { billeteraCorta } from './billeteras.js'
import { log } from './log.js'
import { aTexto } from './montos.js'

export function moneda(p: Pick<FilaPrograma, 'codigo_moneda' | 'escala_moneda'>) {
  return { codigo: p.codigo_moneda, escala: p.escala_moneda }
}

const texto = (n: number | null) => (n === null ? null : aTexto(n))
const definidos = <T>(lista: (T | null | undefined)[]) => lista.filter((x): x is T => x !== null && x !== undefined)

/** Fecha del calendario en Bogotá (UTC−5, sin horario de verano): «2026-12-31». */
export function fechaBogota(iso: string): string {
  return new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------------------------
// Programa
// ---------------------------------------------------------------------------------------------

export function vistaPrograma(p: FilaPrograma, categorias: string[] = []) {
  return {
    id: p.id,
    entidad: p.entidad,
    nombre: p.nombre,
    tipo: p.tipo,
    destino: p.destino,
    billetera: p.billetera_programa,
    billeteraCorta: billeteraCorta(p.billetera_programa),
    moneda: moneda(p),
    // Fechas del calendario, como las escribe la entidad; la BD guarda el instante exacto
    vigenciaInicio: fechaBogota(p.vigencia_inicio),
    vigenciaFin: fechaBogota(p.vigencia_fin),
    tope: texto(p.tope_total),
    montoPorPersona: aTexto(p.monto_por_persona ?? BigInt(config().LIQUIDACION_MONTO_BASE)),
    // § 11: las categorías de comercio que acepta un bono (vacío en un subsidio)
    categorias: p.tipo === 'bono' ? categorias : [],
    estado: p.estado,
    permisoActivo: p.token_acceso !== null && p.permiso_vencido_en === null,
    // D-35: el banco ya no acepta el token ni su rotación; la entidad tiene que renovarlo
    permisoVencido: (p.estado === 'Activo' || p.estado === 'Pausado') && p.permiso_vencido_en !== null,
  }
}

export async function vistasProgramas(lista: FilaPrograma[]) {
  const categorias = await comercios.categoriasDeVarios(lista.filter((p) => p.tipo === 'bono').map((p) => p.id))
  return lista.map((p) => vistaPrograma(p, categorias.get(p.id) ?? []))
}

export async function vistaProgramaDe(p: FilaPrograma) {
  return vistaPrograma(p, p.tipo === 'bono' ? await comercios.categoriasDe(p.id) : [])
}

// ---------------------------------------------------------------------------------------------
// Puntos y comercios
// ---------------------------------------------------------------------------------------------

function vistaComercioCorta(c: FilaComercio) {
  return { id: c.id, razonSocial: c.razon_social, categoria: c.categoria, categoriaNombre: nombreCategoria(c.categoria), verificado: c.verificado_en !== null }
}

export function vistaPunto(p: FilaPunto, comercio?: FilaComercio) {
  return {
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion,
    tipo: p.tipo,
    billetera: p.billetera,
    billeteraCorta: billeteraCorta(p.billetera),
    // § 11: la sede de un comercio (bonos); null en los puntos de retiro
    comercio: p.comercio_id && comercio ? vistaComercioCorta(comercio) : null,
  }
}

export async function vistasPuntos(lista: FilaPunto[]) {
  const deComercio = await comercios.deIds(definidos(lista.map((p) => p.comercio_id)))
  return lista.map((p) => vistaPunto(p, p.comercio_id ? deComercio.get(p.comercio_id) : undefined))
}

export async function vistaPuntoDe(p: FilaPunto) {
  return (await vistasPuntos([p]))[0]!
}

/** § 11: el comercio con su NIT, su actividad y sus sedes. */
export function vistaComercio(c: FilaComercio, sedes: FilaPunto[]) {
  return {
    id: c.id,
    nit: c.nit,
    razonSocial: c.razon_social,
    ciiu: c.ciiu,
    categoria: c.categoria,
    categoriaNombre: nombreCategoria(c.categoria),
    verificado: c.verificado_en !== null,
    verificadoEn: c.verificado_en,
    sedes: sedes.map((s) => vistaPunto(s, c)),
  }
}

export async function vistasComercios(lista: FilaComercio[]) {
  const sedes = await puntos.sedesDe(lista.map((c) => c.id))
  return lista.map((c) => vistaComercio(c, sedes.get(c.id) ?? []))
}

export async function vistaComercioDe(c: FilaComercio) {
  return (await vistasComercios([c]))[0]!
}

// ---------------------------------------------------------------------------------------------
// Personas y cuentas
// ---------------------------------------------------------------------------------------------

/** «C.C. de prueba 3»: lo que muestran las pantallas en lugar de la cédula completa. */
export function etiquetaPersona(b: Pick<FilaBeneficiario, 'tipo_documento' | 'numero_documento'>) {
  const tipo = b.tipo_documento === 'CC' ? 'C.C.' : b.tipo_documento
  return `${tipo} de prueba ${Number(b.numero_documento.slice(-3))}`
}

/**
 * Los nombres los tiene el gobierno (Tatú no los guarda). Si no responde, las pantallas siguen
 * funcionando con «Persona 1234».
 */
export async function nombresDe(documentos: string[]): Promise<Map<string, Persona>> {
  try {
    return await liquidacion.personas(documentos)
  } catch (e) {
    log.warn('La liquidación no respondió los nombres', { error: e })
    return new Map()
  }
}

export function nombrePersona(documento: string, nombres?: Map<string, Persona>): string {
  return nombres?.get(documento)?.nombre ?? `Persona ${documento.slice(-4)}`
}

export function vistaPersona(b: FilaBeneficiario, nombres?: Map<string, Persona>) {
  return { nombre: nombrePersona(b.numero_documento, nombres), etiqueta: etiquetaPersona(b) }
}

export function vistaCuenta(c: FilaCuenta | undefined, documento: string) {
  if (!c) return null
  return {
    id: c.id,
    documento,
    estado: c.estado,
    billetera: c.billetera,
    billeteraCorta: billeteraCorta(c.billetera),
    // Llave Bre-B (Plan Bre-B): lo que se muestra en vez de la wallet; null si es una wallet escrita a mano
    tipoLlave: c.tipo_llave,
    llave: c.tipo_llave && c.llave ? enmascararLlave(c.tipo_llave, c.llave) : null,
    verificadaEn: c.verificada_en,
  }
}

// ---------------------------------------------------------------------------------------------
// Cobros
// ---------------------------------------------------------------------------------------------

export function vistaEventos(lista: FilaEvento[]) {
  return lista.map((e) => {
    const d = eventos.detalleDe(e)
    return {
      desde: e.estado_anterior,
      hacia: e.estado_nuevo,
      texto: typeof d.texto === 'string' ? d.texto : null,
      creado: e.creado_en,
    }
  })
}

/** Todo lo que necesitan las vistas de una lista de cobros, cargado de una vez. */
export interface Contexto {
  programas: Map<string, FilaPrograma>
  puntos: Map<string, FilaPunto>
  beneficiarios: Map<string, FilaBeneficiario>
  cuentas: Map<string, FilaCuenta>
  eventos: Map<string, FilaEvento[]>
  nombres: Map<string, Persona>
}

export async function contextoDe(lista: FilaCobro[]): Promise<Contexto> {
  // Los nombres dependen de las cédulas, pero van en paralelo con el resto de las consultas
  const conNombres = beneficiarios
    .deIds(lista.map((c) => c.beneficiario_id))
    .then(async (bs) => ({ bs, nombres: await nombresDe([...bs.values()].map((b) => b.numero_documento)) }))
  const [ps, pts, cs, evs, { bs, nombres }] = await Promise.all([
    programas.deIds(lista.map((c) => c.programa_id)),
    puntos.deIds(definidos(lista.map((c) => c.punto_id))),
    cuentas.deIds(definidos(lista.map((c) => c.cuenta_id))),
    eventos.deEntidades('cobro', lista.map((c) => c.id)),
    conNombres,
  ])
  return { programas: ps, puntos: pts, beneficiarios: bs, cuentas: cs, eventos: evs, nombres }
}

/** Segundos entre el PIN (o la solicitud, en el canal cuenta) y Pagado, sacados de evento. */
function segundosHastaPagado(c: FilaCobro, lista: FilaEvento[]): number | null {
  if (c.estado !== 'Pagado') return null
  const pagado = eventos.ultimoHaciaEn(lista, 'Pagado')?.creado_en
  const desde = eventos.ultimoHaciaEn(lista, c.canal === 'cuenta' ? 'Solicitado' : 'Pagando')?.creado_en
  if (!pagado || !desde) return null
  return Math.round((Date.parse(pagado) - Date.parse(desde)) / 100) / 10
}

/** ¿La liquidación marcó este pago como novedad (retroactivo)? Se anota al solicitar. */
function esNovedad(lista: FilaEvento[]): boolean {
  const primero = lista[0]
  return primero ? eventos.detalleDe(primero).novedad === true : false
}

/** El cobro completo, con su línea de tiempo (Plan backend § 7, ejemplo). */
export function vistaCobro(c: FilaCobro, ctx: Contexto, opciones: { eventos?: boolean } = { eventos: true }) {
  const p = ctx.programas.get(c.programa_id)!
  const punto = c.punto_id ? ctx.puntos.get(c.punto_id) : undefined
  const persona = ctx.beneficiarios.get(c.beneficiario_id)!
  const cuenta = c.cuenta_id ? ctx.cuentas.get(c.cuenta_id) : undefined
  const lista = ctx.eventos.get(c.id) ?? []
  const { CONFIRMACION_TTL_SEG, PIN_MAX_INTENTOS } = config()
  return {
    id: c.id,
    referencia: c.referencia,
    programa: { id: p.id, nombre: p.nombre },
    canal: c.canal,
    punto: punto ? { id: punto.id, nombre: punto.nombre, billeteraCorta: billeteraCorta(punto.billetera) } : null,
    cuenta: cuenta ? { billetera: cuenta.billetera, billeteraCorta: billeteraCorta(cuenta.billetera) } : null,
    persona: { ...vistaPersona(persona, ctx.nombres), novedad: esNovedad(lista) },
    monto: texto(c.monto),
    totalCompra: texto(c.total_compra),
    moneda: moneda(p),
    estado: c.estado,
    motivo: motivoDesdeBd(c.motivo_rechazo),
    intentosRestantes: c.estado === 'PorConfirmar' ? Math.max(0, PIN_MAX_INTENTOS - c.intentos_pin) : null,
    confirmarAntesDe: c.estado === 'PorConfirmar' ? confirmarAntesDe(c.creado_en, CONFIRMACION_TTL_SEG) : null,
    segundosHastaPagado: segundosHastaPagado(c, lista),
    creado: c.creado_en,
    actualizado: c.actualizado_en,
    ...(opciones.eventos ? { eventos: vistaEventos(lista) } : {}),
  }
}

export type VistaCobro = ReturnType<typeof vistaCobro>

export async function vistasCobros(lista: FilaCobro[], opciones: { eventos?: boolean } = { eventos: true }) {
  const ctx = await contextoDe(lista)
  return lista.map((c) => vistaCobro(c, ctx, opciones))
}

export async function vistaCobroDe(c: FilaCobro, opciones: { eventos?: boolean } = { eventos: true }) {
  return vistaCobro(c, await contextoDe([c]), opciones)
}

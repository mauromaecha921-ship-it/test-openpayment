/**
 * Lo que la web ve de cada fila: funciones que eligen los campos (lista blanca). Ninguna
 * respuesta incluye token_acceso, url_gestion, uri_continuacion, token_continuacion, nonce_*
 * ni url_permiso (V-20); seguridad.test.ts lo comprueba.
 */
import { config } from '../config.js'
import { confirmarAntesDe } from '../cobros/reglas.js'
import { motivoDesdeBd } from '../cobros/mensajes.js'
import * as beneficiarios from '../db/repositorios/beneficiarios.js'
import type { FilaBeneficiario } from '../db/repositorios/beneficiarios.js'
import type { FilaCobro } from '../db/repositorios/cobros.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import type { FilaCuenta } from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import type { FilaPrograma } from '../db/repositorios/programas.js'
import * as puntos from '../db/repositorios/puntos.js'
import type { FilaPunto } from '../db/repositorios/puntos.js'
import { billeteraCorta } from './billeteras.js'
import { aTexto } from './montos.js'

export function moneda(p: Pick<FilaPrograma, 'codigo_moneda' | 'escala_moneda'>) {
  return { codigo: p.codigo_moneda, escala: p.escala_moneda }
}

const texto = (n: number | null) => (n === null ? null : aTexto(n))

/** Fecha del calendario en Bogotá (UTC−5, sin horario de verano): «2026-12-31». */
export function fechaBogota(iso: string): string {
  return new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 10)
}

export function vistaPrograma(p: FilaPrograma) {
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
    estado: p.estado,
    permisoActivo: p.token_acceso !== null && p.permiso_vencido_en === null,
    // D-35: el banco ya no acepta el token ni su rotación; la entidad tiene que renovarlo
    permisoVencido: (p.estado === 'Activo' || p.estado === 'Pausado') && p.permiso_vencido_en !== null,
  }
}

export function vistaPunto(p: FilaPunto) {
  return {
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion,
    tipo: p.tipo,
    billetera: p.billetera,
    billeteraCorta: billeteraCorta(p.billetera),
  }
}

/** «C.C. de prueba 3»: lo que muestran las pantallas en lugar de la cédula completa. */
export function etiquetaPersona(b: Pick<FilaBeneficiario, 'tipo_documento' | 'numero_documento'>) {
  const tipo = b.tipo_documento === 'CC' ? 'C.C.' : b.tipo_documento
  return `${tipo} de prueba ${Number(b.numero_documento.slice(-3))}`
}

export function vistaPersona(b: FilaBeneficiario) {
  return { nombre: b.primer_nombre, etiqueta: etiquetaPersona(b) }
}

export function vistaCuenta(c: FilaCuenta | undefined) {
  if (!c) return null
  const b = beneficiarios.obtener(c.beneficiario_id)!
  return {
    id: c.id,
    documento: b.numero_documento,
    estado: c.estado,
    billetera: c.billetera,
    billeteraCorta: billeteraCorta(c.billetera),
    verificadaEn: c.verificada_en,
  }
}

export function vistaEventos(tipo: eventos.TipoEntidad, id: string) {
  return eventos.deEntidad(tipo, id).map((e) => {
    const d = eventos.detalleDe(e)
    return {
      desde: e.estado_anterior,
      hacia: e.estado_nuevo,
      texto: typeof d.texto === 'string' ? d.texto : null,
      creado: e.creado_en,
    }
  })
}

/** Segundos entre el PIN (o la solicitud, en el canal cuenta) y Pagado, sacados de evento. */
function segundosHastaPagado(c: FilaCobro): number | null {
  if (c.estado !== 'Pagado') return null
  const pagado = eventos.ultimoHacia('cobro', c.id, 'Pagado')?.creado_en
  const desde = eventos.ultimoHacia('cobro', c.id, c.canal === 'cuenta' ? 'Solicitado' : 'Pagando')?.creado_en
  if (!pagado || !desde) return null
  return Math.round((Date.parse(pagado) - Date.parse(desde)) / 100) / 10
}

/** ¿La liquidación marcó este pago como novedad (retroactivo)? Se anota al solicitar. */
function esNovedad(c: FilaCobro): boolean {
  const primero = eventos.deEntidad('cobro', c.id)[0]
  return primero ? eventos.detalleDe(primero).novedad === true : false
}

/** El cobro completo, con su línea de tiempo (Plan backend § 7, ejemplo). */
export function vistaCobro(c: FilaCobro, opciones: { eventos?: boolean } = { eventos: true }) {
  const p = programas.obtener(c.programa_id)!
  const punto = c.punto_id ? puntos.obtener(c.punto_id) : undefined
  const persona = beneficiarios.obtener(c.beneficiario_id)!
  const cuenta = c.cuenta_id ? cuentas.obtener(c.cuenta_id) : undefined
  const { CONFIRMACION_TTL_SEG, PIN_MAX_INTENTOS } = config()
  return {
    id: c.id,
    referencia: c.referencia,
    programa: { id: p.id, nombre: p.nombre },
    canal: c.canal,
    punto: punto ? { id: punto.id, nombre: punto.nombre, billeteraCorta: billeteraCorta(punto.billetera) } : null,
    cuenta: cuenta ? { billetera: cuenta.billetera, billeteraCorta: billeteraCorta(cuenta.billetera) } : null,
    persona: { ...vistaPersona(persona), novedad: esNovedad(c) },
    monto: texto(c.monto),
    totalCompra: texto(c.total_compra),
    moneda: moneda(p),
    estado: c.estado,
    motivo: motivoDesdeBd(c.motivo_rechazo),
    intentosRestantes: c.estado === 'PorConfirmar' ? Math.max(0, PIN_MAX_INTENTOS - c.intentos_pin) : null,
    confirmarAntesDe: c.estado === 'PorConfirmar' ? confirmarAntesDe(c.creado_en, CONFIRMACION_TTL_SEG) : null,
    segundosHastaPagado: segundosHastaPagado(c),
    creado: c.creado_en,
    actualizado: c.actualizado_en,
    ...(opciones.eventos ? { eventos: vistaEventos('cobro', c.id) } : {}),
  }
}

export type VistaCobro = ReturnType<typeof vistaCobro>

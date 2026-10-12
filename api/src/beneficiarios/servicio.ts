/**
 * Registro del equipo (Plan de ajustes § 2): una persona es su cédula y su wallet. La cuenta queda
 * Verificada de una vez, porque la registra el mismo equipo con su propia wallet; la verificación
 * en el banco (HU-07) sigue disponible en «Mi cuenta». El PIN es opcional: sin él la persona solo
 * cobra a su cuenta.
 *
 * Atajo del piloto: escribe directo en la liquidación simulada (misma BD y misma transacción). En
 * producción la liquidación es el sistema de la entidad (AD-12) y la inscripción pasaría por ella.
 */
import { randomUUID } from 'node:crypto'
import * as reglas from '../cobros/reglas.js'
import { billeteraCorta } from '../comun/billeteras.js'
import { fechaBogota, moneda } from '../comun/vistas.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as programas from '../db/repositorios/programas.js'
import * as clienteLiquidacion from '../liquidacion/cliente.js'
import { conflicto } from '../comun/errores.js'
import type { Moneda } from '../comun/montos.js'
import { ahoraIso, esRestriccion, transaccion } from '../db/conexion.js'
import * as repo from '../db/repositorios/beneficiarios.js'
import type { FilaBeneficiario } from '../db/repositorios/beneficiarios.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as liquidacion from '../liquidacion/datos.js'
import * as op from '../openPaymentsService.js'
import { resolverWallet } from '../programas/servicio.js'

export interface EntradaPersona {
  documento: string
  billetera: string
  /** Si no llega, se usa el nombre público de la wallet. */
  nombre?: string
  pin?: string
}

const YA_EXISTE = 'Esa cédula ya está registrada'

/** «Ana María Pérez» → Ana · María Pérez. Sin nombre, «Persona 1234». */
function partirNombre(nombre: string | undefined, documento: string) {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return { primer_nombre: `Persona ${documento.slice(-4)}`, primer_apellido: '' }
  return { primer_nombre: partes[0]!.slice(0, 40), primer_apellido: partes.slice(1).join(' ').slice(0, 80) }
}

function vista(b: FilaBeneficiario, moneda: Moneda | null) {
  const c = cuentas.ultimaDe(b.id)
  return {
    documento: b.numero_documento,
    nombre: [b.primer_nombre, b.primer_apellido].filter(Boolean).join(' '),
    billetera: c?.billetera ?? null,
    billeteraCorta: c ? billeteraCorta(c.billetera) : null,
    moneda,
    estadoCuenta: c?.estado ?? null,
    tienePin: liquidacion.tienePin(b.numero_documento),
    registrado: repo.creadoEn(b.id),
  }
}

export async function registrar(e: EntradaPersona) {
  if (repo.porDocumento(e.documento) || liquidacion.existe(e.documento)) throw conflicto('PersonaExiste', YA_EXISTE)

  const w = await resolverWallet(e.billetera)
  const billetera = w.id.replace(/\/+$/, '')
  const otra = cuentas.vigentePorBilletera(billetera)
  if (otra) {
    const duena = repo.obtener(otra.beneficiario_id)
    throw conflicto('BilleteraEnUso', `Esa wallet ya está registrada para ${duena?.primer_nombre ?? 'otra persona'}`)
  }

  const id = randomUUID()
  const cuentaId = randomUUID()
  try {
    transaccion(() => {
      repo.crear({ id, numero_documento: e.documento, ...partirNombre(e.nombre || w.nombre, e.documento) })
      cuentas.crear({
        id: cuentaId,
        beneficiario_id: id,
        billetera,
        estado: 'Verificada',
        verificada_en: ahoraIso(),
        nonce_cliente: null,
        nonce_cierre: null,
        uri_continuacion: null,
        token_continuacion: null,
      })
      eventos.registrar({
        tipo: 'cuenta',
        id: cuentaId,
        hacia: 'Verificada',
        detalle: { texto: 'Registrada por el equipo con la wallet de la persona; no se pidió confirmación al banco.', registro: true },
      })
      liquidacion.registrar(e.documento, e.pin)
    })
  } catch (err) {
    // Dos registros de la misma cédula al mismo tiempo: la BD deja pasar solo uno
    if (esRestriccion(err)) throw conflicto('PersonaExiste', YA_EXISTE)
    throw err
  }
  return vista(repo.obtener(id)!, { codigo: w.codigoMoneda, escala: w.escala })
}

export interface PagoPendiente {
  programa: { id: string; nombre: string; estado: string }
  monto: string
  moneda: Moneda
  vigenciaFin: string
}

/**
 * Todos los subsidios que la persona tiene por cobrar: programas Activos o Pausados donde no ha
 * cobrado y la liquidación tiene un pago para su cédula. Con `soloQueReciben`, solo los que hoy
 * aceptan cobros (Activos y en vigencia): es lo que puede pagar un punto.
 */
export async function pagosPendientes(b: FilaBeneficiario, { soloQueReciben = false } = {}) {
  const propios = cobros.deBeneficiario(b.id)
  const ahora = new Date()
  const pagos: PagoPendiente[] = []
  let liquidacionDisponible = true
  for (const p of programas.listar().filter((x) => x.estado === 'Activo' || x.estado === 'Pausado')) {
    if (propios.some((c) => c.programa_id === p.id && c.estado === 'Pagado')) continue
    if (soloQueReciben && reglas.rn06ProgramaRecibe({ estado: p.estado, vigenciaInicio: p.vigencia_inicio, vigenciaFin: p.vigencia_fin, ahora })) continue
    // Con el permiso vencido (D-35) el pago fallaría: el punto no lo ofrece hasta que la entidad lo renueve
    if (soloQueReciben && p.permiso_vencido_en) continue
    try {
      const disponible = await clienteLiquidacion.pago(p.id, b.numero_documento)
      if (!disponible.disponible) continue
      pagos.push({
        programa: { id: p.id, nombre: p.nombre, estado: p.estado },
        monto: disponible.monto,
        moneda: moneda(p),
        vigenciaFin: fechaBogota(p.vigencia_fin),
      })
    } catch {
      liquidacionDisponible = false
    }
  }
  return { pagos, liquidacionDisponible }
}

/** La moneda de la wallet, sin colgar la lista si la Test Wallet tarda o no la encuentra. */
async function monedaDe(billetera: string): Promise<Moneda | null> {
  let reloj: NodeJS.Timeout | undefined
  const limite = new Promise<null>((ok) => {
    reloj = setTimeout(() => ok(null), 4000)
  })
  const lectura = op
    .leerWallet(billetera)
    .then((w) => ({ codigo: w.codigoMoneda, escala: w.escala }))
    .catch(() => null)
  try {
    return await Promise.race([lectura, limite])
  } finally {
    clearTimeout(reloj)
  }
}

export async function listar() {
  return Promise.all(
    repo.listar().map(async (b) => {
      const c = cuentas.ultimaDe(b.id)
      return vista(b, c ? await monedaDe(c.billetera) : null)
    }),
  )
}

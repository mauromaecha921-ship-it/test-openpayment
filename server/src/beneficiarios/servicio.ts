/**
 * Registro del equipo (Plan de ajustes § 2): una persona es su cédula y su wallet. La cuenta queda
 * Verificada de una vez, porque la registra el mismo equipo con su propia wallet; la verificación
 * en el banco (HU-07) sigue disponible en «Mi cuenta». El PIN es opcional: sin él la persona solo
 * cobra a su cuenta.
 *
 * Tatú guarda lo mínimo (Plan Supabase y pnpm § 3): la cédula y la wallet. El nombre y el PIN los
 * inscribe «Equipo de prueba» en el gobierno (la liquidación simulada), por HTTP.
 *
 * Plan Bre-B: con `cobraCon: 'llaveCedula'`, «Equipo de prueba» hace también de banco de la persona
 * y registra su cédula como llave Bre-B en el banco puente simulado, apuntando a su wallet. Tatú no
 * le enlaza cuenta: al cobrar, RN-17 encuentra la llave sola.
 */
import { randomUUID } from 'node:crypto'
import * as reglas from '../cobros/reglas.js'
import { billeteraCorta } from '../comun/billeteras.js'
import { conflicto } from '../comun/errores.js'
import type { Moneda } from '../comun/montos.js'
import { fechaBogota, moneda, nombresDe, nombrePersona } from '../comun/vistas.js'
import { ahoraIso, esRestriccion, transaccion } from '../db/conexion.js'
import * as repo from '../db/repositorios/beneficiarios.js'
import type { FilaBeneficiario } from '../db/repositorios/beneficiarios.js'
import * as cobros from '../db/repositorios/cobros.js'
import * as cuentas from '../db/repositorios/cuentas.js'
import type { FilaCuenta } from '../db/repositorios/cuentas.js'
import * as eventos from '../db/repositorios/eventos.js'
import * as programas from '../db/repositorios/programas.js'
import * as puntos from '../db/repositorios/puntos.js'
import * as liquidacion from '../liquidacion/cliente.js'
import type { Persona } from '../liquidacion/contrato.js'
import * as op from '../openPaymentsService.js'
import { resolverWallet } from '../programas/servicio.js'
import * as puente from '../puente/cliente.js'

export interface EntradaPersona {
  documento: string
  billetera: string
  /** Si no llega, se usa el nombre público de la wallet. */
  nombre?: string
  pin?: string
  /** «llaveCedula»: su cédula queda como llave Bre-B y Tatú no le enlaza cuenta (Plan Bre-B). */
  cobraCon?: 'wallet' | 'llaveCedula'
}

const YA_EXISTE = 'Esa cédula ya está registrada'

/** El nombre que se inscribe: el escrito, el público de la wallet o «Persona 1234». */
function nombreParaInscribir(nombre: string | undefined, documento: string): string {
  const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  return limpio || `Persona ${documento.slice(-4)}`
}

function vista(b: FilaBeneficiario, c: FilaCuenta | undefined, enGobierno: Map<string, Persona>, monedaCuenta: Moneda | null) {
  return {
    documento: b.numero_documento,
    nombre: nombrePersona(b.numero_documento, enGobierno),
    billetera: c?.billetera ?? null,
    billeteraCorta: c ? billeteraCorta(c.billetera) : null,
    moneda: monedaCuenta,
    estadoCuenta: c?.estado ?? null,
    tienePin: enGobierno.get(b.numero_documento)?.tienePin ?? false,
    registrado: b.creado_en,
  }
}

export async function registrar(e: EntradaPersona) {
  if (await repo.porDocumento(e.documento)) throw conflicto('PersonaExiste', YA_EXISTE)
  const w = await resolverWallet(e.billetera)
  const billetera = w.id.replace(/\/+$/, '')
  const conLlave = e.cobraCon === 'llaveCedula'
  const otra = conLlave ? undefined : await cuentas.vigentePorBilletera(billetera)
  if (otra) {
    const duena = await repo.obtener(otra.beneficiario_id)
    const nombres = duena ? await nombresDe([duena.numero_documento]) : new Map<string, Persona>()
    throw conflicto('BilleteraEnUso', `Esa wallet ya está registrada para ${duena ? nombrePersona(duena.numero_documento, nombres) : 'otra persona'}`)
  }

  // 1. El gobierno (por HTTP). Inscribir es idempotente: si lo que sigue falla, se puede repetir.
  const inscrita = await liquidacion.inscribir(e.documento, nombreParaInscribir(e.nombre || w.nombre, e.documento), e.pin)
  // 1b. Su banco (el puente simulado): la cédula como llave Bre-B. También idempotente.
  if (conLlave) {
    await puente.registrarLlave({ tipo: 'cedula', valor: e.documento, documentoTitular: e.documento, nombreTitular: inscrita.nombre, billetera })
  }

  // 2. Tatú: solo la cédula y la cuenta
  let b: FilaBeneficiario
  try {
    b = await transaccion(async () => {
      const nueva = await repo.crear({ numero_documento: e.documento })
      if (conLlave) return nueva
      const cuentaId = randomUUID()
      await cuentas.crear({ id: cuentaId, beneficiario_id: nueva.id, billetera, estado: 'Verificada', verificada_en: ahoraIso() })
      await eventos.registrar({
        tipo: 'cuenta',
        id: cuentaId,
        hacia: 'Verificada',
        detalle: { texto: 'Registrada por el equipo con la wallet de la persona; no se pidió confirmación al banco.', registro: true },
        actor: 'entidad',
      })
      return nueva
    })
  } catch (err) {
    // Dos registros de la misma cédula (o la misma wallet) al mismo tiempo: la BD deja pasar solo uno
    if (esRestriccion(err)) throw conflicto('PersonaExiste', YA_EXISTE)
    throw err
  }
  return vista(b, await cuentas.ultimaDe(b.id), new Map([[inscrita.documento, inscrita]]), { codigo: w.codigoMoneda, escala: w.escala })
}

export interface PagoPendiente {
  programa: { id: string; nombre: string; estado: string; tipo: 'subsidio' | 'bono' }
  monto: string
  moneda: Moneda
  vigenciaFin: string
}

/**
 * Todos los subsidios que la persona tiene por cobrar: programas Activos o Pausados donde no ha
 * cobrado y la liquidación tiene un pago para su cédula. Con `soloQueReciben`, solo los que hoy
 * aceptan cobros (Activos y en vigencia): es lo que puede pagar un punto.
 */
export async function pagosPendientes(b: FilaBeneficiario, { soloQueReciben = false, puntoId }: { soloQueReciben?: boolean; puntoId?: string } = {}) {
  const [punto, propios, todos] = await Promise.all([
    puntoId ? puntos.obtener(puntoId) : Promise.resolve(undefined),
    cobros.deBeneficiario(b.id),
    programas.listar(),
  ])
  const ahora = new Date()
  const candidatos = []
  for (const p of todos.filter((x) => x.estado === 'Activo' || x.estado === 'Pausado')) {
    if (propios.some((c) => c.programa_id === p.id && c.estado === 'Pagado')) continue
    if (soloQueReciben && reglas.rn06ProgramaRecibe({ estado: p.estado, vigenciaInicio: p.vigencia_inicio, vigenciaFin: p.vigencia_fin, ahora })) continue
    // Con el permiso vencido (D-35) el pago fallaría: el punto no lo ofrece hasta que la entidad lo renueve
    if (soloQueReciben && p.permiso_vencido_en) continue
    // § 11: un punto de retiro paga subsidios; una sede de comercio, los bonos que acepta
    if (punto && (punto.tipo === 'retiro' ? p.destino !== 'libre' : p.destino !== 'restringido' || !(await puntos.autorizadoEnPrograma(p.id, punto.id)))) continue
    candidatos.push(p)
  }

  // La liquidación de cada programa, en paralelo
  let liquidacionDisponible = true
  const consultas = await Promise.all(
    candidatos.map(async (p) => {
      try {
        return { p, pago: await liquidacion.pago(p.id, b.numero_documento) }
      } catch {
        liquidacionDisponible = false
        return { p, pago: null }
      }
    }),
  )
  const pagos: PagoPendiente[] = []
  for (const { p, pago } of consultas) {
    if (!pago?.disponible) continue
    pagos.push({
      programa: { id: p.id, nombre: p.nombre, estado: p.estado, tipo: p.tipo },
      monto: pago.monto,
      moneda: moneda(p),
      vigenciaFin: fechaBogota(p.vigencia_fin),
    })
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
  const lista = await repo.listar()
  const [ultimas, enGobierno] = await Promise.all([
    cuentas.ultimasDe(lista.map((b) => b.id)),
    nombresDe(lista.map((b) => b.numero_documento)),
  ])
  return Promise.all(
    lista.map(async (b) => {
      const c = ultimas.get(b.id)
      return vista(b, c, enGobierno, c ? await monedaDe(c.billetera) : null)
    }),
  )
}

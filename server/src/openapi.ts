import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { z } from 'zod'
import { EntradaPersona } from './beneficiarios/rutas.js'
import { Confirmacion, EntradaCobro } from './cobros/rutas.js'
import { ESTADOS_COBRO } from './cobros/estados.js'
import { EntradaComercio, EntradaSede } from './comercios/rutas.js'
import { EntradaCuenta } from './cuentas/rutas.js'
import { Inscripcion, NuevoPin, PagoDisponible, PedidoPin, Persona as PersonaDelGobierno, Personas, Resumen, RespuestaPin, SinPago } from './liquidacion/contrato.js'
import { Coincidencia, Llave, Llaves, PedidoPertenece, Resolucion } from './puente/contrato.js'
import { ESTADOS_PROGRAMA } from './programas/estados.js'
import { Callback, Cierre, EdicionPrograma, EntradaPrograma } from './programas/rutas.js'
import { EntradaPunto, Periodo } from './puntos/rutas.js'

/**
 * Swagger del piloto: GET /api/openapi.json y la página en /api/docs. Las entradas salen de los
 * mismos esquemas Zod que validan las rutas; las respuestas, de las vistas (comun/vistas.ts).
 * openapi.test.ts revisa que cada ruta montada esté aquí. Catálogo: docs/piloto/API del piloto.md.
 */

// ── Respuestas (solo documentan; la forma real la dan las vistas) ──

const monto = z.string().describe('Monto en unidades mínimas de la moneda: «23000000» con escala 2 es $230.000')
const Moneda = z.object({ codigo: z.string().meta({ example: 'COP' }), escala: z.number().int().meta({ example: 2 }) })
const ErrorRespuesta = z.object({
  error: z.object({
    codigo: z.string().meta({ example: 'EntradaInvalida' }),
    mensaje: z.string().meta({ example: 'documento: documento inválido' }),
  }),
})

const Programa = z.object({
  id: z.guid(),
  entidad: z.string(),
  nombre: z.string(),
  tipo: z.enum(['subsidio', 'bono']),
  destino: z.enum(['libre', 'restringido']),
  billetera: z.string(),
  billeteraCorta: z.string(),
  moneda: Moneda,
  vigenciaInicio: z.string().meta({ example: '2026-10-16' }),
  vigenciaFin: z.string().meta({ example: '2026-12-31' }),
  tope: monto.nullable(),
  montoPorPersona: monto,
  categorias: z.array(z.string()),
  estado: z.enum(ESTADOS_PROGRAMA),
  permisoActivo: z.boolean(),
  permisoVencido: z.boolean(),
})

const ComercioCorto = z.object({ id: z.guid(), razonSocial: z.string(), categoria: z.string(), categoriaNombre: z.string(), verificado: z.boolean() })
const Punto = z.object({
  id: z.guid(),
  nombre: z.string(),
  direccion: z.string(),
  tipo: z.enum(['retiro', 'compra']),
  billetera: z.string(),
  billeteraCorta: z.string(),
  comercio: ComercioCorto.nullable().describe('La sede de un comercio (bonos); null en un punto de retiro'),
})

const Comercio = z.object({
  id: z.guid(),
  nit: z.string(),
  razonSocial: z.string(),
  ciiu: z.string(),
  categoria: z.string(),
  categoriaNombre: z.string(),
  verificado: z.boolean(),
  verificadoEn: z.string().nullable(),
  sedes: z.array(Punto),
})

const Cuenta = z.object({
  id: z.guid(),
  documento: z.string(),
  estado: z.enum(['SinEnlazar', 'PorVerificar', 'Verificada']),
  billetera: z.string(),
  billeteraCorta: z.string(),
  tipoLlave: z.enum(['cedula', 'celular', 'correo', 'alfanumerica']).nullable().describe('Llave Bre-B (Plan Bre-B); null si es una wallet escrita a mano'),
  llave: z.string().nullable().describe('La llave enmascarada: «300***4567»'),
  verificadaEn: z.string().nullable(),
})

const Persona = z.object({ nombre: z.string(), etiqueta: z.string().meta({ example: 'C.C. de prueba 3' }) })

const Cobro = z.object({
  id: z.guid(),
  referencia: z.string(),
  programa: z.object({ id: z.guid(), nombre: z.string() }),
  canal: z.enum(['cuenta', 'retiro', 'compra']),
  punto: z.object({ id: z.guid(), nombre: z.string(), billeteraCorta: z.string() }).nullable(),
  cuenta: z.object({ billetera: z.string(), billeteraCorta: z.string() }).nullable(),
  persona: Persona.extend({ novedad: z.boolean() }),
  monto: monto.nullable(),
  totalCompra: monto.nullable(),
  moneda: Moneda,
  estado: z.enum(ESTADOS_COBRO),
  motivo: z.object({}).loose().nullable().describe('Por qué se rechazó o falló, con el texto para la pantalla'),
  intentosRestantes: z.number().int().nullable(),
  confirmarAntesDe: z.string().nullable(),
  segundosHastaPagado: z.number().nullable(),
  creado: z.string(),
  actualizado: z.string(),
  eventos: z
    .array(z.object({ desde: z.string().nullable(), hacia: z.string(), texto: z.string().nullable(), creado: z.string() }))
    .optional()
    .describe('La línea de tiempo; solo en GET /cobros/:id y al crear o confirmar'),
})

const PagoPendiente = z.object({
  programa: z.object({ id: z.guid(), nombre: z.string(), estado: z.enum(ESTADOS_PROGRAMA), tipo: z.enum(['subsidio', 'bono']) }),
  monto,
  moneda: Moneda,
  vigenciaFin: z.string(),
})

/** Un esquema de components (Programa, Cobro…) dentro de una respuesta. */
const aRef = (nombre: string) => z.unknown().meta({ $ref: `#/components/schemas/${nombre}` })
const refNulo = (nombre: string) => z.unknown().meta({ anyOf: [{ $ref: `#/components/schemas/${nombre}` }, { type: 'null' }] })

const ConRedirect = (clave: string, esquema: string) =>
  z.object({
    redirect: z.string().nullable().describe('URL de la Test Wallet donde se aprueba (se abre en el navegador)'),
    [clave]: aRef(esquema),
  })

const COMPONENTES = { Error: ErrorRespuesta, Moneda, Programa, Punto, Comercio, Cuenta, Cobro, PagoPendiente }

// ── Rutas ──

type Respuesta = string | { descripcion: string; esquema: z.ZodType | keyof typeof COMPONENTES | Array<keyof typeof COMPONENTES> }

interface Ruta {
  metodo: 'get' | 'post' | 'patch' | 'delete'
  ruta: string
  etiqueta: string
  resumen: string
  descripcion?: string
  cuerpo?: z.ZodType
  consulta?: z.ZodObject
  respuestas: Record<number, Respuesta>
}

const PROGRAMAS = 'Programas'
const PERSONAS = 'Personas y cuentas'
const COBROS = 'Cobros'
const PUNTOS = 'Puntos y wallets'
const COMERCIOS = 'Comercios y bonos'
const LIQUIDACION = 'Liquidación simulada'
const PUENTE = 'Banco puente Bre-B (simulado)'
const SALUD = 'Salud y configuración'

const ok = (descripcion: string, esquema: Exclude<Respuesta, string>['esquema']) => ({ descripcion, esquema })
const programa = ok('El programa', 'Programa')
const conAprobacion = ok('El programa y la URL para aprobar en la Test Wallet', ConRedirect('programa', 'Programa'))
const sinPrograma = 'No existe ese programa'
const estadoNoPermite = 'El estado del programa no lo permite (EstadoNoPermite, TransicionNoPermitida…)'
const fallaOp = 'Open Payments respondió con error (ErrorOpenPayments)'
const sinOp = 'Open Payments no está configurado o no responde'
const regreso = 'Redirige a la web con el resultado (aprobado, rechazado, invalido, vencido)'

export const RUTAS: Ruta[] = [
  // 1. Programas
  { metodo: 'get', ruta: '/programas', etiqueta: PROGRAMAS, resumen: 'Lista los programas', respuestas: { 200: ok('Los programas', ['Programa']) } },
  {
    metodo: 'post',
    ruta: '/programas',
    etiqueta: PROGRAMAS,
    resumen: 'Crea un programa en Borrador',
    descripcion: 'Toma la moneda de la wallet que paga. Un bono lleva sus categorías de comercio.',
    cuerpo: EntradaPrograma,
    respuestas: { 201: programa, 400: 'Entrada inválida', 404: 'La wallet no existe (BilleteraNoEncontrada)', 409: 'BonoSinCategorias', 503: sinOp },
  },
  { metodo: 'get', ruta: '/programas/:id', etiqueta: PROGRAMAS, resumen: 'Lee un programa', respuestas: { 200: programa, 404: sinPrograma } },
  {
    metodo: 'patch',
    ruta: '/programas/:id',
    etiqueta: PROGRAMAS,
    resumen: 'Edita un borrador',
    cuerpo: EdicionPrograma,
    respuestas: { 200: programa, 400: 'Entrada inválida', 404: sinPrograma, 409: estadoNoPermite },
  },
  {
    metodo: 'get',
    ruta: '/programas/:id/liquidacion',
    etiqueta: PROGRAMAS,
    resumen: 'Cuántas personas y el total: será el tope',
    respuestas: { 200: ok('Resumen de la liquidación', Resumen.extend({ moneda: Moneda })), 404: sinPrograma, 503: 'La liquidación no responde' },
  },
  {
    metodo: 'post',
    ruta: '/programas/:id/autorizar',
    etiqueta: PROGRAMAS,
    resumen: 'Fija el tope y pide el permiso al banco',
    descripcion: 'Pasa a EsperandoAprobacion. La entidad abre `redirect` y aprueba en la Test Wallet; el banco vuelve a `GET /callback/{id}`.',
    respuestas: { 200: conAprobacion, 404: sinPrograma, 409: `${estadoNoPermite}; SinLiquidacion`, 502: fallaOp, 503: sinOp },
  },
  {
    metodo: 'get',
    ruta: '/callback/:id',
    etiqueta: PROGRAMAS,
    resumen: 'Vuelta desde la Test Wallet (programa)',
    descripcion: 'La llama el navegador al volver del banco. Verifica el hash, activa el programa (o completa la renovación) y redirige a la web.',
    consulta: Callback,
    respuestas: { 302: regreso },
  },
  {
    metodo: 'post',
    ruta: '/programas/:id/cancelar-aprobacion',
    etiqueta: PROGRAMAS,
    resumen: 'Cancela la aprobación pendiente y vuelve a Borrador',
    respuestas: { 200: programa, 404: sinPrograma, 409: estadoNoPermite },
  },
  {
    metodo: 'post',
    ruta: '/programas/:id/renovar-permiso',
    etiqueta: PROGRAMAS,
    resumen: 'Pide un permiso nuevo por lo que falta del tope',
    descripcion: 'Solo si el permiso venció (la API estuvo apagada). Lo ya cobrado se conserva (D-35).',
    respuestas: { 200: conAprobacion, 404: sinPrograma, 409: `${estadoNoPermite}; PermisoVigente, TopeAgotado`, 502: fallaOp, 503: sinOp },
  },
  {
    metodo: 'get',
    ruta: '/programas/:id/tablero',
    etiqueta: PROGRAMAS,
    resumen: 'Tablero de la entidad',
    descripcion: 'Autorizado, cobrado (leído del permiso), lo que no ha salido, cobros por canal, tiempo de reembolso y la lista de cobros.',
    respuestas: {
      200: ok(
        'El tablero',
        z.object({
          programa: aRef('Programa'),
          moneda: Moneda,
          autorizado: monto,
          cobrado: monto,
          fuente: z.string(),
          noHaSalido: monto,
          cobrosPagados: z.number().int(),
          porCanal: z.record(z.enum(['cuenta', 'retiro', 'compra']), z.object({ cobros: z.number().int(), monto })),
          reembolsoSegundos: z.number().nullable(),
          giradoPorAdelantado: z.literal('0'),
          sinCobrar: z.unknown(),
          cobrosPagando: z.number().int(),
          rechazadosYFallidos: z.number().int(),
          cobros: z.array(aRef('Cobro')),
          cierre: z.object({ autorizado: monto, cobrado: monto, nuncaSalio: monto, cerradoEn: z.string() }).nullable(),
          actualizado: z.string(),
        }),
      ),
      404: sinPrograma,
    },
  },
  { metodo: 'post', ruta: '/programas/:id/pausar', etiqueta: PROGRAMAS, resumen: 'Pausa los cobros', respuestas: { 200: programa, 404: sinPrograma, 409: estadoNoPermite } },
  { metodo: 'post', ruta: '/programas/:id/reanudar', etiqueta: PROGRAMAS, resumen: 'Reanuda los cobros', respuestas: { 200: programa, 404: sinPrograma, 409: estadoNoPermite } },
  {
    metodo: 'post',
    ruta: '/programas/:id/cerrar',
    etiqueta: PROGRAMAS,
    resumen: 'Cierra el programa y revoca el permiso',
    descripcion: 'Hay que escribir `CERRAR`. Guarda lo que nunca salió.',
    cuerpo: Cierre,
    respuestas: { 200: programa, 400: 'Falta escribir CERRAR (ConfirmacionRequerida)', 404: sinPrograma, 409: `${estadoNoPermite}; CobrosEnCurso` },
  },
  {
    metodo: 'get',
    ruta: '/programas/:id/comercios',
    etiqueta: COMERCIOS,
    resumen: 'Sedes donde se puede usar el bono',
    respuestas: { 200: ok('Las sedes autorizadas', ['Punto']), 404: sinPrograma },
  },

  // 2. Personas y cuentas
  {
    metodo: 'get',
    ruta: '/beneficiarios/demo',
    etiqueta: PERSONAS,
    resumen: 'Personas para el selector de la entrada',
    respuestas: { 200: ok('Nombre, etiqueta y cédula de prueba', z.array(Persona.extend({ documento: z.string() }))) },
  },
  {
    metodo: 'get',
    ruta: '/beneficiarios',
    etiqueta: PERSONAS,
    resumen: 'Personas registradas (equipo de prueba)',
    descripcion: 'Con su wallet, moneda, estado de la cuenta y si tienen PIN.',
    respuestas: { 200: ok('Las personas', z.array(z.object({}).loose())) },
  },
  {
    metodo: 'post',
    ruta: '/beneficiarios',
    etiqueta: PERSONAS,
    resumen: 'Registra una persona con su cédula y su wallet',
    descripcion: 'El nombre y el PIN son opcionales. Con `cobraCon: wallet` la cuenta queda verificada. Con `llaveCedula` (Plan Bre-B) su cédula queda como llave Bre-B en el banco puente simulado, apuntando a esa wallet, y no se le enlaza cuenta: al cobrar, RN-17 la encuentra sola.',
    cuerpo: EntradaPersona,
    respuestas: { 201: ok('La persona registrada', z.object({}).loose()), 400: 'Entrada inválida', 404: 'La wallet no existe', 409: 'PersonaExiste, BilleteraEnUso' },
  },
  {
    metodo: 'post',
    ruta: '/beneficiarios/:documento/pin',
    etiqueta: PERSONAS,
    resumen: 'Pone o cambia el PIN',
    cuerpo: Confirmacion,
    respuestas: { 200: ok('Listo', z.object({ documento: z.string(), tienePin: z.literal(true) })), 400: 'Entrada inválida', 404: 'Esa cédula no está registrada' },
  },
  {
    metodo: 'get',
    ruta: '/beneficiarios/:documento/resumen',
    etiqueta: PERSONAS,
    resumen: 'Lo que ve la persona',
    descripcion: 'Todos sus subsidios y bonos pendientes, su cuenta y su historial.',
    respuestas: {
      200: ok(
        'El resumen',
        z.object({
          persona: z.object({ nombre: z.string(), documento: z.string(), tienePin: z.boolean() }),
          pagos: z.array(aRef('PagoPendiente')),
          pago: refNulo('PagoPendiente').describe('El primero de `pagos` (compatibilidad)'),
          liquidacionDisponible: z.boolean(),
          cuenta: refNulo('Cuenta'),
          ultimoCobro: refNulo('Cobro'),
          historial: z.array(aRef('Cobro')),
        }),
      ),
      400: 'Documento inválido',
      404: 'Esa cédula no está registrada',
    },
  },
  {
    metodo: 'post',
    ruta: '/cuentas',
    etiqueta: PERSONAS,
    resumen: 'Enlaza una llave Bre-B o una wallet a la persona',
    descripcion:
      'Con **llave Bre-B** (`tipoLlave` + `llave`, Plan Bre-B): la tipo cédula que es la cédula de la persona queda verificada sola (RN-15); las demás piden el PIN y que el banco puente confirme el titular (RN-16). `redirect` es null.\n\n' +
      'Con **wallet** (`billetera`): con `VERIFICACION_CUENTA=subject` devuelve `redirect` para confirmarla en el banco; con `simulada`, queda verificada.',
    cuerpo: EntradaCuenta,
    respuestas: {
      201: ok('La cuenta', ConRedirect('cuenta', 'Cuenta')),
      400: 'Entrada inválida o LlaveInvalida',
      404: 'Cédula o wallet no encontrada, o LlaveNoExiste',
      409: 'BilleteraEnUso',
      422: 'PIN incorrecto, falta el PIN o LlaveDeOtraPersona',
      503: 'PuenteNoResponde',
    },
  },
  {
    metodo: 'get',
    ruta: '/cuentas/llaves/:tipo/:valor',
    etiqueta: PERSONAS,
    resumen: '«¿Eres Ana M*** R***?»: la llave y su titular enmascarado, antes de enlazar',
    respuestas: {
      200: ok('La llave enmascarada y el titular', z.object({ tipoLlave: z.string(), llave: z.string(), titular: z.string() })),
      400: 'Tipo o llave inválidos',
      404: 'LlaveNoExiste',
      503: 'PuenteNoResponde',
    },
  },
  {
    metodo: 'get',
    ruta: '/cuentas/callback/:id',
    etiqueta: PERSONAS,
    resumen: 'Vuelta desde la Test Wallet (cuenta)',
    consulta: Callback,
    respuestas: { 302: regreso },
  },
  {
    metodo: 'get',
    ruta: '/cuentas/:documento',
    etiqueta: PERSONAS,
    resumen: 'Estado de la cuenta mientras la persona aprueba',
    respuestas: { 200: ok('La cuenta (null si no tiene)', z.object({}).loose()), 400: 'Documento inválido', 404: 'Esa cédula no está registrada' },
  },

  // 3. Cobros
  {
    metodo: 'post',
    ruta: '/cobros',
    etiqueta: COBROS,
    resumen: 'Pide un cobro',
    descripcion:
      'A la **cuenta** (paga enseguida), **retiro** en un punto o **compra** con bono (esperan el PIN). Nunca recibe el monto del navegador (RN-11), ' +
      'salvo el total de la compra. Repetir la misma `llaveIdempotencia` devuelve el mismo cobro.',
    cuerpo: EntradaCobro,
    respuestas: {
      201: ok('El cobro', 'Cobro'),
      400: 'Entrada inválida',
      404: 'Sin pago disponible para esa cédula, o el punto no existe',
      409: 'CuentaNoVerificada, SinProgramas…',
      503: 'La liquidación no responde',
    },
  },
  {
    metodo: 'post',
    ruta: '/cobros/:id/confirmar',
    etiqueta: COBROS,
    resumen: 'La persona confirma con su PIN',
    cuerpo: Confirmacion,
    respuestas: {
      200: ok('El cobro ya estaba resuelto (Pagando, Pagado, Rechazado…)', 'Cobro'),
      202: ok('PIN correcto: el pago salió y está Pagando', 'Cobro'),
      400: 'Entrada inválida',
      404: 'No existe ese cobro',
      422: 'PIN incorrecto (PinIncorrecto) o la persona no tiene PIN (SinPin)',
    },
  },
  { metodo: 'post', ruta: '/cobros/:id/cancelar', etiqueta: COBROS, resumen: 'El punto cancela un cobro que espera el PIN', respuestas: { 200: ok('El cobro', 'Cobro'), 404: 'No existe ese cobro', 409: 'El estado no lo permite' } },
  { metodo: 'get', ruta: '/cobros/:id', etiqueta: COBROS, resumen: 'Estado del cobro y su línea de tiempo', descripcion: 'La web lo consulta cada segundo.', respuestas: { 200: ok('El cobro', 'Cobro'), 404: 'No existe ese cobro' } },

  // 4. Puntos y wallets
  {
    metodo: 'get',
    ruta: '/billeteras/resolver',
    etiqueta: PUNTOS,
    resumen: 'Valida una wallet («Cuenta encontrada»)',
    consulta: z.object({ direccion: z.string().meta({ example: '$ilp.interledger-test.dev/mi-wallet' }) }),
    respuestas: { 200: ok('La wallet', z.object({ id: z.string(), nombre: z.string().nullable(), moneda: Moneda })), 400: 'Falta la dirección', 404: 'No existe', 503: 'La Test Wallet no responde' },
  },
  { metodo: 'get', ruta: '/puntos', etiqueta: PUNTOS, resumen: 'Puntos de retiro y sedes de comercios', respuestas: { 200: ok('Los puntos', ['Punto']) } },
  {
    metodo: 'post',
    ruta: '/puntos',
    etiqueta: PUNTOS,
    resumen: 'Registra un punto de retiro',
    descripcion: 'Si llega `programaId`, la moneda del punto tiene que ser la del programa.',
    cuerpo: EntradaPunto,
    respuestas: { 201: ok('El punto', 'Punto'), 400: 'Entrada inválida', 404: 'La wallet o el programa no existen', 409: 'PuntoExiste, MonedaDistinta' },
  },
  {
    metodo: 'get',
    ruta: '/puntos/:id/pagos',
    etiqueta: PUNTOS,
    resumen: 'Qué puede pagar este punto hoy a esa cédula',
    descripcion: 'Subsidios en un punto de retiro; bonos aceptados en una sede. Si hay varios, el punto elige.',
    consulta: z.object({ documento: z.string().meta({ example: '1036000000' }) }),
    respuestas: {
      200: ok('La persona y sus pagos', z.object({ persona: Persona.extend({ tienePin: z.boolean() }), pagos: z.array(aRef('PagoPendiente')) })),
      400: 'Documento inválido',
      404: 'El punto no existe, o la cédula no tiene pagos (SinPagoDisponible)',
      503: 'La liquidación no responde',
    },
  },
  {
    metodo: 'get',
    ruta: '/puntos/:id/cobros',
    etiqueta: PUNTOS,
    resumen: 'Historial del punto',
    consulta: z.object({ desde: Periodo.optional().describe('Sin valor (o «todo»): todo el historial') }),
    respuestas: { 200: ok('Los cobros (sin línea de tiempo)', ['Cobro']), 404: 'Ese punto no existe' },
  },
  {
    metodo: 'get',
    ruta: '/puntos/:id/resumen',
    etiqueta: PUNTOS,
    resumen: 'Mi caja',
    descripcion: 'Entregado, reembolsado, pendiente, tiempo de reembolso y $0 girado por adelantado (D-36).',
    consulta: z.object({ desde: Periodo.optional().describe('Por defecto, hoy') }),
    respuestas: {
      200: ok(
        'La caja del punto',
        z.object({
          punto: aRef('Punto'),
          periodo: Periodo,
          totales: z.array(z.object({ moneda: Moneda, entregado: monto, reembolsado: monto, pendiente: monto })),
          cobros: z.object({ pagados: z.number().int(), enCurso: z.number().int(), rechazados: z.number().int() }),
          reembolsoSegundos: z.number().nullable(),
          giradoPorAdelantado: z.literal('0'),
        }),
      ),
      404: 'Ese punto no existe',
    },
  },

  // 5. Comercios y bonos
  {
    metodo: 'get',
    ruta: '/categorias',
    etiqueta: COMERCIOS,
    resumen: 'Categorías de bono con sus actividades CIIU',
    respuestas: {
      200: ok('Las categorías', z.array(z.object({ id: z.string(), nombre: z.string(), actividades: z.array(z.object({ ciiu: z.string(), nombre: z.string() })) }))),
    },
  },
  { metodo: 'get', ruta: '/comercios', etiqueta: COMERCIOS, resumen: 'Comercios con sus sedes', respuestas: { 200: ok('Los comercios', ['Comercio']) } },
  {
    metodo: 'post',
    ruta: '/comercios',
    etiqueta: COMERCIOS,
    resumen: 'Registra un comercio con su primera sede',
    cuerpo: EntradaComercio,
    respuestas: { 201: ok('El comercio', 'Comercio'), 400: 'Entrada inválida o ActividadSinCategoria', 404: 'La wallet no existe', 409: 'ComercioExiste, PuntoExiste' },
  },
  {
    metodo: 'post',
    ruta: '/comercios/:id/sedes',
    etiqueta: COMERCIOS,
    resumen: 'Agrega una sede con su wallet',
    cuerpo: EntradaSede,
    respuestas: { 201: ok('El comercio', 'Comercio'), 400: 'Entrada inválida', 404: 'El comercio o la wallet no existen', 409: 'PuntoExiste' },
  },
  {
    metodo: 'post',
    ruta: '/comercios/:id/verificar',
    etiqueta: COMERCIOS,
    resumen: 'La entidad verifica el comercio',
    descripcion: 'Simula el cruce con el RUT y el RUES. Solo los verificados aceptan bonos.',
    respuestas: { 200: ok('El comercio', 'Comercio'), 404: 'Ese comercio no existe' },
  },

  // 6. Liquidación simulada
  {
    metodo: 'get',
    ruta: '/liquidacion/programas/:programaId/resumen',
    etiqueta: LIQUIDACION,
    resumen: 'Cuántas cédulas y cuánto suman',
    respuestas: { 200: ok('El resumen', Resumen), 503: 'LIQUIDACION_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'get',
    ruta: '/liquidacion/programas/:programaId/pagos/:documento',
    etiqueta: LIQUIDACION,
    resumen: 'Si una cédula tiene pago en ese programa',
    respuestas: { 200: ok('Tiene pago', PagoDisponible), 404: ok('No tiene pago', SinPago), 503: 'LIQUIDACION_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'post',
    ruta: '/liquidacion/pin/validar',
    etiqueta: LIQUIDACION,
    resumen: 'Valida el PIN de una cédula',
    descripcion: 'Un cuerpo inválido responde `{ "valido": false }`, no 400.',
    cuerpo: PedidoPin,
    respuestas: { 200: ok('El resultado', RespuestaPin), 503: 'LIQUIDACION_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'get',
    ruta: '/liquidacion/personas',
    etiqueta: LIQUIDACION,
    resumen: 'Nombre y si tiene PIN de varias cédulas',
    descripcion: 'Tatú no guarda nombres ni PIN: los pide aquí, en una sola consulta por pantalla. Las cédulas que no están, no vienen.',
    consulta: z.object({ documentos: z.string().meta({ example: '900000001,900000002' }).describe('Hasta 500, separados por coma') }),
    respuestas: { 200: ok('Las personas inscritas', Personas), 400: 'Documentos inválidos', 503: 'LIQUIDACION_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'post',
    ruta: '/liquidacion/personas',
    etiqueta: LIQUIDACION,
    resumen: 'Inscribe a una persona en el gobierno (o la actualiza)',
    descripcion: '«Equipo de prueba» hace el papel del gobierno. Repetirlo no falla: cambia el nombre (y el PIN, si llega).',
    cuerpo: Inscripcion,
    respuestas: { 200: ok('La persona', PersonaDelGobierno), 400: 'Entrada inválida', 503: 'LIQUIDACION_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'post',
    ruta: '/liquidacion/personas/:documento/pin',
    etiqueta: LIQUIDACION,
    resumen: 'Pone o cambia el PIN de una persona inscrita',
    cuerpo: NuevoPin,
    respuestas: { 200: ok('Tiene PIN', z.object({ documento: z.string(), tienePin: z.literal(true) })), 400: 'Entrada inválida', 404: 'Esa cédula no está en la liquidación', 503: 'LIQUIDACION_SIMULAR_FALLA=true' },
  },

  // 7. Banco puente de Bre-B (simulado)
  {
    metodo: 'get',
    ruta: '/puente/llaves/:tipo/:valor',
    etiqueta: PUENTE,
    resumen: 'A qué wallet llega una llave y el titular enmascarado',
    descripcion: 'Lo que el banco le responde a cualquiera que consulta una llave. Tatú lo usa al enlazar y antes de cada cobro (RN-18).',
    respuestas: { 200: ok('La llave', Resolucion), 404: 'LlaveNoExiste', 503: 'PUENTE_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'post',
    ruta: '/puente/llaves/:tipo/:valor/pertenece',
    etiqueta: PUENTE,
    resumen: '¿La llave es de esta cédula? (sí o no)',
    descripcion: 'RN-16: responde sin revelar de quién es la llave.',
    cuerpo: PedidoPertenece,
    respuestas: { 200: ok('El resultado', Coincidencia), 404: 'LlaveNoExiste', 503: 'PUENTE_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'get',
    ruta: '/puente/llaves',
    etiqueta: PUENTE,
    resumen: 'Las llaves de una persona',
    descripcion: '«Equipo de prueba» hace de banco de cada persona.',
    consulta: z.object({ documento: z.string().describe('Cédula del titular') }),
    respuestas: { 200: ok('Sus llaves', Llaves), 400: 'Documento inválido', 503: 'PUENTE_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'post',
    ruta: '/puente/llaves',
    etiqueta: PUENTE,
    resumen: 'Registra una llave (o cambia a qué wallet llega)',
    descripcion: '«Equipo de prueba» hace de banco. Si la llave ya era de esa persona, cambia la wallet (así se prueba RN-18). Una llave tipo cédula solo la registra su titular.',
    cuerpo: Llave,
    respuestas: { 201: ok('Creada', Llave), 200: ok('Actualizada', Llave), 400: 'Entrada inválida', 409: 'LlaveEnUso: es de otra persona', 422: 'CedulaAjena', 503: 'PUENTE_SIMULAR_FALLA=true' },
  },
  {
    metodo: 'delete',
    ruta: '/puente/llaves/:tipo/:valor',
    etiqueta: PUENTE,
    resumen: 'Borra una llave',
    respuestas: { 204: 'Borrada', 404: 'LlaveNoExiste', 503: 'PUENTE_SIMULAR_FALLA=true' },
  },

  // 8. Salud, estado y configuración
  {
    metodo: 'get',
    ruta: '/salud',
    etiqueta: SALUD,
    resumen: 'La BD responde y la llave coincide con la publicada',
    descripcion: '`bd.donde` dice si los datos están en Supabase o en la base local (PGlite), sin la contraseña.',
    respuestas: { 200: ok('Todo bien', z.object({}).loose()), 503: ok('Algo falla (mismo cuerpo, con ok: false)', z.object({}).loose()) },
  },
  {
    metodo: 'get',
    ruta: '/estado',
    etiqueta: SALUD,
    resumen: '¿Pagos reales o simulados?',
    descripcion: 'Siempre 200. `faltan` dice qué impide pagar de verdad.',
    respuestas: {
      200: ok(
        'El estado',
        z.object({ pagosReales: z.boolean(), faltan: z.array(z.string()), openPayments: z.object({}).loose(), programasConTokenFalso: z.number().int(), verificacionCuenta: z.enum(['subject', 'simulada']), baseDeDatos: z.object({ tipo: z.enum(['postgres', 'pglite']), donde: z.string().describe('Servidor y base, nunca la contraseña') }), puenteBreB: z.object({ simulado: z.boolean(), responde: z.boolean() }).describe('El banco puente de Bre-B (Plan Bre-B)') }),
      ),
    },
  },
  {
    metodo: 'get',
    ruta: '/config',
    etiqueta: SALUD,
    resumen: 'Extras prendidos y tiempos de consulta',
    respuestas: {
      200: ok(
        'La configuración pública',
        z.object({
          extras: z.record(z.string(), z.boolean()),
          pollIntervaloMs: z.number(),
          confirmacionTtlSeg: z.number(),
          pinMaxIntentos: z.number(),
          qrTtlSeg: z.number(),
          verificacionCuenta: z.enum(['subject', 'simulada']),
        }),
      ),
    },
  },
]

// ── Armado del documento ──

type Json = Record<string, unknown>

function esquemaJson(esquema: z.ZodType, io: 'input' | 'output'): Json {
  const { $schema: _, ...resto } = z.toJSONSchema(esquema, { io, unrepresentable: 'any', reused: 'inline' }) as Json
  return resto
}

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` })

function contenido(r: Exclude<Respuesta, string>['esquema']): Json {
  if (typeof r === 'string') return ref(r)
  if (Array.isArray(r)) return { type: 'array', items: ref(r[0]!) }
  return esquemaJson(r, 'output')
}

const DESCRIPCION_PARAMETRO: Record<string, string> = {
  id: 'Id (UUID)',
  programaId: 'Id del programa (UUID)',
  documento: 'Cédula, sin puntos ni espacios',
  tipo: 'Tipo de llave Bre-B: cedula, celular, correo o alfanumerica',
  valor: 'La llave: 3001234567, nombre@correo.com, @alias…',
}

function operacion(r: Ruta): Json {
  const parametros: Json[] = [...r.ruta.matchAll(/:(\w+)/g)].map(([, nombre]) => ({
    name: nombre,
    in: 'path',
    required: true,
    description: DESCRIPCION_PARAMETRO[nombre!],
    schema: { type: 'string' },
  }))
  if (r.consulta) {
    const js = esquemaJson(r.consulta, 'input') as { properties?: Record<string, Json>; required?: string[] }
    for (const [nombre, schema] of Object.entries(js.properties ?? {})) {
      const { description, ...resto } = schema
      parametros.push({ name: nombre, in: 'query', required: js.required?.includes(nombre) ?? false, description, schema: resto })
    }
  }

  const respuestas: Json = {}
  for (const [status, resp] of Object.entries(r.respuestas)) {
    if (typeof resp === 'string') {
      respuestas[status] = Number(status) >= 400 ? { description: resp, content: { 'application/json': { schema: ref('Error') } } } : { description: resp }
    } else {
      respuestas[status] = { description: resp.descripcion, content: { 'application/json': { schema: contenido(resp.esquema) } } }
    }
  }
  if (!respuestas['500']) respuestas['500'] = { description: 'Algo falló de nuestro lado (ErrorInterno)', content: { 'application/json': { schema: ref('Error') } } }

  return {
    tags: [r.etiqueta],
    summary: r.resumen,
    ...(r.descripcion ? { description: r.descripcion } : {}),
    operationId: `${r.metodo}${r.ruta.replace(/[/:-]+(\w)/g, (_, l: string) => l.toUpperCase())}`,
    ...(parametros.length ? { parameters: parametros } : {}),
    ...(r.cuerpo ? { requestBody: { required: true, content: { 'application/json': { schema: esquemaJson(r.cuerpo, 'input') } } } } : {}),
    responses: respuestas,
  }
}

let cache: Json | undefined

/** El documento OpenAPI 3.1. Los caminos son relativos a /api, así sirve en el 3000, el 3100 y tras el proxy de Vite. */
export function documentoOpenApi(): Json {
  if (cache) return cache
  const paths: Record<string, Json> = {}
  for (const r of RUTAS) {
    const camino = r.ruta.replace(/:(\w+)/g, '{$1}')
    paths[camino] = { ...paths[camino], [r.metodo]: operacion(r) }
  }
  cache = {
    openapi: '3.1.0',
    info: {
      title: 'API del piloto (Tatú)',
      version: 'piloto',
      description:
        'Piloto 1: subsidios y bonos con Open Payments sobre la Test Wallet. Rama `piloto-v2` (PostgreSQL: Supabase o PGlite), desechable.\n\n' +
        'Los montos van en **unidades mínimas** y como texto (`"23000000"` con escala 2 = $230.000). ' +
        'Todo error responde `{ "error": { "codigo", "mensaje" } }`.\n\n' +
        '⚠️ «Try it out» llama a la API de verdad: con el `.env` lleno, los cobros mueven dinero de prueba en la Test Wallet.',
    },
    servers: [{ url: '/api' }],
    tags: [PROGRAMAS, PERSONAS, COBROS, PUNTOS, COMERCIOS, LIQUIDACION, PUENTE, SALUD].map((name) => ({ name })),
    paths,
    components: { schemas: Object.fromEntries(Object.entries(COMPONENTES).map(([k, v]) => [k, esquemaJson(v, 'output')])) },
  }
  return cache
}

/** GET /openapi.json y la página de Swagger en /docs (bajo /api). */
export function rutasOpenApi(): Router {
  const r = Router()
  r.get('/openapi.json', (_req, res) => {
    res.json(documentoOpenApi())
  })
  r.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerUrl: '/api/openapi.json',
      customSiteTitle: 'API del piloto · Swagger',
      // El enlace a una ruta (…/docs/#/Cobros/postCobros) se puede compartir
      swaggerOptions: { deepLinking: true, displayRequestDuration: true },
    }),
  )
  return r
}

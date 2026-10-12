import swaggerUi from 'swagger-ui-express'
import type { Express } from 'express'

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Open Payments Demo API',
    description: 'API para la demo de Entrega Justo a Tiempo (Hackathon)',
    version: '1.0.0',
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          detalles: { type: 'array', items: { type: 'object' }, nullable: true },
        },
        required: ['error'],
      },
      Programa: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          entidad: { type: 'string', minLength: 3, maxLength: 80 },
          nombre: { type: 'string', minLength: 3, maxLength: 80 },
          tipo: { type: 'string', enum: ['subsidio', 'bono'], nullable: true },
          destino: { type: 'string', enum: ['libre', 'restringido'], nullable: true },
          billeteraPrograma: { type: 'string', format: 'uri' },
          codigoMoneda: { type: 'string', pattern: '^[A-Z]{3}$' },
          escalaMoneda: { type: 'integer', minimum: 0, maximum: 18 },
          vigenciaInicio: { type: 'string', format: 'date-time' },
          vigenciaFin: { type: 'string', format: 'date-time' },
          estado: { type: 'string', enum: ['Borrador', 'EsperandoAprobacion', 'Activo', 'Pausado', 'Cerrado'] },
          topeTotal: { type: 'string', nullable: true },
        },
        required: ['id', 'entidad', 'nombre', 'tipo', 'destino', 'billeteraPrograma', 'codigoMoneda', 'escalaMoneda', 'vigenciaInicio', 'vigenciaFin', 'estado', 'topeTotal'],
      },
      CrearProgramaBody: {
        type: 'object',
        required: ['entidad', 'nombre', 'billeteraPrograma', 'vigenciaInicio', 'vigenciaFin'],
        properties: {
          entidad: { type: 'string', minLength: 3, maxLength: 80 },
          nombre: { type: 'string', minLength: 3, maxLength: 80 },
          tipo: { type: 'string', enum: ['subsidio'], default: 'subsidio' },
          billeteraPrograma: { type: 'string' },
          vigenciaInicio: { type: 'string', format: 'date-time' },
          vigenciaFin: { type: 'string', format: 'date-time' },
        },
      },
      Punto: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tipo: { type: 'string', enum: ['retiro', 'compra'] },
          nombre: { type: 'string' },
          billetera: { type: 'string', format: 'uri' },
          codigoMoneda: { type: 'string', pattern: '^[A-Z]{3}$' },
          escalaMoneda: { type: 'integer', minimum: 0, maximum: 18 },
          programaId: { type: 'string', format: 'uuid', nullable: true },
        },
        required: ['id', 'tipo', 'nombre', 'billetera', 'codigoMoneda', 'escalaMoneda', 'programaId'],
      },
      CrearPuntoBody: {
        type: 'object',
        required: ['tipo', 'nombre', 'billetera'],
        properties: {
          tipo: { type: 'string', enum: ['retiro', 'compra'] },
          nombre: { type: 'string', minLength: 2 },
          billetera: { type: 'string' },
          programaId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      LiquidacionResumen: {
        type: 'object',
        properties: {
          totalBeneficiarios: { type: 'integer' },
          montoTotal: { type: 'string' },
          assetCode: { type: 'string', pattern: '^[A-Z]{3}$' },
          assetScale: { type: 'integer' },
        },
        required: ['totalBeneficiarios', 'montoTotal', 'assetCode', 'assetScale'],
      },
      CedulaLiquidacion: {
        type: 'object',
        properties: {
          documento: { type: 'string' },
          nombre: { type: 'string' },
          monto: { type: 'string' },
          estado: { type: 'string' },
          assetCode: { type: 'string', pattern: '^[A-Z]{3}$' },
          assetScale: { type: 'integer' },
        },
        required: ['documento', 'nombre', 'monto', 'estado', 'assetCode', 'assetScale'],
      },
      NovedadBody: {
        type: 'object',
        required: ['novedad', 'motivo'],
        properties: {
          novedad: { type: 'integer', minimum: 0 },
          motivo: { type: 'string', minLength: 3 },
        },
      },
      MarcarPagadoBody: {
        type: 'object',
        required: ['montoPagado'],
        properties: {
          montoPagado: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
  paths: {
    '/programas': {
      post: {
        tags: ['Programas'],
        summary: 'Crear programa (HU-01)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CrearProgramaBody' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Programa creado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { programa: { $ref: '#/components/schemas/Programa' } },
                },
              },
            },
          },
          '400': { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '422': { description: 'Wallet no resuelve', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '501': { description: 'Adaptador pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/programas/{id}/autorizar': {
      post: {
        tags: ['Programas'],
        summary: 'Autorizar permiso con tope (HU-04)',
        responses: {
          '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/callback/{id}': {
      get: {
        tags: ['Programas'],
        summary: 'Callback de autorización (HU-04)',
        responses: {
          '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/puntos': {
      get: {
        tags: ['Puntos'],
        summary: 'Listar puntos (HU-03)',
        responses: {
          '200': { description: 'Lista de puntos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Punto' } } } } },
        },
      },
      post: {
        tags: ['Puntos'],
        summary: 'Registrar punto (HU-03)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CrearPuntoBody' } } },
        },
        responses: {
          '201': { description: 'Punto creado', content: { 'application/json': { schema: { type: 'object', properties: { punto: { $ref: '#/components/schemas/Punto' } } } } } },
          '400': { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: 'Programa no existe', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Punto duplicado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '422': { description: 'Error de validación', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/liquidacion/resumen': {
      get: {
        tags: ['Liquidación'],
        summary: 'Resumen de liquidación (HU-02)',
        responses: {
          '200': { description: 'Resumen', content: { 'application/json': { schema: { $ref: '#/components/schemas/LiquidacionResumen' } } } },
        },
      },
    },
    '/liquidacion/cedulas/{documento}': {
      get: {
        tags: ['Liquidación'],
        summary: 'Consultar cédula (HU-02)',
        parameters: [{ name: 'documento', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Datos de cédula', content: { 'application/json': { schema: { $ref: '#/components/schemas/CedulaLiquidacion' } } } },
          '404': { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/liquidacion/novedades': {
      post: {
        tags: ['Liquidación'],
        summary: 'Cargar novedad (HU-02)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NovedadBody' } } } },
        responses: {
          '201': { description: 'Novedad aplicada', content: { 'application/json': { schema: { type: 'object', properties: { resumen: { $ref: '#/components/schemas/LiquidacionResumen' } } } } } },
        },
      },
    },
    '/liquidacion/cedulas/{documento}/pagado': {
      post: {
        tags: ['Liquidación'],
        summary: 'Marcar pagado (HU-02)',
        parameters: [{ name: 'documento', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MarcarPagadoBody' } } } },
        responses: {
          '200': { description: 'Marcado como pagado', content: { 'application/json': { schema: { type: 'object', properties: { cedula: { $ref: '#/components/schemas/CedulaLiquidacion' } } } } } },
          '404': { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/cuentas': {
      post: { tags: ['Cuentas'], summary: 'Enlazar cuenta (HU-07)', responses: { '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
    },
    '/cuentas/callback/{id}': {
      get: { tags: ['Cuentas'], summary: 'Callback de verificación (HU-07)', responses: { '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
    },
    '/cobros': {
      post: { tags: ['Cobros'], summary: 'Solicitar cobro', responses: { '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
    },
    '/cobros/{id}': {
      get: { tags: ['Cobros'], summary: 'Consultar cobro', responses: { '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
    },
    '/cobros/{id}/confirmar': {
      post: { tags: ['Cobros'], summary: 'Confirmar con PIN (HU-11)', responses: { '501': { description: 'Pendiente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
    },
  },
  tags: [
    { name: 'Programas' },
    { name: 'Puntos' },
    { name: 'Liquidación' },
    { name: 'Cuentas' },
    { name: 'Cobros' },
  ],
} as const

export function setupSwagger(app: Express) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
}

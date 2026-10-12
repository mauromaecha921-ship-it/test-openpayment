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
  paths: {
    '/programas': {
      post: {
        tags: ['Programas'],
        summary: 'Crear programa (HU-01)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Programa creado' }, '400': { description: 'Datos inválidos' }, '422': { description: 'Wallet no resuelve' } },
      },
    },
    '/programas/{id}/autorizar': {
      post: { tags: ['Programas'], summary: 'Autorizar permiso con tope (HU-04)', responses: { '501': { description: 'Pendiente' } } },
    },
    '/callback/{id}': {
      get: { tags: ['Programas'], summary: 'Callback de autorización (HU-04)', responses: { '501': { description: 'Pendiente' } } },
    },
    '/puntos': {
      get: { tags: ['Puntos'], summary: 'Listar puntos', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Puntos'], summary: 'Registrar punto (HU-03)', responses: { '201': { description: 'Creado' }, '409': { description: 'Duplicado' }, '422': { description: 'Error de validación' } } },
    },
    '/liquidacion/resumen': {
      get: { tags: ['Liquidación'], summary: 'Resumen de liquidación (HU-02)', responses: { '200': { description: 'OK' } } },
    },
    '/liquidacion/cedulas/{documento}': {
      get: { tags: ['Liquidación'], summary: 'Consultar cédula (HU-02)', responses: { '200': { description: 'OK' }, '404': { description: 'No encontrado' } } },
    },
    '/liquidacion/novedades': {
      post: { tags: ['Liquidación'], summary: 'Cargar novedad (HU-02)', responses: { '201': { description: 'Creado' } } },
    },
    '/liquidacion/cedulas/{documento}/pagado': {
      post: { tags: ['Liquidación'], summary: 'Marcar pagado', responses: { '200': { description: 'OK' } } },
    },
    '/cuentas': {
      post: { tags: ['Cuentas'], summary: 'Enlazar cuenta (HU-07)', responses: { '501': { description: 'Pendiente' } } },
    },
    '/cuentas/callback/{id}': {
      get: { tags: ['Cuentas'], summary: 'Callback de verificación (HU-07)', responses: { '501': { description: 'Pendiente' } } },
    },
    '/cobros': {
      post: { tags: ['Cobros'], summary: 'Solicitar cobro', responses: { '501': { description: 'Pendiente' } } },
    },
    '/cobros/{id}': {
      get: { tags: ['Cobros'], summary: 'Consultar cobro', responses: { '501': { description: 'Pendiente' } } },
    },
    '/cobros/{id}/confirmar': {
      post: { tags: ['Cobros'], summary: 'Confirmar con PIN (HU-11)', responses: { '501': { description: 'Pendiente' } } },
    },
  },
  components: {},
  tags: [
    { name: 'Programas' },
    { name: 'Puntos' },
    { name: 'Liquidación' },
    { name: 'Cuentas' },
    { name: 'Cobros' },
  ],
}

export function setupSwagger(app: Express) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
}

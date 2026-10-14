import type { Router } from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../test/ayuda.js'
import { rutasBeneficiarios } from './beneficiarios/rutas.js'
import { rutasCobros } from './cobros/rutas.js'
import { rutasComercios } from './comercios/rutas.js'
import { rutasCuentas } from './cuentas/rutas.js'
import { rutasExtras } from './extras.js'
import { routerLiquidacion } from './liquidacion/router.js'
import { routerPuente } from './puente/router.js'
import { documentoOpenApi, RUTAS } from './openapi.js'
import { rutasProgramas } from './programas/rutas.js'
import { rutasPuntos } from './puntos/rutas.js'
import { rutasSalud } from './salud.js'

/** «GET /programas/:id» de cada ruta que monta app.ts, leído de los routers de Express. */
function montadas(): string[] {
  const routers: Array<[string, Router]> = [
    ['', rutasSalud()],
    ['', rutasExtras()],
    ['/liquidacion', routerLiquidacion()],
    ['/puente', routerPuente()],
    ['', rutasProgramas()],
    ['', rutasPuntos()],
    ['', rutasComercios()],
    ['', rutasBeneficiarios()],
    ['', rutasCuentas()],
    ['', rutasCobros()],
  ]
  return routers.flatMap(([prefijo, router]) =>
    router.stack
      .filter((capa) => capa.route)
      .flatMap((capa) => {
        const ruta = capa.route as unknown as { path: string; methods: Record<string, boolean> }
        return Object.keys(ruta.methods).map((m) => `${m.toUpperCase()} ${prefijo}${ruta.path}`)
      }),
  )
}

describe('Swagger (OpenAPI)', () => {
  it('documenta exactamente las rutas montadas: ni una de más ni una de menos', () => {
    const documentadas = RUTAS.map((r) => `${r.metodo.toUpperCase()} ${r.ruta}`)
    expect([...documentadas].sort()).toEqual(montadas().sort())
    expect(new Set(documentadas).size).toBe(documentadas.length)
    // docs/piloto/API del piloto.md: 43 del piloto más 3 del gobierno simulado en piloto-v2 (nombres y PIN),
    // más 6 del Plan Bre-B: la consulta de la llave en Tatú y 5 del banco puente simulado
    expect(documentadas).toHaveLength(52)
  })

  it('arma un OpenAPI 3.1 con el cuerpo que validan las rutas', () => {
    const doc = documentoOpenApi() as { openapi: string; paths: Record<string, Record<string, any>> }
    expect(doc.openapi).toBe('3.1.0')
    const crear = doc.paths['/programas']!.post.requestBody.content['application/json'].schema
    expect(crear.required).toEqual(expect.arrayContaining(['entidad', 'nombre', 'billetera', 'vigenciaInicio', 'vigenciaFin']))
    // Con default, «tipo» es opcional al entrar
    expect(crear.required).not.toContain('tipo')
    const cobro = doc.paths['/cobros']!.post.requestBody.content['application/json'].schema
    expect(cobro.properties.canal.enum).toEqual(['cuenta', 'retiro', 'compra'])
    expect(doc.paths['/puntos/{id}/pagos']!.get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'id', in: 'path' }), expect.objectContaining({ name: 'documento', in: 'query', required: true })]),
    )
  })

  it('sirve /api/openapi.json y la página de Swagger', async () => {
    const a = app()
    const json = await request(a).get('/api/openapi.json')
    expect(json.status).toBe(200)
    expect(json.body.servers).toEqual([{ url: '/api' }])

    const pagina = await request(a).get('/api/docs/')
    expect(pagina.status).toBe(200)
    expect(pagina.text).toContain('swagger-ui')
    const init = await request(a).get('/api/docs/swagger-ui-init.js')
    expect(init.status).toBe(200)
    expect(init.text).toContain('/api/openapi.json')
  })

  it('no expone secretos de la configuración', () => {
    const texto = JSON.stringify(documentoOpenApi())
    for (const prohibido of ['OP_KEY_ID', 'OP_PRIVATE_KEY', 'OP_CLIENT_WALLET_ADDRESS', 'token_acceso', 'nonce']) {
      expect(texto).not.toContain(prohibido)
    }
  })
})

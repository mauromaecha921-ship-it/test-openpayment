import { describe, expect, it } from 'vitest'

import type { EstadoCobro } from '@/api/tipos'

import { esEstadoFinal, pantallaDelCobro, rutaDelPrograma } from './pantallas'

describe('pantallaDelCobro', () => {
  const casos: Array<[EstadoCobro | undefined, string]> = [
    [undefined, 'cargando'],
    ['Solicitado', 'confirmarPin'],
    ['PorConfirmar', 'confirmarPin'],
    ['Pagando', 'pagando'],
    ['Pagado', 'pagado'],
    ['Rechazado', 'rechazo'],
    ['Fallido', 'rechazo'],
  ]
  it.each(casos)('%s → %s', (estado, pantalla) => {
    expect(pantallaDelCobro(estado)).toBe(pantalla)
  })
})

describe('esEstadoFinal', () => {
  it('Pagado, Rechazado y Fallido detienen la consulta', () => {
    expect(['Pagado', 'Rechazado', 'Fallido'].every((e) => esEstadoFinal(e as EstadoCobro))).toBe(true)
    expect(['Solicitado', 'PorConfirmar', 'Pagando'].some((e) => esEstadoFinal(e as EstadoCobro))).toBe(false)
  })
})

describe('rutaDelPrograma', () => {
  it('lleva a cada estado a su pantalla', () => {
    expect(rutaDelPrograma('p1', 'Borrador')).toBe('/entidad/programas/p1/editar')
    expect(rutaDelPrograma('p1', 'EsperandoAprobacion')).toBe('/entidad/programas/p1/aprobar')
    expect(rutaDelPrograma('p1', 'Activo')).toBe('/entidad/programas/p1')
    expect(rutaDelPrograma('p1', 'Cerrado')).toBe('/entidad/programas/p1')
  })
})

describe('agregarDigito', () => {
  it('suma dígitos sin pasar de 4', async () => {
    const { agregarDigito } = await import('@/componentes/TecladoPin')
    expect(agregarDigito('', '2')).toBe('2')
    expect(agregarDigito('222', '2')).toBe('2222')
    expect(agregarDigito('2222', '9')).toBe('2222')
  })
})

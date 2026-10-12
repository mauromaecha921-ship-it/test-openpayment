import { describe, expect, it, vi } from 'vitest'
import { BilleteraNoResuelveError } from '../programas/servicio'
import {
  MonedaNoCoincideError,
  ProgramaNoExisteError,
  PuntoDuplicadoError,
  registrarPunto,
  type Dependencias,
  type NuevoPunto,
  type Punto,
} from './servicio'

// HU-03 · Registrar puntos de retiro (tabla `punto` → walletAddress.get).

const PUNTO = {
  nombre: 'Tienda Marta — corresponsal',
  direccion: 'Calle 10 # 5-20, Valledupar',
  billetera: '$ilp.interledger-test.dev/punto-1',
  tipo: 'retiro',
}

const PROGRAMA_ID = '11111111-1111-4111-8111-111111111111'

function armarDependencias(over: Partial<Dependencias> = {}) {
  const crear = vi.fn(async (datos: NuevoPunto): Promise<Punto> => ({ ...datos, id: 'uuid-punto-1' }))
  const existeBilletera = vi.fn(async (_billetera: string) => false)
  const listar = vi.fn(async (): Promise<Punto[]> => [])
  const buscarPorId = vi.fn(async (_id: string) => ({ id: 'uuid-programa-1', codigoMoneda: 'COP' }))

  const deps: Dependencias = {
    resolverBilletera: vi.fn(async () => ({ assetCode: 'COP', assetScale: 2 })),
    programas: { buscarPorId },
    puntos: { crear, existeBilletera, listar },
    ...over,
  }
  return { deps, crear, existeBilletera, buscarPorId }
}

describe('HU-03 · registrar puntos de retiro', () => {
  it('criterio 1: un punto con nombre, dirección y wallet válida se guarda', async () => {
    const { deps, crear } = armarDependencias()

    const punto = await registrarPunto({ ...PUNTO }, deps)

    expect(punto).toMatchObject({ nombre: PUNTO.nombre, tipo: 'retiro' })
    expect(punto.billetera).toBe('https://ilp.interledger-test.dev/punto-1')
    expect(crear).toHaveBeenCalledOnce()
  })

  it('criterio 2: una wallet con moneda distinta a la del programa se advierte y no se guarda', async () => {
    const { deps, crear } = armarDependencias({
      resolverBilletera: vi.fn(async () => ({ assetCode: 'USD', assetScale: 2 })),
    })

    await expect(
      registrarPunto({ ...PUNTO, programaId: PROGRAMA_ID }, deps),
    ).rejects.toBeInstanceOf(MonedaNoCoincideError)
    expect(crear).not.toHaveBeenCalled()
  })

  it('la misma moneda del programa sí se guarda', async () => {
    const { deps, crear } = armarDependencias()

    const punto = await registrarPunto({ ...PUNTO, programaId: PROGRAMA_ID }, deps)

    expect(punto.id).toBe('uuid-punto-1')
    expect(crear).toHaveBeenCalledOnce()
  })

  it('si la wallet no resuelve, no se guarda', async () => {
    const { deps, crear } = armarDependencias({
      resolverBilletera: vi.fn(async () => {
        throw new Error('HTTP 404')
      }),
    })

    await expect(registrarPunto({ ...PUNTO }, deps)).rejects.toBeInstanceOf(BilleteraNoResuelveError)
    expect(crear).not.toHaveBeenCalled()
  })

  it('no permite dos puntos con la misma wallet', async () => {
    const crear = vi.fn(async (datos: NuevoPunto): Promise<Punto> => ({ ...datos, id: 'uuid-punto-1' }))
    const { deps } = armarDependencias({
      puntos: { crear, existeBilletera: vi.fn(async () => true), listar: vi.fn(async () => []) },
    })

    await expect(registrarPunto({ ...PUNTO }, deps)).rejects.toBeInstanceOf(PuntoDuplicadoError)
    expect(crear).not.toHaveBeenCalled()
  })

  it('si el programa indicado no existe, lo informa', async () => {
    const { deps } = armarDependencias({ programas: { buscarPorId: vi.fn(async () => null) } })

    await expect(
      registrarPunto({ ...PUNTO, programaId: PROGRAMA_ID }, deps),
    ).rejects.toBeInstanceOf(ProgramaNoExisteError)
  })

  it('valida nombre, dirección y forma de la billetera antes de resolver', async () => {
    const { deps, crear } = armarDependencias()

    await expect(registrarPunto({ ...PUNTO, nombre: 'ab' }, deps)).rejects.toThrow()
    await expect(registrarPunto({ ...PUNTO, direccion: 'x' }, deps)).rejects.toThrow()
    await expect(registrarPunto({ ...PUNTO, billetera: 'sin-esquema' }, deps)).rejects.toThrow()
    expect(crear).not.toHaveBeenCalled()
  })
})

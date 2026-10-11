import { describe, expect, it, vi } from 'vitest'
import {
  BilleteraNoResuelveError,
  canalesPermitidos,
  crearPrograma,
  destinoDeTipo,
  formatearMonto,
  normalizarBilletera,
  type Dependencias,
  type EventoNuevo,
  type NuevoPrograma,
  type Programa,
} from './servicio'

// HU-01 · Conectar un subsidio · `POST /programas` → `walletAddress.get`.
// Cada `it` corresponde a un criterio de aceptación de la historia.

const SUBSIDIO = {
  entidad: 'Prosperidad Social',
  nombre: 'Subsidio jóvenes (simulado)',
  billeteraPrograma: '$ilp.interledger-test.dev/programa-subsidio',
  vigenciaInicio: '2026-01-01T00:00:00.000Z',
  vigenciaFin: '2026-12-31T23:59:59.000Z',
}

function armarDependencias(resolver: Dependencias['resolverBilletera']) {
  const crear = vi.fn(async (datos: NuevoPrograma): Promise<Programa> => ({
    ...datos,
    id: 'uuid-programa-1',
    topeTotal: null,
  }))
  const registrar = vi.fn(async (_evento: EventoNuevo): Promise<void> => {})
  const deps: Dependencias = {
    resolverBilletera: resolver,
    programas: { crear },
    eventos: { registrar },
  }
  return { deps, crear, registrar }
}

const resuelveCop = () => vi.fn(async () => ({ assetCode: 'COP', assetScale: 2 }))

describe('HU-01 · crear un subsidio', () => {
  it('criterio 1: el destino queda libre y los canales son cuenta y retiro (subsidio)', async () => {
    const { deps } = armarDependencias(resuelveCop())

    const programa = await crearPrograma({ ...SUBSIDIO }, deps)

    expect(programa.tipo).toBe('subsidio')
    expect(programa.destino).toBe('libre')
    expect(canalesPermitidos(programa.destino)).toEqual(['cuenta', 'retiro'])
    expect(destinoDeTipo('subsidio')).toBe('libre')
  })

  it('criterio 1: el tipo bono no se conecta por aquí (queda para el extra HU-21)', async () => {
    const { deps, crear, registrar } = armarDependencias(resuelveCop())

    await expect(crearPrograma({ ...SUBSIDIO, tipo: 'bono' }, deps)).rejects.toThrow()

    expect(crear).not.toHaveBeenCalled()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('criterio 2: un payment pointer con $ se convierte a https://', async () => {
    expect(normalizarBilletera('$ilp.interledger-test.dev/programa')).toBe(
      'https://ilp.interledger-test.dev/programa',
    )
    expect(normalizarBilletera('https://ilp.interledger-test.dev/programa/')).toBe(
      'https://ilp.interledger-test.dev/programa',
    )

    const resolver = resuelveCop()
    const { deps } = armarDependencias(resolver)

    const programa = await crearPrograma({ ...SUBSIDIO }, deps)

    expect(resolver).toHaveBeenCalledWith('https://ilp.interledger-test.dev/programa-subsidio')
    expect(programa.billeteraPrograma).toBe('https://ilp.interledger-test.dev/programa-subsidio')
  })

  it('criterio 2: si la wallet no resuelve veo «No encontramos esa cuenta» y no se guarda', async () => {
    const resolver = vi.fn(async () => {
      throw new Error('HTTP 404')
    })
    const { deps, crear, registrar } = armarDependencias(resolver)

    await expect(crearPrograma({ ...SUBSIDIO }, deps)).rejects.toBeInstanceOf(BilleteraNoResuelveError)
    await expect(crearPrograma({ ...SUBSIDIO }, deps)).rejects.toThrow('No encontramos esa cuenta')
    expect(crear).not.toHaveBeenCalled()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('criterio 3: si la cuenta no usa pesos, toma su assetCode y assetScale', async () => {
    const { deps } = armarDependencias(vi.fn(async () => ({ assetCode: 'USD', assetScale: 2 })))

    const programa = await crearPrograma({ ...SUBSIDIO }, deps)

    expect(programa.codigoMoneda).toBe('USD')
    expect(programa.escalaMoneda).toBe(2)
    expect(formatearMonto(500, programa.codigoMoneda, programa.escalaMoneda)).toBe('5,00 USD')
  })

  it('criterio 3: formatea cualquier moneda con su assetCode y assetScale (RN-11)', () => {
    expect(formatearMonto(23000000, 'COP', 2)).toBe('230.000,00 COP')
    expect(formatearMonto(500, 'USD', 2)).toBe('5,00 USD')
    expect(formatearMonto(5, 'USD', 2)).toBe('0,05 USD')
    expect(formatearMonto(1000, 'JPY', 0)).toBe('1.000 JPY')
    expect(formatearMonto(0n, 'COP', 2)).toBe('0,00 COP')
  })

  it('criterio 4: el programa queda en Borrador y no se mueve dinero', async () => {
    const { deps, registrar } = armarDependencias(resuelveCop())

    const programa = await crearPrograma({ ...SUBSIDIO }, deps)

    expect(programa.estado).toBe('Borrador')
    expect(programa.topeTotal).toBeNull()
    expect('tokenAcceso' in programa).toBe(false)
    expect('urlGestion' in programa).toBe(false)
    // El único registro lateral es el evento inicial; nada de pagos.
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEntidad: 'programa', estadoNuevo: 'Borrador', estadoAnterior: null }),
    )
  })

  it('valida la vigencia y la billetera antes de resolver nada', async () => {
    const { deps, crear } = armarDependencias(resuelveCop())

    await expect(
      crearPrograma({ ...SUBSIDIO, vigenciaFin: '2025-01-01T00:00:00.000Z' }, deps),
    ).rejects.toThrow()
    await expect(
      crearPrograma({ ...SUBSIDIO, billeteraPrograma: 'ilp.interledger-test.dev/programa' }, deps),
    ).rejects.toThrow()
    await expect(crearPrograma({ ...SUBSIDIO, nombre: 'ab' }, deps)).rejects.toThrow()

    expect(crear).not.toHaveBeenCalled()
  })
})

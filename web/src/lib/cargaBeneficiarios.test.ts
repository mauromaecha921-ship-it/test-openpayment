import { describe, expect, it } from 'vitest'

import { leerCsv, revisarCarga } from './cargaBeneficiarios'

describe('revisarCarga', () => {
  const base = [
    ['cedula', 'nombre', 'valor'],
    ['52418300', 'Ana Rodríguez', '230000'],
    ['71234567', 'Jorge Pérez', '230000'],
    ['71234567', 'Jorge Pérez', '230000'],
    ['80112128', 'Luis Martínez', ''],
    ['abc', 'Sin cédula', '1000'],
  ]

  it('separa las listas de los errores y explica cada uno', () => {
    const r = revisarCarga(base, new Set())
    expect(r.leidas).toBe(5)
    expect(r.listas.map((f) => f.cedula)).toEqual(['52418300', '71234567'])
    expect(r.errores.map((e) => e.problema)).toEqual(['Repetida', 'Falta el valor', 'Cédula inválida'])
    expect(r.errores[0].como).toContain('fila 3')
  })

  it('no agrega a quien ya está registrado', () => {
    const r = revisarCarga(base.slice(0, 2), new Set(['52418300']))
    expect(r.listas).toHaveLength(0)
    expect(r.errores[0].problema).toBe('Ya registrada')
  })

  it('pide las columnas de la plantilla', () => {
    expect(() => revisarCarga([['documento', 'nombre']], new Set())).toThrow(/Faltan las columnas/)
  })
})

describe('leerCsv', () => {
  it('lee comas, punto y coma y comillas', () => {
    expect(leerCsv('cedula;nombre;valor\n1;"Pérez; Ana";5\n')).toEqual([['cedula', 'nombre', 'valor'], ['1', 'Pérez; Ana', '5']])
  })
})

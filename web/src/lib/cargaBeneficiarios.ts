// Lectura y revisión de la lista de beneficiarios que sube la entidad (Excel o CSV).
// Columnas: cedula, nombre, valor (en pesos, sin puntos ni símbolo). Una fila por persona.

export interface FilaCarga {
  /** Número de fila en el archivo (la 1 es el encabezado). */
  fila: number
  cedula: string
  nombre: string
  valor: string
}

export interface ErrorCarga {
  fila: number
  dato: string
  problema: string
  como: string
}

export interface RevisionCarga {
  leidas: number
  listas: FilaCarga[]
  errores: ErrorCarga[]
}

export const MAX_FILAS = 5000

export const PLANTILLA_CSV = 'cedula,nombre,valor\n52418300,Ana Rodríguez,230000\n71234567,Jorge Pérez,230000\n'

const COLUMNAS = ['cedula', 'nombre', 'valor']

function normalizar(t: unknown): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Una línea de CSV, con comillas y separador «,» o «;». */
function partirLinea(linea: string, sep: string): string[] {
  const celdas: string[] = []
  let actual = ''
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (comillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else comillas = !comillas
    } else if (c === sep && !comillas) {
      celdas.push(actual)
      actual = ''
    } else actual += c
  }
  celdas.push(actual)
  return celdas
}

export function leerCsv(texto: string): string[][] {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lineas.length === 0) return []
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ','
  return lineas.map((l) => partirLinea(l, sep))
}

/** Una cédula escrita como número en Excel puede llegar como 5.2418300e7: se pasa a texto entero. */
function comoTexto(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v ?? '').trim()
}

/**
 * Revisa las filas (la primera es el encabezado). `registradas`: cédulas que ya están en el equipo,
 * que no se agregan otra vez.
 */
export function revisarCarga(filas: unknown[][], registradas: Set<string>): RevisionCarga {
  if (filas.length === 0) throw new Error('El archivo está vacío.')
  const encabezado = filas[0].map(normalizar)
  const falta = COLUMNAS.filter((c) => !encabezado.includes(c))
  if (falta.length) throw new Error(`Faltan las columnas: ${falta.join(', ')}. Usa la plantilla.`)
  const col = Object.fromEntries(COLUMNAS.map((c) => [c, encabezado.indexOf(c)])) as Record<string, number>

  const datos = filas.slice(1).filter((f) => f.some((c) => comoTexto(c) !== ''))
  if (datos.length === 0) throw new Error('El archivo no trae filas con datos.')
  if (datos.length > MAX_FILAS) throw new Error(`El archivo trae más de ${MAX_FILAS.toLocaleString('es-CO')} filas.`)

  const listas: FilaCarga[] = []
  const errores: ErrorCarga[] = []
  const vistas = new Map<string, number>()

  filas.slice(1).forEach((f, i) => {
    if (!f.some((c) => comoTexto(c) !== '')) return
    const fila = i + 2
    const cedula = comoTexto(f[col.cedula]).replace(/[\s.]/g, '')
    const nombre = comoTexto(f[col.nombre])
    const valor = comoTexto(f[col.valor]).replace(/[$\s]/g, '')

    const mal = (dato: string, problema: string, como: string) => errores.push({ fila, dato, problema, como })

    if (!/^\d{5,12}$/.test(cedula)) return mal(`cedula ${cedula || '(vacía)'}`, 'Cédula inválida', 'Solo números, sin puntos: de 5 a 12 dígitos.')
    if (vistas.has(cedula)) return mal(`cedula ${cedula}`, 'Repetida', `Ya está en la fila ${vistas.get(cedula)}. Cada persona va una sola vez por programa.`)
    if (registradas.has(cedula)) return mal(`cedula ${cedula}`, 'Ya registrada', 'Esa persona ya está en el equipo.')
    if (!nombre) return mal(`cedula ${cedula}`, 'Falta el nombre', 'Escribe el nombre completo.')
    if (valor === '') return mal('valor (vacío)', 'Falta el valor', 'Escribe el valor en pesos, por ejemplo 230000.')
    if (!/^\d+$/.test(valor) || BigInt(valor) <= 0n) return mal(`valor ${valor}`, 'Valor inválido', 'En pesos, sin puntos ni símbolo, mayor que cero.')

    vistas.set(cedula, fila)
    listas.push({ fila, cedula, nombre, valor })
  })

  return { leidas: datos.length, listas, errores }
}

import { randomUUID } from 'node:crypto'
import { ahoraIso, ejecutar, uno, varios } from '../conexion.js'

export interface FilaComercio {
  id: string
  nit: string
  razon_social: string
  ciiu: string
  categoria: string
  verificado_en: string | null
  creado_en: string
}

export function crear(datos: Pick<FilaComercio, 'nit' | 'razon_social' | 'ciiu' | 'categoria'>): FilaComercio {
  const id = randomUUID()
  ejecutar('INSERT INTO comercio (id, nit, razon_social, ciiu, categoria) VALUES (:id, :nit, :razon_social, :ciiu, :categoria)', {
    id,
    ...datos,
  })
  return obtener(id)!
}

export function obtener(id: string): FilaComercio | undefined {
  return uno<FilaComercio>('SELECT * FROM comercio WHERE id = :id', { id })
}

export function porNit(nit: string): FilaComercio | undefined {
  return uno<FilaComercio>('SELECT * FROM comercio WHERE nit = :nit', { nit })
}

export function listar(): FilaComercio[] {
  return varios<FilaComercio>('SELECT * FROM comercio ORDER BY razon_social')
}

/** La entidad lo verificó (en producción, contra el RUT y el RUES). Devuelve si cambió. */
export function verificar(id: string): boolean {
  return ejecutar('UPDATE comercio SET verificado_en = :ahora WHERE id = :id AND verificado_en IS NULL', { id, ahora: ahoraIso() }) === 1
}

// ── Categorías que acepta cada bono ──────────────────────────────────────────

export function categoriasDe(programaId: string): string[] {
  return varios<{ categoria: string }>('SELECT categoria FROM programa_categoria WHERE programa_id = :p ORDER BY categoria', {
    p: programaId,
  }).map((f) => f.categoria)
}

export function ponerCategorias(programaId: string, categorias: string[]) {
  ejecutar('DELETE FROM programa_categoria WHERE programa_id = :p', { p: programaId })
  for (const categoria of new Set(categorias)) {
    ejecutar('INSERT INTO programa_categoria (programa_id, categoria) VALUES (:p, :categoria)', { p: programaId, categoria })
  }
}

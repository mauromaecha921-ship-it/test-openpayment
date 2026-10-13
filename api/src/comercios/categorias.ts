/**
 * Categorías de bono, deducidas de la actividad económica del RUT (CIIU rev. 4 adaptada para
 * Colombia). La entidad autoriza categorías, no comercio por comercio (Plan de ajustes § 11).
 * Lista corta para el piloto; en producción la define la entidad con su normativa.
 */
export interface Categoria {
  id: string
  nombre: string
  /** Códigos CIIU de 4 dígitos que caen en la categoría, con su descripción corta. */
  actividades: Array<{ ciiu: string; nombre: string }>
}

export const CATEGORIAS: Categoria[] = [
  {
    id: 'alimentos',
    nombre: 'Alimentos',
    actividades: [
      { ciiu: '4711', nombre: 'Supermercados y tiendas con surtido de alimentos' },
      { ciiu: '4721', nombre: 'Venta de productos agrícolas (fruver)' },
      { ciiu: '4722', nombre: 'Venta de leche y productos lácteos' },
      { ciiu: '4723', nombre: 'Venta de carnes (carnicería)' },
      { ciiu: '4729', nombre: 'Otros alimentos (panadería, víveres)' },
    ],
  },
  {
    id: 'salud',
    nombre: 'Salud',
    actividades: [
      { ciiu: '4773', nombre: 'Droguerías y farmacias' },
      { ciiu: '4774', nombre: 'Productos médicos y ortopédicos' },
    ],
  },
  {
    id: 'educacion',
    nombre: 'Educación',
    actividades: [
      { ciiu: '4761', nombre: 'Libros, periódicos y papelería' },
      { ciiu: '4769', nombre: 'Útiles escolares y otros artículos culturales' },
    ],
  },
]

export const IDS_CATEGORIA = CATEGORIAS.map((c) => c.id) as [string, ...string[]]

/** La categoría de una actividad CIIU; undefined si no está en ninguna (no acepta bonos). */
export function categoriaDe(ciiu: string): Categoria | undefined {
  return CATEGORIAS.find((c) => c.actividades.some((a) => a.ciiu === ciiu))
}

export function nombreCategoria(id: string): string {
  return CATEGORIAS.find((c) => c.id === id)?.nombre ?? id
}

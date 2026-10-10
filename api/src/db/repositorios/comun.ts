import type { SQLInputValue } from 'node:sqlite'

/** Arma `col = :col, …` a partir de un objeto. Las claves salen del código, nunca de la petición. */
export function asignaciones(campos: Record<string, SQLInputValue | undefined>) {
  const definidos = Object.entries(campos).filter(([, v]) => v !== undefined) as [string, SQLInputValue][]
  for (const [k] of definidos) if (!/^[a-z_]+$/.test(k)) throw new Error(`Columna inválida: ${k}`)
  return {
    sql: definidos.map(([k]) => `${k} = :${k}`).join(', '),
    parametros: Object.fromEntries(definidos),
  }
}

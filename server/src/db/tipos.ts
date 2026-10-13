import { customType } from 'drizzle-orm/pg-core'

/**
 * `timestamptz` leído como texto ISO 8601 en UTC («2026-10-12T21:00:00.000Z»), igual que lo
 * guardaba SQLite. Así el resto del código compara y muestra fechas sin cambios. Se escribe
 * también en ISO (PostgreSQL lo entiende). `scripts/esquema.ts` lo pone en `schema.ts` en lugar
 * del `timestamp()` que genera drizzle-kit, que devuelve objetos `Date`.
 */
export const instante = customType<{ data: string; driverData: string }>({
  dataType: () => 'timestamp with time zone',
  fromDriver: (valor) => new Date(valor).toISOString(),
  toDriver: (valor) => valor,
})

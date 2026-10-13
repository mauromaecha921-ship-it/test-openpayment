import { and, eq, gt, sql } from 'drizzle-orm'
import { ejecutor } from '../conexion.js'
import { bloqueo_pin } from '../schema.js'

export type FilaBloqueo = typeof bloqueo_pin.$inferSelect

/**
 * RN-07 con la tabla `bloqueo_pin` de db/003: al tercer PIN errado la persona queda bloqueada
 * en ese programa (HU-11). Reemplaza la deducción del piloto (D-17), que la bloqueaba en todos
 * los programas (D-42). La base también impide cobrar mientras dure (trigger de reglas).
 */
export async function vigente(programaId: string, beneficiarioId: string): Promise<FilaBloqueo | undefined> {
  const [b] = await ejecutor()
    .select()
    .from(bloqueo_pin)
    .where(
      and(
        eq(bloqueo_pin.programa_id, programaId),
        eq(bloqueo_pin.beneficiario_id, beneficiarioId),
        gt(bloqueo_pin.bloqueado_hasta, sql`now()`),
      ),
    )
    .limit(1)
  return b
}

/** Bloquea a la persona en el programa hasta `hasta`; si ya tuvo un bloqueo, lo reemplaza. */
export async function bloquear(args: { programaId: string; beneficiarioId: string; cobroId: string; hasta: string }) {
  await ejecutor()
    .insert(bloqueo_pin)
    .values({
      programa_id: args.programaId,
      beneficiario_id: args.beneficiarioId,
      cobro_id: args.cobroId,
      bloqueado_hasta: args.hasta,
    })
    .onConflictDoUpdate({
      target: [bloqueo_pin.programa_id, bloqueo_pin.beneficiario_id],
      set: { bloqueado_hasta: args.hasta, cobro_id: args.cobroId, creado_en: sql`now()` },
    })
}

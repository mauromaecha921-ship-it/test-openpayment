import { z } from 'zod'

/**
 * Contrato HTTP de la liquidación simulada (P-10, Plan backend § 5): el sistema del gobierno.
 * Es lo que la API espera de él; el simulador lo cumple y el cliente lo valida al recibirlo.
 * Tatú no guarda nombres ni PIN: los pide aquí (Plan Supabase y pnpm § 3).
 */

const unidades = z.string().regex(/^\d+$/, 'monto en unidades mínimas')
export const documento = z.string().regex(/^[A-Za-z0-9]{3,20}$/, 'documento inválido')
const pin = z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos')

export const Resumen = z.object({
  cedulas: z.number().int().nonnegative(),
  total: unidades,
})
export type Resumen = z.infer<typeof Resumen>

export const PagoDisponible = z.object({
  documento,
  disponible: z.literal(true),
  monto: unidades,
  novedad: z.boolean(),
})
export const SinPago = z.object({ disponible: z.literal(false) })
export const Pago = z.union([PagoDisponible, SinPago])
export type Pago = z.infer<typeof Pago>

export const PedidoPin = z.object({ documento, pin })
export const RespuestaPin = z.object({ valido: z.boolean() })

/** Lo que Tatú puede saber de una persona: su nombre y si tiene PIN (nunca el PIN). */
export const Persona = z.object({
  documento,
  nombre: z.string(),
  tienePin: z.boolean(),
})
export type Persona = z.infer<typeof Persona>
export const Personas = z.array(Persona)

/** «Equipo de prueba» hace el papel del gobierno: inscribe a la persona (o la actualiza). */
export const Inscripcion = z.object({
  documento,
  nombre: z.string().trim().min(1).max(120),
  pin: pin.optional(),
})

export const NuevoPin = z.object({ pin })

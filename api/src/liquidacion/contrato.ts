import { z } from 'zod'

/**
 * Contrato HTTP de la liquidación simulada (P-10, Plan backend § 5). Es lo que la API espera
 * del sistema de la entidad; el simulador lo cumple y el cliente lo valida al recibirlo.
 */

const unidades = z.string().regex(/^\d+$/, 'monto en unidades mínimas')
export const documento = z.string().regex(/^[A-Za-z0-9]{3,20}$/, 'documento inválido')

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

export const PedidoPin = z.object({
  documento,
  pin: z.string().regex(/^\d{4}$/, 'el PIN tiene 4 dígitos'),
})
export const RespuestaPin = z.object({ valido: z.boolean() })

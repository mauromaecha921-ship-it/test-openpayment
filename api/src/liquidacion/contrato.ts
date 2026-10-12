// Tipos + Zod del contrato HTTP del simulador de liquidación (P-10 / HU-02).
//
// Lo consume `cobros/orquestacion.ts` (consulta por cédula, RN-01) y lo expone
// `router.ts`. La plataforma NO copia la lista de beneficiarios (AD-12): este
// servicio responde «¿esta cédula tiene un pago disponible y por cuánto?».
import { z } from 'zod'

/** Monto en unidades mínimas + moneda, igual que en Open Payments (RN-11). */
export interface Monto {
  value: string
  assetCode: string
  assetScale: number
}

/** Respuesta de `GET /liquidacion/resumen`; el total es el tope del permiso (RN-08). */
export interface ResumenLiquidacion {
  programa: string
  cedulas: number
  total: Monto
}

/** Respuesta de `GET /liquidacion/cedulas/:documento` (RN-01). */
export interface ConsultaCedula {
  documento: string
  nombre: string
  programa: string
  disponible: boolean
  yaPagado: boolean
  monto: Monto | null
}

const DOCUMENTO = /^[A-Za-z0-9]{3,20}$/

export const esquemaDocumento = z.string().regex(DOCUMENTO, 'Documento inválido')

// Novedad retroactiva que se carga DESPUÉS de aprobar el permiso (RN-09).
export const esquemaNovedad = z.object({
  documento: z.string().regex(DOCUMENTO, 'Documento inválido'),
  nombre: z.string().trim().min(1).max(80),
  monto: z.coerce.number().int().positive(),
})

export type Novedad = z.infer<typeof esquemaNovedad>

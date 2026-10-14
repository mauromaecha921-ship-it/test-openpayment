import { z } from 'zod'
import { documento } from '../liquidacion/contrato.js'

/**
 * Contrato HTTP del banco puente de Bre-B simulado (Plan Bre-B § 3.1, AD-21): lo que Tatú espera de
 * un banco o SEDPE que participa en Bre-B y opera Rafiki. El simulador lo cumple y el cliente lo
 * valida al recibirlo. Tatú nunca guarda el nombre ni la cédula del titular: pregunta «¿es de esta
 * cédula?» y muestra el nombre enmascarado.
 */

export const TIPOS_LLAVE = ['cedula', 'celular', 'correo', 'alfanumerica'] as const
export const TipoLlave = z.enum(TIPOS_LLAVE)
export type TipoLlave = z.infer<typeof TipoLlave>

/**
 * Limpia el valor según el tipo que eligió la persona (RN-14: el tipo nunca se adivina por el
 * formato). Devuelve null si no tiene la forma de ese tipo.
 */
export function normalizarLlave(tipo: TipoLlave, valor: string): string | null {
  const v = valor.trim()
  switch (tipo) {
    case 'cedula': {
      const limpio = v.replace(/[\s.-]/g, '')
      return /^[A-Za-z0-9]{3,20}$/.test(limpio) ? limpio : null
    }
    case 'celular': {
      // Un celular colombiano: 10 dígitos que empiezan por 3 (con o sin +57, espacios o guiones)
      const limpio = v.replace(/[\s()-]/g, '').replace(/^\+?57(?=3\d{9}$)/, '')
      return /^3\d{9}$/.test(limpio) ? limpio : null
    }
    case 'correo': {
      const limpio = v.toLowerCase()
      return limpio.length <= 80 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio) ? limpio : null
    }
    case 'alfanumerica': {
      const limpio = `@${v.replace(/^@/, '')}`.toLowerCase()
      return /^@[a-z0-9._-]{2,30}$/.test(limpio) ? limpio : null
    }
  }
}

/** Una llave del banco: lo que «Equipo de prueba» registra haciendo de banco de cada persona. */
export const Llave = z.object({
  tipo: TipoLlave,
  valor: z.string().trim().min(3).max(80),
  documentoTitular: documento,
  nombreTitular: z.string().trim().min(1).max(120),
  billetera: z.string().trim().regex(/^https:\/\//, 'la wallet va en forma https://'),
})
export type Llave = z.infer<typeof Llave>
export const Llaves = z.array(Llave)

/** Lo que el banco responde a cualquiera que consulta una llave: a dónde llega y el titular enmascarado. */
export const Resolucion = z.object({
  tipo: TipoLlave,
  valor: z.string(),
  billetera: z.string(),
  titular: z.string().describe('Nombre del titular enmascarado: «Ana M*** R***»'),
})
export type Resolucion = z.infer<typeof Resolucion>

export const PedidoPertenece = z.object({ documento })
export const Coincidencia = z.object({ pertenece: z.boolean() })

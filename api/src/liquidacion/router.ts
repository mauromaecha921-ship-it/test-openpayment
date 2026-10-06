import { Router } from 'express'

// Simulador de la liquidación de la entidad (AD-13 / P-02): módulo con router
// propio, expuesto bajo /liquidacion/*. LIQUIDACION_URL puede apuntar a esta
// misma API o a otro proceso SIN cambiar código.
//
// La plataforma no guarda la base de beneficiarios: la consulta por cédula y
// la validación del PIN de prueba se hacen contra este servicio (HU-02, AD-12,
// AD-14). El contrato HTTP se define en `contrato.ts` (P-10, antes del evento).
export const router = Router()

// TODO: endpoints de consulta por cédula y validación de PIN (Rol 2, antes del
// viernes), una vez cerrado el contrato (P-10).

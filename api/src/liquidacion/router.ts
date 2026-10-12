import { Router, type Request, type Response } from 'express'
import { ZodError } from 'zod'
import { esquemaDocumento, esquemaNovedad } from './contrato'
import { cargarNovedad, consultar, marcarPagado, resumen } from './datos'

// Simulador de la liquidación de la entidad (AD-13 / P-02): módulo con router
// propio, expuesto bajo /liquidacion/*. LIQUIDACION_URL puede apuntar a esta
// misma API o a otro proceso SIN cambiar código.
//
// La plataforma no guarda la base de beneficiarios: la consulta por cédula y
// la validación del PIN de prueba se hacen contra este servicio (HU-02, AD-12,
// AD-14). El contrato HTTP se define en `contrato.ts` (P-10, antes del evento).
export const router = Router()

// Cuántas cédulas y el total, para el tope del permiso (RN-08).
router.get('/resumen', (_req: Request, res: Response) => {
  res.json(resumen())
})

// «¿Esta cédula tiene un pago disponible y por cuánto?» (RN-01).
router.get('/cedulas/:documento', (req: Request, res: Response) => {
  const documento = esquemaDocumento.safeParse(req.params.documento)
  if (!documento.success) {
    res.status(400).json({ error: 'Documento inválido' })
    return
  }
  const consulta = consultar(documento.data)
  if (!consulta) {
    res.status(404).json({ error: 'Esta cédula no está en la liquidación' })
    return
  }
  res.json(consulta)
})

// Novedad retroactiva cargada después de aprobar el permiso (demo RN-09).
router.post('/novedades', (req: Request, res: Response) => {
  try {
    const novedad = esquemaNovedad.parse(req.body)
    res.status(201).json(cargarNovedad(novedad))
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: 'Datos inválidos', detalles: error.issues })
      return
    }
    throw error
  }
})

// El operador de la liquidación refleja un cobro ya pagado.
router.post('/cedulas/:documento/pagado', (req: Request, res: Response) => {
  const documento = esquemaDocumento.safeParse(req.params.documento)
  if (!documento.success) {
    res.status(400).json({ error: 'Documento inválido' })
    return
  }
  const consulta = marcarPagado(documento.data)
  if (!consulta) {
    res.status(404).json({ error: 'Esta cédula no está en la liquidación' })
    return
  }
  res.json(consulta)
})

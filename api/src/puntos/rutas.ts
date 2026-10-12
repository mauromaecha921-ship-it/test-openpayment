import { Router, type Request, type Response } from 'express'
import { ZodError } from 'zod'
import * as repoProgramas from '../db/repositorios/programas'
import * as repoPuntos from '../db/repositorios/puntos'
import { obtenerBilletera } from '../openPaymentsService'
import { BilleteraNoResuelveError } from '../programas/servicio'
import {
  MonedaNoCoincideError,
  ProgramaNoExisteError,
  PuntoDuplicadoError,
  registrarPunto,
  type Dependencias,
} from './servicio'

// HU-03 · puntos de retiro (tabla `punto` → walletAddress.get). Las rutas solo
// reciben y validan (Zod); quien decide es `servicio.ts`.
export const rutas = Router()

const dependencias: Dependencias = {
  resolverBilletera: obtenerBilletera,
  programas: { buscarPorId: repoProgramas.buscarProgramaPorId },
  puntos: {
    crear: repoPuntos.crearPunto,
    existeBilletera: repoPuntos.existeBilletera,
    listar: repoPuntos.listarPuntos,
  },
}

// Lista de puntos (la usa HU-08 para ofrecer «en un punto»).
rutas.get('/puntos', async (_req: Request, res: Response) => {
  res.json({ puntos: await repoPuntos.listarPuntos() })
})

// HU-03: registrar un punto de retiro.
rutas.post('/puntos', async (req: Request, res: Response) => {
  try {
    const punto = await registrarPunto(req.body, dependencias)
    res.status(201).json({ punto })
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: 'Datos inválidos', detalles: error.issues })
      return
    }
    if (error instanceof BilleteraNoResuelveError || error instanceof MonedaNoCoincideError) {
      res.status(422).json({ error: error.message })
      return
    }
    if (error instanceof PuntoDuplicadoError) {
      res.status(409).json({ error: error.message })
      return
    }
    if (error instanceof ProgramaNoExisteError) {
      res.status(404).json({ error: error.message })
      return
    }
    console.error('POST /puntos:', error)
    res.status(500).json({ error: 'No pudimos registrar el punto' })
  }
})

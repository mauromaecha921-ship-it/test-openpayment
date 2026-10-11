import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import * as repoEventos from "../db/repositorios/eventos";
import * as repoProgramas from "../db/repositorios/programas";
import {
  AdaptadorPendienteError,
  BilleteraNoResuelveError,
  crearPrograma,
  type Dependencias,
} from "./servicio";
import { obtenerBilletera } from "../openPaymentsService";

// O1, O2, O7, O8 (Estructura § 4). Las rutas solo reciben y validan (Zod);
// quien decide es `servicio.ts` (Arquitectura § 3.2).
export const rutas = Router();

const dependencias: Dependencias = {
  resolverBilletera: obtenerBilletera,
  programas: { crear: repoProgramas.crearPrograma },
  eventos: { registrar: repoEventos.registrarEvento },
};

// O1 · HU-01: conectar un subsidio.
rutas.post("/programas", async (req: Request, res: Response) => {
  try {
    const programa = await crearPrograma(req.body, dependencias);
    res.status(201).json({ programa });
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ error: "Datos inválidos", detalles: error.issues });
      return;
    }
    if (error instanceof BilleteraNoResuelveError) {
      res.status(422).json({ error: error.message });
      return;
    }
    if (error instanceof AdaptadorPendienteError) {
      res.status(501).json({ error: error.message });
      return;
    }
    console.error("POST /programas:", error);
    res.status(500).json({ error: "No pudimos crear el programa" });
  }
});

const pendiente = (_req: Request, res: Response) => {
  res.status(501).json({ error: "pendiente de implementación" });
};

rutas.post("/programas/:id/autorizar", pendiente); // O2: grant interactivo con tope
rutas.get("/callback/:id", pendiente); // O2: verificación de hash + grant.continue
rutas.get("/programas/:id/tablero", pendiente); // O7: autorizado, cobrado y lo que nunca salió
rutas.post("/programas/:id/cerrar", pendiente); // O8: token.revoke / grant.cancel (AD-20)

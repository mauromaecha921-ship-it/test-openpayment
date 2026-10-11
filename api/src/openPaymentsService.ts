// ÚNICO archivo que importa `@interledger/open-payments` y firma peticiones
// (AD-07). El resto de la API habla con este adaptador, nunca con el SDK.
//
// Lo escribe y lo entiende el equipo con poca IA: los mentores revisan este
// archivo (Guía § Estructura del repositorio). NO generar con IA.
//
// Operaciones que debe cubrir (Arquitectura § 4.2 · Llamadas a Open Payments):
//   walletAddress.get · grant.request (saliente interactivo con tope, entrante)
//   grant.continue · verificación de propiedad de wallet address
//   incomingPayment.create · outgoingPayment.create (pago entrante + debitAmount,
//   AD-10) · outgoingPayment.get · outgoingPayment.getGrantSpentAmounts
//   token.rotate · token.revoke / grant.cancel (AD-20, por probar)
//
// TODO: implementar (Rol 1, hito viernes 14:00).

import {
  createUnauthenticatedClient,
  type UnauthenticatedClient,
} from "@interledger/open-payments";

// Cliente público reutilizable (una sola vez, no por request).
let clientePublico: Promise<UnauthenticatedClient> | undefined;
const obtenerClientePublico = () =>
  (clientePublico ??= createUnauthenticatedClient({ validateResponses: true }));

export interface BilleteraResuelta {
  id: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

// O1 · HU-01: resolver una wallet address por su URL https://
export async function obtenerBilletera(
  url: string,
): Promise<BilleteraResuelta> {
  const cliente = await obtenerClientePublico();
  const wallet = await cliente.walletAddress.get({ url });
  return {
    id: wallet.id,
    assetCode: wallet.assetCode,
    assetScale: wallet.assetScale,
    authServer: wallet.authServer,
    resourceServer: wallet.resourceServer,
  };
}

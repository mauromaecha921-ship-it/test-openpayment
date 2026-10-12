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

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAuthenticatedClient,
  createUnauthenticatedClient,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  OpenPaymentsClientError,
  type AccessToken,
  type AuthenticatedClient,
  type IncomingPaymentWithPaymentMethods,
  type OutgoingPayment,
  type OutgoingPaymentGrantSpentAmounts,
  type UnauthenticatedClient,
} from "@interledger/open-payments";
import { config } from "./config";

// --- Clientes ---------------------------------------------------------------

// Cliente p├║blico (sin firma): walletAddress.get.
let clientePublico: Promise<UnauthenticatedClient> | undefined;
const obtenerClientePublico = () =>
  (clientePublico ??= createUnauthenticatedClient({ validateResponses: true }));

// Cliente firmado (Ed25519): el resto de operaciones. Se crea una sola vez.
let clienteFirmado: Promise<AuthenticatedClient> | undefined;

function cargarClavePrivada(): string {
  return readFileSync(
    resolve(process.cwd(), config.OP_PRIVATE_KEY_PATH),
    "utf8",
  );
}

const obtenerClienteFirmado = () =>
  (clienteFirmado ??= createAuthenticatedClient({
    walletAddressUrl: config.OP_CLIENT_WALLET_ADDRESS,
    keyId: config.OP_KEY_ID,
    privateKey: cargarClavePrivada(),
    validateResponses: true,
  }));

// --- Tipos compartidos ------------------------------------------------------

export interface MontoOP {
  value: string;
  assetCode: string;
  assetScale: number;
}

export interface BilleteraResuelta {
  id: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer: string;
}

/** Permiso interactivo pendiente (hay que abrir `redirectUrl`). */
export interface PermisoPendiente {
  redirectUrl: string;
  continueUri: string;
  continueToken: string;
  nonce: string;
  finishUri: string;
}

/** Permiso ya concedido (token de acceso). */
export interface PermisoConcedido {
  accessToken: string;
  manageUrl: string;
  expiresIn: number | undefined;
}

// --- O1 ┬À HU-01 / HU-03: resolver una wallet address ------------------------

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

// --- O2 ┬À HU-04: permiso saliente interactivo, con tope y sin receptor ------

export async function solicitarPermisoSaliente(args: {
  walletPrograma: string;
  tope: MontoOP;
  finishUri: string;
}): Promise<PermisoPendiente> {
  const cliente = await obtenerClienteFirmado();
  const programa = await cliente.walletAddress.get({
    url: args.walletPrograma,
  });
  const nonce = randomBytes(16).toString("hex");

  const grant = await cliente.grant.request(
    { url: programa.authServer },
    {
      access_token: {
        access: [
          {
            type: "outgoing-payment",
            identifier: args.walletPrograma,
            actions: ["create", "read", "read-all", "list"],
            limits: { debitAmount: args.tope },
          },
        ],
      },
      interact: {
        start: ["redirect"],
        finish: { method: "redirect", uri: args.finishUri, nonce },
      },
    },
  );

  if (!isPendingGrant(grant)) {
    throw new Error("Se esperaba un permiso interactivo pendiente");
  }

  return {
    redirectUrl: grant.interact.redirect,
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
    nonce,
    finishUri: args.finishUri,
  };
}

// --- O2 ┬À HU-05: canjear el permiso tras el callback ------------------------

export async function continuarPermiso(args: {
  continueUri: string;
  continueToken: string;
  interactRef: string;
}): Promise<PermisoConcedido> {
  const cliente = await obtenerClienteFirmado();
  const grant = await cliente.grant.continue(
    { url: args.continueUri, accessToken: args.continueToken },
    { interact_ref: args.interactRef },
  );

  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error("El permiso no devolvi├│ un access token");
  }

  return {
    accessToken: grant.access_token.value,
    manageUrl: grant.access_token.manage,
    expiresIn: grant.access_token.expires_in,
  };
}

// --- O3 ┬À HU-07: enlazar y verificar la cuenta del beneficiario -------------
// El propio due├▒o aprueba en su Test Wallet: la aprobaci├│n prueba la propiedad.

export async function solicitarEnlaceDeCuenta(args: {
  walletCuenta: string;
  finishUri: string;
}): Promise<PermisoPendiente> {
  const cliente = await obtenerClienteFirmado();
  const cuenta = await cliente.walletAddress.get({ url: args.walletCuenta });
  const nonce = randomBytes(16).toString("hex");

  const grant = await cliente.grant.request(
    { url: cuenta.authServer },
    {
      access_token: {
        access: [
          {
            type: "incoming-payment",
            identifier: args.walletCuenta,
            actions: ["create", "read"],
          },
        ],
      },
      interact: {
        start: ["redirect"],
        finish: { method: "redirect", uri: args.finishUri, nonce },
      },
    },
  );

  if (!isPendingGrant(grant)) {
    throw new Error("Se esperaba un permiso interactivo pendiente");
  }

  return {
    redirectUrl: grant.interact.redirect,
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
    nonce,
    finishUri: args.finishUri,
  };
}

// --- O4 ┬À HU-09: pago entrante en la cuenta del beneficiario ----------------

export async function crearPagoEntrante(args: {
  resourceServer: string;
  accessToken: string;
  walletCuenta: string;
  monto: MontoOP;
  descripcion?: string;
  expiraEn?: string;
}): Promise<IncomingPaymentWithPaymentMethods> {
  const cliente = await obtenerClienteFirmado();
  return cliente.incomingPayment.create(
    {
      url: `${args.resourceServer}/incoming-payments`,
      accessToken: args.accessToken,
    },
    {
      walletAddress: args.walletCuenta,
      incomingAmount: args.monto,
      expiresAt: args.expiraEn,
      metadata: args.descripcion
        ? { description: args.descripcion }
        : undefined,
    },
  );
}

// --- O4 ┬À HU-10: pago saliente desde el programa (AD-10: debitAmount) --------

export async function crearPagoSaliente(args: {
  resourceServer: string;
  accessToken: string;
  walletPrograma: string;
  pagoEntranteUrl: string;
  monto: MontoOP;
  metadata?: Record<string, unknown>;
}): Promise<OutgoingPayment> {
  const cliente = await obtenerClienteFirmado();
  return cliente.outgoingPayment.create(
    {
      url: `${args.resourceServer}/outgoing-payments`,
      accessToken: args.accessToken,
    },
    {
      walletAddress: args.walletPrograma,
      incomingPayment: args.pagoEntranteUrl,
      debitAmount: args.monto,
      metadata: args.metadata,
    },
  );
}

// --- O6 ┬À HU-10 / RN-10: consultar un pago saliente -------------------------

export async function consultarPagoSaliente(args: {
  url: string;
  accessToken: string;
}): Promise<OutgoingPayment> {
  const cliente = await obtenerClienteFirmado();
  return cliente.outgoingPayment.get({
    url: args.url,
    accessToken: args.accessToken,
  });
}

// --- O7 ┬À HU-15: cu├ínto del tope se ha gastado ------------------------------

export async function consumoDelPermiso(args: {
  resourceServer: string;
  accessToken: string;
}): Promise<OutgoingPaymentGrantSpentAmounts> {
  const cliente = await obtenerClienteFirmado();
  return cliente.outgoingPayment.getGrantSpentAmounts({
    url: `${args.resourceServer}/outgoing-payment-grant`,
    accessToken: args.accessToken,
  });
}

// --- HU-06: rotar el token del permiso --------------------------------------

export async function rotarToken(args: {
  manageUrl: string;
  accessToken: string;
}): Promise<AccessToken> {
  const cliente = await obtenerClienteFirmado();
  return cliente.token.rotate({
    url: args.manageUrl,
    accessToken: args.accessToken,
  });
}

// --- O8 ┬À HU-17: cerrar el programa (revocar el permiso) --------------------
// AD-20/P-13: probar en la Test Wallet cu├íl de las dos deja el permiso inservible.

export async function revocarToken(args: {
  manageUrl: string;
  accessToken: string;
}): Promise<void> {
  const cliente = await obtenerClienteFirmado();
  await cliente.token.revoke({
    url: args.manageUrl,
    accessToken: args.accessToken,
  });
}

export async function cancelarPermiso(args: {
  continueUri: string;
  continueToken: string;
}): Promise<void> {
  const cliente = await obtenerClienteFirmado();
  await cliente.grant.cancel({
    url: args.continueUri,
    accessToken: args.continueToken,
  });
}

// --- Utilidades -------------------------------------------------------------

export { OpenPaymentsClientError };

/** ┬┐El error del SDK es un 404 (recurso wallet/pago inexistente)? */
export function esRecursoNoEncontrado(error: unknown): boolean {
  return error instanceof OpenPaymentsClientError && error.status === 404;
}

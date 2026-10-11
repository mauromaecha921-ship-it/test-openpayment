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

// Orquestación del cobro (P-20): liquidación → transición → pagar → guardar
// (Arquitectura § 3.4, pasos 1-10).
//
// Punto de no retorno (HU-12): guardar Pagando y su evento ANTES de llamar a
// Open Payments; después no hay rollback, solo consulta con outgoingPayment.get.
// InsufficientGrant del banco → Fallido sin mover dinero (RN-09, AD-11).
//
// TODO: implementar (Rol 2). Pendiente P-09: qué dispara el pago en el canal
// cuenta (POST /cobros paga directo o el navegador llama a confirmar sin PIN).

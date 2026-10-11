// Verificación del hash del callback interactivo (HU-04) con las 3 variantes
// base64 (Hallazgos § 3.5). Función pura: sin red ni base de datos.
//
// El callback es idempotente y maneja `grant_rejected` y `grant_invalid`
// (Guía § Revisión · Callback con verificación de hash).
//
// TODO: implementar (Rol 1). Test bloqueante: «hash alterado → rechazado» (RNF-01).

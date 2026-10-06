// Cédulas de prueba, montos y PIN de prueba del simulador (Arquitectura § 4.1):
//
//   - 3 cédulas de $230.000 (tope del programa: $690.000): Ana y otra persona
//     con cuenta; Jorge sin celular, cobra en el punto.
//   - 1 cédula con retroactivo de $460.000 que se carga DESPUÉS de aprobar el
//     permiso, para que el banco rechace ese cobro por tope (InsufficientGrant,
//     RN-09).
//   - Bono (extra HU-21, tras EXTRA_BONO): 2 cédulas de $60.000.
//
// PIN de prueba: lo valida este servicio; la plataforma NO lo guarda (AD-14,
// RNF-06). Bloqueo tras 3 PIN fallidos: pendiente P-12.
//
// TODO: implementar (Rol 2, antes del viernes).

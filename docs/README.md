# Documentación del proyecto «Justo a Tiempo»

Índice de todo lo que hay en esta carpeta. **El repositorio es solo documentación: todavía no
existe código de producto** (la estructura de código planeada está en
[`Estructura del proyecto.md`](./Estructura%20del%20proyecto.md)).

## Documentos

| Documento | Qué es | Cuándo leerlo | Estado |
|---|---|---|---|
| [Documento Guía — Hackathon Open Payments.md](./Documento%20Guía%20—%20Hackathon%20Open%20Payments.md) | Fuente de producto: contexto, alcance del MVP, stack tecnológico, API REST (9 rutas), plan de implementación, roles, seguridad y pitch | **Primer documento** para cualquiera que entre al equipo | Activo |
| [Documento de Arquitectura — Hackathon Open Payments.md](./Documento%20de%20Arquitectura%20—%20Hackathon%20Open%20Payments.md) | Decisiones AD-01…AD-20, patrones de frontend/backend, diagramas, recorrido de operaciones O1-O8 y pendientes P-01…P-25 | Al diseñar o revisar cualquier parte técnica | Activo; 13/20 decisiones tomadas |
| [Historias de Usuario — Bonos con Destino.md](./Historias%20de%20Usuario%20—%20Bonos%20con%20Destino.md) | 25 HU con criterios de aceptación, reglas de negocio RN-01…RN-13, requisitos no funcionales RNF-01…RNF-12, diccionario de datos y variables de entorno | Al implementar cada funcionalidad o validarla | Activo |
| [ENDPOINTS.md](./ENDPOINTS.md) | Guía paso a paso (17 pasos) contra el sandbox de pruebas: grants, firma RFC 9421, interacción con la Test Wallet | Al probar a mano contra Open Payments | **Tiene 8 correcciones pendientes** → ver Hallazgos § 2 |
| [Hallazgos — Investigación de Fuentes.md](./Hallazgos%20—%20Investigación%20de%20Fuentes.md) | Consolidación de la investigación: correcciones a ENDPOINTS, evidencia de spec para P-05/P-07/P-13, payloads JSON de referencia, checklist de pruebas T-1…T-9, anexo de repos | Antes de programar cualquier llamada a Open Payments y antes de las pruebas del 8 de oct | Activo (6 oct 2026) |
| [Estructura del proyecto.md](./Estructura%20del%20proyecto.md) | Diseño del árbol de carpetas futuro (api/, web/, liquidación), decisiones de estructura (P-02, P-11, P-15, P-20), mapas ruta→archivo y HU→archivo | Al crear el esqueleto del código | Diseño, sin código |
| [script-incoming-payment-grant.ts](./script-incoming-payment-grant.ts) | Script *pre-request* de Bruno que firma un grant de incoming-payment (firma RFC 9421/Ed25519) | Como referencia de firma; no es ejecutable en CI | Referencia |

## Orden de lectura recomendado

1. **Guía** (producto, alcance, stack).
2. **Historias** (qué se construye, reglas y criterios).
3. **Arquitectura** (cómo se construye y qué decisiones ya están tomadas).
4. **Hallazgos** (qué dice la especificación oficial y qué corregir).
5. **ENDPOINTS** (cómo probar contra la Test Wallet, con las correcciones de Hallazgos § 2).
6. **Estructura del proyecto** (dónde vivirá el código cuando se empiece).

## Convenciones

- **Nombres:** los documentos del equipo conservan su nombre original; se unificó el guion
  largo `—` (em dash) al moverlos a `docs/`.
- **Movimientos:** los archivos se movieron con `git mv` desde la raíz (historial intacto).
- **Actualización:** los documentos del equipo los editan sus dueños; este índice y los
  documentos nuevos (Hallazgos, Estructura) los mantiene quien los creó. Si una decisión
  cambia, actualizar Arquitectura § 3.5 y, si afecta el árbol, `Estructura del proyecto.md`.
- **Secretos:** aquí no va nada sensible; `.env` y llaves viven fuera del repo (RNF-01).

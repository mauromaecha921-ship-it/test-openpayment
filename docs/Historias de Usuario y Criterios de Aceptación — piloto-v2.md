# Historias de Usuario y Criterios de Aceptación — ramas `remotes/origin/piloto-v2`

**Proyecto:** Tatú — capa de distribución que convierte una liquidación ya aprobada en pagos bajo demanda con Open Payments.
**Rama revisada:** `remotes/origin/piloto-v2` (commit `84d6321`, 13 oct 2026). **Fuente comparada:** `docs/` del mismo branch (`API del piloto.md`, `Plan de ajustes.md`, `Historias de Usuario — Bonos con Destino.md`) vs. la implementación real en `server/src` y `server/src/openapi.ts`.
**Uso:** documento de desarrollo para la hackathon. Contiene únicamente las historias, sus criterios, las rutas que ya existen en el branch y los datos necesarios para construir/testear. Sin pitch, sprint ni riesgos.

## 0. Convenciones y datos base

- Formato: `HU-XX` por historia; `CA-XX.YY` por criterio. Escenarios en **Dado / Cuando / Entonces**.
- Prioridad (MoSCoW): **Must** = flujo principal · **Should** = baja riesgo · **Could** = extra, se enciende con `EXTRA_*` · **Won't** = fuera de la hackathon.
- Montos: entero en unidades mínimas + `assetCode` + `assetScale`. Demo: $230.000,00 = `"23000000"` con escala 2 (COP).
- Atlas de prueba:
  - Programa subsidio: 3 cédulas de $230.000 (total tope $690.000 = `69000000`).
  - Novedad retroactiva: cédula `1000000004` con $460.000, cargada **después** de aprobar el permiso (muestra `InsufficientGrant`).
  - Bono (extra HU-21): 2 cédulas de $60.000.
  - 1 sanitario/prueba PIN sugerido: `1234` (PIN demo).
- Todos los endpoints van bajo `/api` (ej. `GET /api/programas`). Swagger interactivo en `/api/docs`, JSON en `/api/openapi.json` (validado por `openapi.test.ts`).
- Resultado de la comparación endpoints vs. documentación:
  - La Guía define **9 rutas** (producto original).
  - El branch `piloto-v2` implementa **46 rutas en total según el catálogo** (`docs/piloto/API del piloto.md`), incluidas 6 del simulador de gobierno y 3 de salud/​estado/​config. Todas están montadas en `server/src/app.ts` y declaradas en `RUTAS`.
  - Toda la comunicación con Open Payments pasa por `openPaymentsService`; las vistas de respuesta se arman en `comun/vistas.ts`.

## 1. Actores y sistemas

| Actor/Sistema | Rol en la demo | Vista |
| --- | --- | --- |
| Entidad financiadora (Laura) | Crea el programa, aprueba permiso con tope, tablero y cierre | Web, computador |
| Beneficiaria con cuenta (Ana) | Enlaza wallet verificada, cobra a su cuenta | Web, celular (360 px) |
| Beneficiario sin celular (Jorge) | Cobra en punto con cédula + PIN | Ninguna vista, solo cédula y PIN |
| Punto de retiro (Marta) | Digita cédula, confirma PIN, entrega efectivo y recupera el cobro | Web, celular |
| Plataforma (API) | Aplica reglas, guarda programas/cuentas/cobros, firma OP | Backend |
| Liquidación del gobierno (simulada) | Responde por cédula si hay pago y por cuánto; en la demo valida el PIN | Servicio HTTP externo (`LIQUIDACION_URL`) |
| Test Wallet (Interledger) | Custodia wallets, ejecuta pagos, hace cumplir el tope (`InsufficientGrant`) | Browser del consentimiento |

---

# E1 · Conexión del subsidio

## HU-01 · Conectar un subsidio
**Épica:** E1 · **Must · 3 pts** · Roles: 4 (vista) y 2 (API) · Depende de HU-19 · opponentes: `POST /programas`, `GET/PUT /programas/:id`, `GET /billeteras/resolver`.

Endpoints implementados:
- `GET /billeteras/resolver?direccion=...` → `{ id, nombre, moneda: { codigo, escala } }` (400/404/503).
- `POST /programas` body `EntradaPrograma` → 201 `Programa`; errores 400/404/409/503.
- `GET /programas/:id`, `PATCH /programas/:id` → 200/404/409.
- `GET /programas/:id/liquidacion` → `{ cedulas, total, moneda }` (200/404/503).

Criterios de aceptación:
- **CA-01.01 (creación):** Dado un programa nuevo, cuando envío `POST /programas` con `entidad`, `nombre`, `billetera`, `vigenciaInicio`, `vigenciaFin` (y `tipo` por defecto `subsidio`), entonces se crea en estado `Borrador`, `destino=libre` y canales a la cuenta y al retiro. No se mueve dinero.
- **CA-01.02 (normalización de wallet):** Dado un payment pointer con `$`, cuando guardo, entonces se convierte a `https://` (se quita `$` y la barra final). Si la wallet no resuelve (`walletAddress.get`), responde **404 `BilleteraNoEncontrada`** con mensaje "No encontramos esa cuenta" y **no se guarda**.
- **CA-01.03 (moneda copiada):** Dado billetera válida, cuando guardo, entonces `assetCode` y `assetScale` se copian de la wallet resuelta; **no vienen del request**. La pantalla muestra la moneda real.
- **CA-01.04 (vigencia):** Dado `vigenciaFin <= vigenciaInicio`, cuando guardo, entonces responde 400 `EntradaInvalida` (validación Zod).
- **CA-01.05 (bono):** Dado `tipo=bono`, cuando creo, entonces `destino=restringido` y `categorias` (máx. 10) quedan asociadas. Un bono sin categorías no se puede autorizar (409 `BonoSinCategorias`).
- **CA-01.06 (edición):** Dado un programa en `Borrador`, cuando hago `PATCH /programas/:id`, entonces se pueden cambiar todos los campos, incluidos `montoPorPersona` y `categorias`; fuera de `Borrador` responde 409 `EstadoNoPermite`.
- **CA-01.07 (evento):** Al crear exitosamente, se registra un evento `programa` con `hacia='Borrador'`, `detalle` con billetera/código de moneda y `actor='entidad'`. **Nunca** se guardan tokens, PIN ni llaves.
- **CA-01.08 (listado):** `GET /programas` devuelve la lista con `estado`, `permisoActivo`, `permisoVencido`, tope y monto por persona, aplicando el vencimiento de aprobación (10 min).

## HU-02 · Consultar la liquidación de la entidad
**Épica:** E1 · **Must · 3 pts** · Rol 2 · Depende de HU-01 · Servicio simulado en `LIQUIDACION_URL`.

Endpoints implementados:
- `GET /liquidacion/programas/:programaId/resumen` → `{ programa, cedulas, total }` (200/503).
- `GET /liquidacion/programas/:programaId/pagos/:documento` → `{ disponible, monto }` o `{ disponible:false }` (200/404/503).
- `GET /programas/:id/liquidacion` (proxy de Tatú) → `{ cedulas, total, moneda }`.
- `POST /liquidacion/personas`, `GET /liquidacion/personas?documentos=...`, `POST /liquidacion/personas/:documento/pin`.

Criterios de aceptación:
- **CA-02.01:** Dado un programa en `Borrador`, cuando conecto la liquidación de prueba, entonces `/liquidacion/programas/:id/resumen` devuelve `cedulas=3` y `total` = 3 × $230.000 (COP, scale 2). Ese total será `tope_total` al autorizar (RN-08).
- **CA-02.02:** Dado una cédula `1000000001|1000000002|1000000003`, `GET /liquidacion/programas/:id/pagos/:documento` responde con `disponible=true` y `monto`.
- **CA-02.03:** Dado una cédula ya pagada (`POST /liquidacion/personas/:documento/pin`/marcada pagada), consultar devuelve `disponible=false` y `monto=null`.
- **CA-02.04:** Dado una cédula inexistente, responde **404** "Esta cédula no está en la liquidación".
- **CA-02.05:** La plataforma **no** copia la lista: solo guarda cuentas enlazadas (HU-07) y cada cobro. La consulta a la liquidación fallida (503 o red) rechaza el cobro con "No pudimos consultar tu pago; intenta en un momento" y registra un evento (CA-02.06).
- **CA-02.07 (novedad retroactiva):** `POST /liquidacion/novedades` (o `POST /liquidacion/personas`) permite agregar la cédula `1000000004` con $460.000 **después** de aprobar el permiso. La plataforma **no** frena por el tope (RN-09): el banco responde `InsufficientGrant` → cobro `Fallido`.

## HU-03 · Registrar puntos de retiro
**Épica:** E1 · **Must · 1 pt** · Rol 4 · Depende de HU-01.

Endpoints implementados:
- `GET /puntos` → `[Punto]` (200).
- `POST /puntos` body `EntradaPunto` → 201 `Punto`; 400/404/409.

Criterios de aceptación:
- **CA-03.01:** Dado `POST /puntos` con `nombre`, `direccion` (opcional, mínimo 3; si no, 'Sin dirección'), `billetera` y `tipo` ('retiro' por defecto), entonces crea el punto. Si llega `programaId`, la moneda del punto debe ser la del programa (409 `MonedaDistinta`).
- **CA-03.02:** Dado billetera válida, se resuelve con `resolverWallet` (404 `BilleteraNoEncontrada` "No encontramos esa billetera del punto" si no resuelve).
- **CA-03.03:** Billetera normalizada a `https://` (sin barra final). Duplicado de billetera → 409 `PuntoExiste`.
- **CA-03.04 (eventos):** El alta del punto puede registrarse como evento `punto` si aplica (HU-16).

---

# E2 · Autorización con Open Payments

## HU-04 · Aprobar el permiso con tope en el banco
**Épica:** E2 · **Must · 8 pts** · Rol 1 · Depende de HU-01, HU-02.
Endpoints: `POST /programas/:id/autorizar` (200/404/409/502/503), `GET /callback/:id` (302).
Open Payments: `grant.request` (outgoing, acciones `create`+`read`, `limits.debitAmount`=tope total, **sin receptor fijo**, `interact.finish` con `nonce` propio) y luego `grant.continue`.

Criterios de aceptación:
- **CA-04.01:** Dado un programa `Borrador` con liquidación conectada (y si es bono, con categorías), cuando pulso "Aprobar", entonces la API genera el grant interactivo con tope = `tope_total` (COP scale 2), pasa a `EsperandoAprobacion` y responde `{ redirect, programa }` con la URL de la Test Wallet.
- **CA-04.02:** La API guarda `uri_continuacion`, `token_continuacion`, `nonce_cliente`, `nonce_cierre`, `url_permiso`, `aprobacion_solicitada_en`. **No** guarda `interact.redirect`. Responde con `redirectUrl` para abrir en el navegador.
- **CA-04.03 (callback OK):** Dado que apruebo en la Test Wallet, cuando el callback llega con `interact_ref` y `hash`, entonces `GET /callback/:id` verifica el hash con `SHA-256(nonce_cliente + "\n" + nonce_cierre + "\n" + interact_ref + "\n" + grant_url)` (base64, acepta 3 variantes: raw, sin padding, url-safe), llama `grant.continue`, guarda `access_token` y `manage_url`, y el programa pasa a `Activo`. Redirige a la web (`302`).
- **CA-04.04 (hash inválido):** Dado un callback con hash inválido, cuando llega, entonces se registra un evento, el programa **no** cambia y se redirige con resultado `invalido`.
- **CA-04.05 (idempotencia):** Dado el mismo callback dos veces, cuando llega el segundo, entonces no cambia nada (si ya está `Activo`, redirige con `aprobado`).
- **CA-04.06 (permiso sin receptor fijo):** El mismo permiso paga a cuentas de beneficiarios y a puntos (sin receptor fijo). Es un límite de desembolso, no reserva plata.

## HU-05 · Manejar una aprobación rechazada o vencida
**Épica:** E2 · **Must · 2 pts** · Rol 1 · Depende de HU-04.
Endpoints: `POST /programas/:id/cancelar-aprobacion` (200/404/409).

Criterios de aceptación:
- **CA-05.01 (rechazada):** Dado `result=grant_rejected` en el callback, cuando llega, entonces el programa vuelve a `Borrador` y se redirige con `rechazado` ("No aprobaste el permiso; puedes intentarlo de nuevo").
- **CA-05.02 (inválida/vencida):** Dado `result=grant_invalid` o más de `APROBACION_TTL_MIN` (10) minutos sin aprobar, cuando el usuario vuelve a la app, entonces el programa vuelve a `Borrador` con mensaje claro (`aplicarVencimiento`).
- **CA-05.03 (cancelar manual):** Dado un programa en `EsperandoAprobacion`, `POST /programas/:id/cancelar-aprobacion` llama `grant.cancel` (best-effort) y vuelve a `Borrador`.
- **CA-05.04 (configuración preservada):** En ambos casos se conserva la configuración y queda un evento `programa` con el resultado.

## HU-06 · Rotar el token del permiso
**Épica:** E2 · **Should · 2 pts** · Rol 1 · Depende de HU-04.
Endpoints: `POST /programas/:id/renovar-permiso` (200/404/409/502/503); notar que la rotación automática vive en `programas/servicio.ts`.

Criterios de aceptación:
- **CA-06.01 (rotación automática):** Dado un access token vencido (401 al crear un pago), cuando la API lo detecta, entonces rota el token con `token.rotate`, guarda el nuevo y **reintenta una sola vez** (mutex `rotaciones` por programa para concurrencia).
- **CA-06.02 (falla):** Dado que la rotación falla, cuando ocurre, entonces el cobro pasa a `Fallido` y la entidad ve "El permiso venció: apruébalo de nuevo".
- **CA-06.03 (renovación manual por estar API apagada):** Dado un programa `Activo/Pausado` con `permiso_vencido_en` (la API estuvo apagada), `POST /programas/:id/renovar-permiso` pide un permiso nuevo **solo por el monto restante** (`tope - sumaComprometida`); si `restante <= 0`, 409 `TopeAgotado`. Lo ya cobrado se conserva (D-35). El callback de renovación corre en `callbackRenovacion` y actualiza `gastado_permisos_anteriores`.

## HU-07 · Enlazar y verificar mi cuenta
**Épica:** E3 · **Must · 5 pts** · Roles 1 y 3 · Depende de HU-19.
Endpoints: `POST /cuentas` (201/400/404/409/422), `GET /cuentas/callback/:id` (302), `GET /cuentas/:documento` (200/400/404).

Criterios de aceptación:
- **CA-07.01 (PIN previo):** Dado mi cédula y mi wallet, cuando pulso "Enlazar", entonces primero confirmo con mi PIN si ya tiene PIN en el gobierno; sin PIN disponible no exige PIN (plan B).
- **CA-07.02 (por verificar):** Dado PIN correcto (422 `PinIncorrecto` si es errado o falta cuando lo exige), cuando continúo, entonces (con `VERIFICACION_CUENTA=subject`) la app va a la Test Wallet y la cuenta queda `PorVerificar`; con `simulada`, queda `Verificada` directamente.
- **CA-07.03 (callback OK):** Dado que apruebo, cuando el callback llega con hash válido, entonces la cuenta queda `Verificada` y se guarda `verificada_en` ("Tu cuenta está lista para recibir pagos"). Hash base64 sobre `nonce + "\n" + finish_nonce + "\n" + interact_ref + "\n" + grant_url` (authServer de la wallet del beneficiario).
- **CA-07.04 (rechazo/vencimiento):** Dado que rechazo o pasan `APROBACION_TTL_MIN` min, cuando vuelvo, entonces la cuenta queda `SinEnlazar` y puede reintentarse (aplicarVencimiento por evento `PorVerificar`).
- **CA-07.05 (una cuenta vigente por persona):** Al enlazar, si ya existe cuenta vigente, se desenlaza la anterior con evento y se crea la nueva (índice `una_cuenta_vigente`).
- **CA-07.06 (mínimo guardado):** La plataforma guarda solo `wallet_address` y estado de la cuenta, **nunca** tokens de la cuenta del beneficiario.

## HU-08 · Ver "tengo $230.000"
**Épica:** E3 · **Must · 2 pts** · Rol 3 · Depende de HU-02.
Endpoint: `GET /beneficiarios/:documento/resumen` → `{ persona, pagos[], pago, liquidacionDisponible, cuenta, ultimoCobro, historial }` (200/400/404).

Criterios de aceptación:
- **CA-08.01:** Dado mi cédula con pago disponible, cuando abro la vista Beneficiario, entonces veo todos mis subsidios/bonos pendientes (`pagos[]`), en qué cuenta y con qué moneda, además de "A mi cuenta" (si `cuenta.estado=Verificada`) y "En un punto" con los puntos disponibles.
- **CA-08.02 (ya cobrado):** Dado un subsidio ya cobrado, cuando abro la vista, entonces veo cuándo, dónde y la referencia (`ultimoCobro`/`historial`).
- **CA-08.03 (mobile):** La pantalla se lee completa a 360 px de ancho (RNF-03/RNF-04).
- **CA-08.04 (múltiples programas):** Una persona puede tener varios subsidios pendientes (HU-08 ampliada en Plan de ajustes).

## HU-09 · Cobrar a mi cuenta
**Épica:** E3 · **Must · 3 pts** · Rol 1 · Depende de HU-04, HU-07, HU-12. Endpoint: `POST /cobros` con `canal='cuenta'` (201/400/404/409/503).

Criterios de aceptación:
- **CA-09.01:** Dado un subsidio disponible y mi cuenta `Verificada`, cuando pulso "Cobrar $X", entonces el cobro pasa de `Solicitado` a `Pagando` **sin PIN** (la cuenta ya probó ser mía) y se llama al adaptador de pago (incoming en destino + outgoing del programa con `debitAmount`).
- **CA-09.02:** Dado que el pago se completa, cuando la app consulta `GET /cobros/:id`, entonces veo `Pagado` y la Test Wallet de destino muestra el ingreso con la referencia.
- **CA-09.03:** Dado una cuenta sin verificar (`SinEnlazar`/`PorVerificar`), cuando intento cobrar, entonces 409 `CuentaNoVerificada` y mensaje "Primero enlaza y verifica tu cuenta" (RN-04).
- **CA-09.04 (reconsumo):** Repetir la misma `llaveIdempotencia` devuelve el mismo cobro (no duplica el pago).

---

# E4 · Cobro en el punto

## HU-10 · Solicitar un cobro con la cédula digitada
**Épica:** E4 · **Must · 5 pts** · Roles 3 (vista) y 2 (API) · Depende de HU-02, HU-03. Endpoints: `POST /cobros` con `canal='retiro'` (201/400/404/409/503), `GET /puntos/:id/pagos?documento=...` (200/400/404/503).

Criterios de aceptación:
- **CA-10.01 (punto consulta cédula):** Dado una cédula con subsidio disponible, cuando el cajero la digita en `GET /puntos/:id/pagos`, entonces ve "Pago disponible: $230.000" con el persona y sus pagos; si la cédula no existe o no tiene pagos, 404 `SinPagoDisponible` (no se filtra si existe).
- **CA-10.02 (solicitud):** Dado la solicitud `POST /cobros` con `canal='retiro'`, `documento`, `puntoId`, `llaveIdempotencia` (y opcional `programaId`), entonces el cobro queda `PorConfirmar` (espera PIN) y se aplica RN-01 a RN-06 (liquidación, programa, cuenta, destino, vigencia, moneda). El monto **nunca** viene del navegador (RN-11); el backend calcula `monto = valor_disponible` para subsidios (RN-05).
- **CA-10.03 (monto no mutable):** Dado que el cajero cambia el monto, cuando envía, entonces la API solo acepta el valor disponible (no hay campo `monto` en la entrada; solo `totalCompra` para bonos).
- **CA-10.04 (rechazos al solicitar):** Dado cédula sin pago disponible / programa pausado / cuenta no verificada / destino no permitido, cuando solicita, entonces 404/409 según corresponde y **no se crea ningún pago** (ver HU-13).
- **CA-10.05 (idempotencia y carrera):** Dado un doble clic, cuando llegan dos envíos con la misma `llaveIdempotencia`, entonces se devuelve el mismo cobro. Dos cédulas distintas/procesos concurrentes no duplican pagos (índice único parcial programa+cédula en estados activos, RN-02).

## HU-11 · Confirmar con PIN
**Épica:** E4 · **Must · 3 pts** · Rol 3 · Depende de HU-10.
Endpoint: `POST /cobros/:id/confirmar` body `{ pin }` (200/202/400/404/422).

Criterios de aceptación:
- **CA-11.01:** Dado un cobro `PorConfirmar`, cuando se envía el PIN correcto, entonces el servicio simulado (`POST /liquidacion/pin/validar`) lo valida y el cobro pasa a `Pagando` (202) con el adaptador de pago.
- **CA-11.02:** Dado un PIN incorrecto, cuando se envía, entonces 422 `PinIncorrecto` y la respuesta incluye `intentosRestantes` (mensaje "PIN incorrecto, te quedan N intentos").
- **CA-11.03:** Dado el tercer PIN incorrecto, cuando se envía, entonces el cobro pasa a `Rechazado` (motivo correspondiente) y la cédula queda bloqueada 15 min en ese programa (RN-07, bloqueo por PIN, `PIN_BLOQUEO_MIN`).
- **CA-11.04 (timeout):** Dado que nadie confirma en `CONFIRMACION_TTL_SEG` (120 s), cuando vence el plazo, entonces el cobro pasa a `Rechazado` por tiempo agotado y no se mueve dinero (RN-12).
- **CA-11.05 (plataforma):** La plataforma **no** guarda PIN ni huellas; el PIN lo valida el simulador del gobierno. En producción el PIN es simplificación de la biometría del operador autorizado por la Registraduría.

## HU-12 · Recibir el reembolso en segundos
**Épica:** E4 · **Must · 8 pts** · Rol 1 · Depende de HU-04, HU-11.
Endpoint: `GET /cobros/:id` → `Cobro` con línea de tiempo (200/404).
Open Payments: `incoming-payment` (grant + create, monto + `metadata` con referencia) en la wallet destino; `outgoing-payment` (create desde la cuenta del programa con `incomingPayment` + `debitAmount` y el token del permiso); `outgoingPayment.get` hasta completar; `getGrantSpentAmounts` para el tablero.

Criterios de aceptación:
- **CA-12.01:** Dado un cobro confirmado (a cuenta o retiro), cuando la API va a pagar, entonces guarda `Pagando` **antes** de llamar a Open Payments y guarda las URLs `incoming_payment_url` y `outgoing_payment_url` en el cobro.
- **CA-12.02:** Dado que el pago se completa, cuando el punto consulta `GET /cobros/:id`, entonces el cobro pasa a `Pagado` (`RN-10`) y la caja muestra "Pagado · entrega $X · Ref. SUB-XXXX". La Test Wallet del destino muestra el ingreso real con la referencia.
- **CA-12.03 (reintento sin duplicar):** Dado un error de red después de crear el pago saliente, cuando se reintenta, entonces la API consulta `outgoingPayment.get` y **no** crea un segundo pago (idempotencia por `outgoing_payment_url`/`idempotency_key` + reintento controlado).
- **CA-12.04:** El punto entrega el efectivo **solo** cuando ve `Pagado`.
- **CA-12.05 (performance):** Del PIN correcto (o del "Cobrar") a `Pagado` en 10 s o menos en la Test Wallet (RNF-02): 9 de 10 cobros en 10 s.

---

# E5 · Control del cobro y cierre

## HU-13 · Ver los rechazos con claridad
**Épica:** E5 · **Must · 3 pts** · Rol 2 · Depende de HU-10, HU-12.
Endpoints: `POST /cobros` (rechazos 404/409), `POST /cobros/:id/confirmar` (422), `GET /cobros/:id` (para ver motivo).

Criterios de aceptación (cada causa responde con su mensaje en español, no mueve dinero y deja un evento):

| Causa | Detección | Mensaje | Estado final |
| --- | --- | --- | --- |
| Subsidio ya cobrado | al solicitar | "Este subsidio ya fue cobrado" | `Rechazado` |
| Tope del programa superado | al pagar (`InsufficientGrant`) | "El banco rechazó el pago: el programa llegó a su tope" | `Fallido` |
| Programa cerrado | al solicitar | "El programa está cerrado y ya no recibe cobros" | `Rechazado` |
| Sin pago disponible en la liquidación | al solicitar | "Esta cédula no tiene pagos disponibles en este programa" | `Rechazado` |
| Cuenta no verificada | al solicitar | "Primero enlaza y verifica tu cuenta" | `Rechazado` |
| PIN errado 3 veces o tiempo agotado | al confirmar | "No pudimos confirmar tu identidad" | `Rechazado` |
| Programa pausado o fuera de vigencia | al solicitar | "El programa no está recibiendo cobros" | `Rechazado` |
| Fondos insuficientes en la cuenta del programa | al pagar | "El programa no tiene fondos en este momento" | `Fallido` |

Los tres primeros deben verse en el video.

## HU-14 · Impedir el doble cobro
**Épica:** E5 · **Must · 3 pts** · Rol 2 · Depende de HU-10.
Endpoints: `POST /cobros` (código 409 `SinProgramas`/`CobroEnCurso`), `POST /cobros/:id/cancelar` (200/404/409).

Criterios de aceptación:
- **CA-14.01:** Dado dos puntos enviando la misma cédula a la vez, cuando ambos intentan, entonces el **índice único parcial** sobre `programa_id` + `documento` (solo en estados activos) deja ganar a uno; el otro recibe "Este subsidio ya está en proceso o fue cobrado" (`CobroEnCurso`/`YaCobrado`).
- **CA-14.02:** Dado un cobro a la cuenta y un retiro al mismo tiempo, cuando llegan, entonces solo uno avanza (RN-02).
- **CA-14.03:** Dado una confirmación duplicada, cuando llega, entonces `idempotency_key` y `version` evitan un segundo pago (bloqueo optimista en `repo.actualizar(id, version, ...)`).
- **CA-14.04:** Un cobro `Rechazado` libera la cédula para intentarlo de nuevo.
- **CA-14.05 (test):** Un test de Vitest reproduce la carrera (`carrera.test.ts`) y pasa en cada commit a `main`.

## HU-15 · Ver autorizado, cobrado y lo que nunca salió
**Épica:** E5 · **Must · 5 pts** · Roles 4 (vista) y 1 (datos) · Depende de HU-04, HU-12.
Endpoint: `GET /programas/:id/tablero` → `{ programa, moneda, autorizado, cobrado, fuente, noHaSalido, cobrosPagados, porCanal, reembolsoSegundos, giradoPorAdelantado:'0', sinCobrar, cobrosPagando, rechazadosYFallidos, cobros[], cierre, actualizado }` (200/404).

Criterios de aceptación:
- **CA-15.01:** Dado un programa `Activo`, cuando abro el tablero, entonces veo `autorizado` (tope), `cobrado` (leído del permiso vía `outgoingPayment.getGrantSpentAmounts`), `noHaSalido = autorizado - cobrado`, y `porCanal` (cuenta, retiro, compra: cobros + monto).
- **CA-15.02:** Dado un cobro que acaba de pasar a `Pagado`, cuando el tablero se actualiza, entonces las cifras lo reflejan en ≤ 5 s (`POLL_INTERVALO_MS=1000`).
- **CA-15.03:** Debajo, en pequeño: segundos entre cobro y reembolso al punto (`reembolsoSegundos`) y "plata girada por adelantado: $0".
- **CA-15.04:** Ningún token ni URL de gestión del permiso llega al navegador (solo backend en `server/src`).

## HU-16 · Registro y línea de tiempo
**Épica:** E5 · **Must · 2 pts** · Rol 2 · Depende de HU-01.
Endpoint: `GET /cobros/:id` (incluye `eventos[]` cuando `GET`/crear/confirmar); eventos se guardan por `eventos.registrar`.

Criterios de aceptación:
- **CA-16.01:** Cada cambio de estado de un programa, una cuenta o un cobro crea un evento con `desde`, `hacia`, `detalle` y `creado` (hora del servidor).
- **CA-16.02:** Dado un cobro, cuando abro su detalle, entonces veo sus eventos en orden y la referencia del pago (`referencia` en `metadata` del incoming payment).
- **CA-16.03:** Los eventos **nunca** guardan tokens, PIN ni llaves (`detalle` es JSONB; auditoría por fila).

## HU-17 · Cerrar el programa y revocar el permiso
**Épica:** E5 · **Must · 3 pts** · Rol 1 · Depende de HU-15.
Endpoint: `POST /programas/:id/cerrar` body `{ confirmacion }` (200/400/404/409).

Criterios de aceptación:
- **CA-17.01:** Dado un programa `Activo` o `Pausado`, cuando confirmo escribiendo "CERRAR", entonces la API revoca el permiso (`grant.cancel`/`token.revoke` vía `url_gestion`) y el estado pasa a `Cerrado`. Sin "CERRAR": 400 `ConfirmacionRequerida`.
- **CA-17.02:** Dado un programa `Cerrado`, cuando un punto intenta un cobro, entonces se rechaza con 409 "El programa está cerrado y ya no recibe cobros" (`ProgramaCerrado`).
- **CA-17.03:** El tablero muestra `cierre: { autorizado, cobrado, nuncaSalio, cerradoEn }` (dinero que nunca salió) y `giradoPorAdelantado:'0'`.
- **CA-17.04:** Irreversible: la app pide una segunda confirmación (en front; API valida la cadena).

## HU-18 · Pausar el programa
**Épica:** E5 · **Should · 1 pt** · Rol 2 · Depende de HU-04.
Endpoints: `POST /programas/:id/pausar` (200/404/409), `POST /programas/:id/reanudar` (200/404/409).

Criterios de aceptación:
- **CA-18.01:** Dado un programa `Activo`, cuando pulso "Pausar", entonces pasa a `Pausado` y todo cobro nuevo se rechaza con "El programa no está recibiendo cobros".
- **CA-18.02:** Los cobros que ya están en `Pagando` terminan normalmente; "Reanudar" devuelve el programa a `Activo`.

---

# E6 · Plataforma y entregables

## HU-19 · Elegir mi rol sin login
**Épica:** E6 · **Must · 1 pt** · Rol 4.
Endpoints usados: `GET /beneficiarios/demo` → `[{ nombre, etiqueta, documento }]`, `GET /config`.

Criterios de aceptación:
- **CA-19.01:** Dado la web, cuando elijo un rol (`entidad`/`beneficiario`/`punto`), entonces elijo también una cédula de prueba o un punto de prueba y veo su vista **sin contraseña**.
- **CA-19.02:** El rol elegido se recuerda al recargar la página (`sessionStorage`).

## HU-20 · Entregables del hackathon
**Épica:** E6 · **Must · 1 pt** · Rol 5.
Endpoints de soporte: `GET /salud` (200/503), `GET /estado` (200), `GET /config` (200).

Criterios de aceptación:
- **CA-20.01:** A las 11:00 del sábado: repo público, todo en `main`, `AI_USAGE.md` en la raíz y `/prompts/<rol>.md`.
- **CA-20.02:** `.gitignore` con `.env` y `*.key` desde el primer commit; ningún secreto en el historial (`gitleaks`/grep: 0 hallazgos).
- **CA-20.03:** `GET /salud` confirma que la BD responde y que la llave coincide con el JWKS publicado (`llave.coincide === true`); sin BD o con llave incorrecta, 503.
- **CA-20.04:** `GET /estado` dice si son "pagos reales" o "simulados" y qué falta (`faltan[]`), incluyendo base de datos (`tipo`: postgres/pglite, `donde`).
- **CA-20.05:** README con cómo correrlo y enlace al video; video y slides a las 12:00.

---

# E7 · Extras (solo si sobra tiempo, Could, con su `EXTRA_*`)

## HU-21 · Extra 1: Bono con destino
**Could · 5 pts** · Rol 2 · Depende de HU-01, HU-11, HU-12 · `EXTRA_BONO`.
Endpoints: `GET /categorias`, `GET /comercios`, `POST /comercios`, `POST /comercios/:id/sedes`, `POST /comercios/:id/verificar`, `GET /programas/:id/comercios`.

Criterios de aceptación:
- **CA-21.01:** Dado un programa `bono`, cuando lo creo, entonces `destino=restringido` y marco qué categorías/comercios lo aceptan (`PUT` de categorías + `POST /comercios/:id/sedes`).
- **CA-21.02:** Dado un comercio autorizado, un total de $80.000 y un bono de $60.000, cuando el cajero digita la cédula y el cliente confirma con PIN, entonces se pagan **$60.000** al comercio y el cliente paga **$20.000** aparte (RN-05: `monto = min(valor_disponible, total_compra)`).
- **CA-21.03:** Dado un comercio no autorizado (`POST /comercios/:id/verificar` no hecho o sede no en `programa_punto`), cuando digita la cédula, entonces 409 "Este comercio no acepta este bono" y no se mueve dinero.
- **CA-21.04:** Dado un bono, cuando alguien intenta cobrarlo a su cuenta o en retiro (`destino=restringido` no aparece en puntos de tipo `retiro`), entonces se rechaza: "Solo se usa en comercios autorizados" (RN-03).
- **CA-21.05 (verificación de comercio):** Un comercio se registra con NIT (5-15 dígitos), razón social, CIIU (4 dígitos) y sede inicial; la categoría se infiere del CIIU (`categoriaDe`). La entidad lo verifica con `POST /comercios/:id/verificar` (simula cruce con RUT/RUES). Solo los verificados aceptan bonos.

## HU-22 · Extra 2: QR del beneficiario y cámara
**Could · 5 pts** · Rol 3 · Depende de HU-08, HU-10, HU-25 · `EXTRA_QR` · `QR_TTL_SEG=60`.

Criterios de aceptación:
- **CA-22.01:** Dado un pago disponible, cuando pulso "Mostrar QR", entonces veo un QR que vence en 60 s y **solo** lleva un token (sin datos personales).
- **CA-22.02:** Dado el punto servido por HTTPS, cuando el cajero escanea el QR, entonces el flujo es igual que con la cédula, incluido el PIN.
- **CA-22.03 (fallback):** Si la cámara no abre, digitar la cédula siempre funciona.

## HU-23 · Extra 3: leer el PDF417 de la cédula
**Could · 5 pts** · Rol 3 · Depende de HU-10, HU-25 · `EXTRA_PDF417`.

Criterios de aceptación:
- **CA-23.01:** Dado una cédula amarilla con holograma, cuando la paso por la cámara, entonces el campo cédula se llena solo.
- **CA-23.02:** Dado un lector 2D que escribe como teclado, cuando lee el código, entonces el campo se llena y se envía.
- **CA-23.03 (fallback):** Si la lectura falla, digitar el número siempre funciona.

## HU-24 · Extra 4: contrato público por hitos
**Could · 8 pts** · Roles 1 y 4 · Depende de HU-04, HU-12 · `EXTRA_CONTRATO`.

Criterios de aceptación:
- **CA-24.01:** Dado un contrato con tres hitos y su valor, cuando la entidad lo conecta, entonces aprueba un permiso con tope igual al valor del contrato (mismo motor, `tipo` puede reusarse si se extiende). El permiso es un límite de desembolso: no reserva ni separa plata (RN-09).
- **CA-24.02:** Dado un hito pendiente, cuando el supervisor lo certifica, entonces se paga ese hito a la wallet del contratista con su referencia (adaptador HU-12).
- **CA-24.03:** Dado un hito sin certificar, cuando alguien intenta pagarlo, entonces se rechaza; ningún hito se paga dos veces (RN-13 + idempotencia).
- **CA-24.04:** Dado el tablero público del contrato, cuando cualquiera lo abre, entonces ve hitos certificados y lo pagado (nunca cuentas, tokens ni datos personales, RNF-06).

## HU-25 · Extra 5: despliegue público
**Could · 2 pts** · Rol 2 · `EXTRA_DEPLOY`.

Criterios de aceptación:
- **CA-25.01:** La web y la API corren juntas en Vercel, en un solo dominio con HTTPS (<https://test-openpayment.vercel.app>); el enlace va en README y slides.
- **CA-25.02:** Los callbacks del permiso y de la verificación de cuentas usan `API_BASE_URL` (no localhost).
- **CA-25.03:** La cámara (HU-22/HU-23) solo funciona con HTTPS: sin este extra, esos dos necesitan un túnel.

---

# Reglas de negocio (resumen implementado)

| ID | Regla | Se valida | Historias |
| --- | --- | --- | --- |
| RN-01 | La cédula debe tener un pago disponible en la liquidación; no hay base propia | al solicitar | HU-02, HU-10 |
| RN-02 | Un solo cobro activo o pagado por cédula/programa: índice único parcial en Solicitado, PorConfirmar, Pagando, Pagado | al solicitar | HU-14 |
| RN-03 | Destino libre (subsidio): cuenta y retiro. Destino restringido (bono): solo compra en comercios de `programa_punto` | al solicitar | HU-09, HU-21 |
| RN-04 | Canal a la cuenta exige cuenta `Verificada` en la misma moneda del programa | al solicitar | HU-07, HU-09 |
| RN-05 | Subsidio: se paga el valor completo disponible. Bono: `min(valor_disponible, total_compra)` | al solicitar | HU-10, HU-21 |
| RN-06 | El programa está `Activo` y dentro de su vigencia; `Cerrado` rechaza todo cobro | al solicitar | HU-13, HU-17 |
| RN-07 | Retiro y compra exigen PIN validado por el simulador; 3 fallos rechazan y bloquean 15 min (propuesto) | al confirmar | HU-11 |
| RN-08 | El tope es la suma de la liquidación al pedir la aprobación; luego queda fijo | al autorizar | HU-02, HU-04 |
| RN-09 | La plataforma **no** valida el tope antes de pagar: lo hace cumplir el banco con `InsufficientGrant` | al pagar | HU-13 |
| RN-10 | Un cobro solo queda `Pagado` si el pago saliente se completa | al consultar | HU-12 |
| RN-11 | Todo monto se valida y convierte en el backend con `assetScale`; nunca se confía en el navegador | siempre | HU-10 |
| RN-12 | Un cobro `PorConfirmar` sin PIN en 120 s pasa a `Rechazado` (propuesto) | al consultar | HU-11 |
| RN-13 | Un hito solo se paga si el supervisor lo certificó, y una sola vez | al certificar | HU-24 |

Fórmula de monto: `\text{monto} = valor\_disponible` (subsidio) o `min(valor\_disponible, total\_compra)` (bono).
Cifras del tablero: `autorizado = tope_total`; `cobrado = gastado del permiso`; `noHaSalido = autorizado - cobrado`; `tiempo de reembolso = t_Pagado - t_confirmado`.
Verificación de hash de callback (permiso y cuenta):
`hash = base64(SHA-256(nonce + "\n" + finish_nonce + "\n" + interact_ref + "\n" + grant_url))`.

## Datos y esquema (campos clave para construir)

**`programa`:** `id`, `entidad`, `nombre`, `tipo` (subsidio|bono), `destino` (libre|restringido), `billetera_programa` (https), `asset_code`, `asset_scale`, `vigencia_inicio`, `vigencia_fin`, `tope_total` (bigint, unidades mínimas), `estado` (Borrador, EsperandoAprobacion, Activo, Pausado, Cerrado), `access_token`/`manage_url`/**solo backend**, `continue_uri`, `continue_token`, `nonce_cliente`, `nonce_cierre`, `grant_url`, `aprobacion_solicitada_en`, `permiso_vencido_en`, `gastado_permisos_anteriores`, `monto_por_persona`, `categorias`.
**`punto`:** `id`, `nombre`, `direccion`, `wallet_address` (única, misma moneda del programa), `tipo` (retiro|compra), `comercio_id` (solo sedes de comercio).
**`programa_punto`:** `programa_id`+`punto_id` (PK compuesta; solo bonos).
**`cuenta_beneficiario`:** `documento` (PK, cédula), `wallet_address`, `estado` (SinEnlazar, PorVerificar, Verificada), `nonce_cliente`, `nonce_cierre`, `verificada_en`.
**`cobro`:** `id`, `programa_id`, `documento`, `canal` (cuenta, retiro, compra), `punto_id` (null en cuenta), `total_compra` (solo compra), `monto`, `estado` (Solicitado, PorConfirmar, Rechazado, Pagando, Pagado, Fallido), `motivo_rechazo`, `intentos_pin`, `referencia` (única, viaja en `metadata`), `idempotency_key` (UNIQUE), `incoming_payment_url`, `outgoing_payment_url`, `version`, `creado`, `actualizado`.
**`evento`:** `id`, `entidad` (programa|cuenta|cobro), `id_entidad`, `desde`, `hacia`, `detalle` (JSONB, sin secretos), `creado`.
Índices clave: índice único parcial programa+cédula en estados activos (RN-02); una cuenta vigente por persona; billetera única por punto.

## Variables de entorno relevantes para el desarrollo

| Variable | Ejemplo | Uso |
| --- | --- | --- |
| `OP_CLIENT_WALLET_ADDRESS` | `https://ilp.interledger-test.dev/entrega-app` | Identidad del cliente en el SDK |
| `OP_KEY_ID` | UUID de la Test Wallet | `keyId` de la llave |
| `OP_PRIVATE_KEY_PATH` | `./private.key` (fuera del repo) | Llave Ed25519 (RNF-01) |
| `DATABASE_URL` | Cadena PostgreSQL | Conexión (Supabase/Neon o local) |
| `LIQUIDACION_URL` | URL del simulador | Consulta por cédula y PIN |
| `APP_BASE_URL`, `API_BASE_URL` | URLs web/API | Callbacks y redirecciones |
| `CONFIRMACION_TTL_SEG` | `120` | Plazo para el PIN (RN-12) |
| `PIN_MAX_INTENTOS` | `3` | Intentos antes del bloqueo |
| `PIN_BLOQUEO_MIN` | `15` | Duración del bloqueo |
| `POLL_INTERVALO_MS` | `1000` | Consulta de estado en la web |
| `APROBACION_TTL_MIN` | `10` | Vencimiento de aprobación |
| `EXTRA_BONO`, `EXTRA_QR`, `EXTRA_PDF417`, `EXTRA_CONTRATO`, `EXTRA_DEPLOY` | `false` | Encendido de extras (RNF-10) |
| `QR_TTL_SEG` | `60` | Vida del QR (HU-22) |
| `VERIFICACION_CUENTA` | `subject` o `simulada` | Flujo de `POST /cuentas` |
| `LIQUIDACION_SIMULAR_FALLA` | `false` | Forzar 503 del simulador en pruebas |

## Definición de Done mínima para la hackathon

- Todos los `CA` de la HU a implementar pasan contra la Test Wallet, no solo con datos falsos.
- Código en `main`, revisado por la pareja de revisión cruzada.
- Estados nuevos con test en Vitest y con evento creado.
- Vistas cumplen 360 px, 16/24 px y textos en español sencillo (RNF-03, RNF-04).
- Cero secretos en código, logs o base (`AI_USAGE.md`/`prompts/` completos).
- Rol 5 probó la HU como usuario.

---

*Fuente original: `docs/Historias de Usuario — Bonos con Destino.md` (branch `piloto-v2`, 30 sep 2026) + catálogo `docs/piloto/API del piloto.md`. Reescrito para contener solo HUs, criterios y datos de implementación.*
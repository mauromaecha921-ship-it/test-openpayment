# Piloto 1: resultados

> Parte del [plan general](./README.md). Cada verificación (§ 7 del plan) y cada hallazgo (§ 5) se
> marca con ✅ funciona · ⚠️ funciona con ajustes · ❌ no funciona · ⏳ sin probar, con su
> evidencia y la acción que se propone para `docs/`.
>
> **Estado al 10 de octubre de 2026:** backend construido (Fases 0, 2, 3, 4 y 5 en código, rama
> `piloto`, sin commits), probado con un Open Payments falso y con la web corriendo contra él.
> **Falta todo lo que exige la Test Wallet**: la Fase 1 (`npm run primer-cobro -w api`) y los
> criterios «con callback real» de las Fases 3 a 5 (`npm run guion -w api`). Ver § 5.

---

## 1. Estado por fase (backend)

| Fase | Código | Puerta | Evidencia |
|---|---|---|---|
| 0 · Preparación | ✅ | ✅ `npm install` limpio · `check:secretos` 0 hallazgos · `typecheck` pasa | Versiones exactas del plan § 9; `.gitignore` y `.npmrc` creados |
| 1 · Primer cobro | ✅ `api/scripts/primer-cobro.ts` | ⏳ | Necesita las 4 wallets en COP, la llave en `api/.env` y aprobar en la Test Wallet |
| 2 · Base | ✅ | ✅ | `npm test -w api`: estados, reglas, hash, montos y esquema en verde |
| 3 · Programa | ✅ | ⏳ (callback real y V-13) | O1, O2, O7, O8, HU-05 y HU-18 cubiertos por `callback.test.ts` y `flujo.test.ts`; con pagos reales, `npm run guion -w api` (paso 2) |
| 4 · Cobros | ✅ | ⚠️ V-17 ✅; falta el pago real en la Test Wallet | `carrera.test.ts`, `flujo.test.ts` (guion pasos 2 a 7 con dobles), `recuperacion.test.ts` (V-06 con dobles) |
| 5 · Cuentas | ✅ (con plan B) | ⏳ V-04 | `cuentas.test.ts`: subject, hash, una cuenta vigente y plan B |

**Pruebas:** 13 archivos, 133 pruebas en verde (`npm test -w api`), con el registro del equipo
del [Plan de ajustes](./Plan%20de%20ajustes.md).

**Herramientas listas para cuando haya wallets:** `npm run primer-cobro -w api` (Fase 1),
`npm run guion -w api` (pasos 2 a 7 por HTTP, mide del PIN a Pagado) y la API en el puerto 3100
(`npm run start:3100 -w api`) cuando el frontend ocupa el 3000.

---

## 2. Matriz de verificación

| ID | Qué se comprueba | Estado | Evidencia y acción |
|---|---|---|---|
| V-01 | Un permiso sin receptor paga a 2 wallets | ⏳ | Paso 7 del script |
| V-02 | Superar el tope: código y mensaje exactos | ⏳ | Paso 8 del script. Hoy el adaptador traduce cualquier 403 al crear el saliente a `TopeSuperado` |
| V-03 | `expires_in` real y `token.rotate` | ⏳ | Pasos 5 y 10 (`--rotar`). La rotación ante 401 ya está probada con dobles (HU-06) |
| V-04 | Verificación con `subject` | ⏳ | API de HU-07 lista; plan B con `VERIFICACION_CUENTA=simulada` probado |
| V-05 | Variante del hash | ⏳ | El script imprime cuál de las 6 coincide. Con el vector oficial, las 3 variantes base64 se aceptan y el hash alterado se rechaza (`hash.test.ts`) |
| V-06 | Reinicio con un cobro en Pagando | ⚠️ | Con dobles (`recuperacion.test.ts`): si hay saliente, se consulta y queda Pagado; si no hay nada, se vuelve a pagar una sola vez; si solo hay entrante, queda «requiere conciliación» sin reintentar el saliente. Falta con la Test Wallet (Fase 8) |
| V-07 | `token.revoke` y `grant.cancel` | ⏳ | Pasos 11 y 12 (`--cancelar`) |
| V-08 | El `client` del SDK es aceptado | ⏳ | Paso 4 |
| V-09 | `too_fast` e `invalid_continuation` | ⏳ | Paso 12 (opcional) |
| V-10 | Cómo saber que un pago se completó | ⏳ | El script guarda la evolución de `failed`, `sentAmount` y `completed` segundo a segundo |
| V-11 | Pago de monto fijo sin comisiones | ⏳ | Paso 6 |
| V-12 | ¿Las wallets de una cuenta comparten saldo? | ⏳ | Revisión manual (paso 13) |
| V-13 | `grant_rejected`, `grant_invalid` y vencimiento de 10 min | ⚠️ | La lógica está probada con dobles (`callback.test.ts`); falta ver qué manda la Test Wallet |
| V-14 | Del PIN a Pagado en 10 s o menos | ⏳ | El tablero ya calcula `reembolsoSegundos` desde `evento` |
| V-15 | Pago sin fondos | ⏳ | Hoy un `failed` sin causa conocida queda Fallido con `ErrorPago` (D-24) |
| V-16 | Las protecciones de la BD en SQLite | ✅ | `db/esquema.test.ts`: 17 casos (las 15 de `db/README.md` y 2 más). `node:sqlite` funciona con Vitest y tsx: no hizo falta el plan B `better-sqlite3` |
| V-17 | 10 solicitudes simultáneas → 1 cobro | ✅ | `carrera.test.ts`: 1 PorConfirmar y 9 Rechazados con `EnProceso`; doble confirmación → 1 solo pago saliente |
| V-18 | Guion de la demo de punta a punta | ⚠️ | Con dobles, pasos 2 a 7 en verde (`flujo.test.ts`). La web contra la API real (semilla «solo UI», sin Open Payments) muestra bien el tablero, el PIN errado (422), el «ya cobrado» y la vista de la beneficiaria; pagar da Fallido/`ErrorPago` porque el token es falso. Falta contra la Test Wallet |
| V-19 | Móvil y accesibilidad | ⚠️ | Medido por el frontend el 10 de octubre en modo «API simulada». **Lighthouse 13.5.0** (Accesibilidad, perfil móvil): 100 en `/`, `/punto`, `/punto/cobros/:id` (PIN, Pagado y Fallido), `/beneficiario`, `/beneficiario/cuenta` y el tablero; el plan pide 90 o más. Para llegar a 100 se corrigieron el contraste de las pestañas del tablero y el nombre accesible de la tecla «Limpiar». **360 × 740:** las 15 rutas sin desplazamiento horizontal. **44 px:** cumplen después de agrandar el logo, las pestañas y los enlaces «Ver»; la excepción son los radios del tipo de programa (20 px), que se marcan también tocando toda su etiqueta. **Textos:** sin palabras técnicas en las vistas del beneficiario y del punto. **Falta:** probar en 1 Android y 1 iPhone reales (`npm run dev:host -w web`), y repetirlo contra la API real |
| V-20 | Cero secretos | ⚠️ | `seguridad.test.ts`: ninguna respuesta ni evento lleva tokens, nonces, URLs de gestión, PIN ni la cédula completa. `check:secretos` da 0. Falta revisar los logs con la Test Wallet |
| V-21 | La referencia se ve en la Test Wallet | ⏳ | El pago entrante lleva `metadata: { description, referencia }` |

---

## 3. Hallazgos de la documentación (D-01 a D-22)

Todas las decisiones provisionales del plan § 5 quedaron implementadas tal cual. Las que el código
ya confirma:

| ID | Estado | Nota |
|---|---|---|
| D-01 | ⏳ | Tabla `beneficiario` implementada como en `db/`, con datos ficticios. **Decisión del equipo** |
| D-03 | ✅ | `002_ajustes_piloto.sql` agrega `uri_continuacion` y `token_continuacion`; sin ellos el callback de HU-07 no puede continuar |
| D-05 | ✅ | Las 16 rutas nuevas existen; la web ya las consume |
| D-08 | ✅ | `YaCobrado` si el otro cobro está pagado; `EnProceso` si sigue vivo |
| D-09 | ✅ | Motivo `Cancelado` y `grant.cancel` para la aprobación |
| D-15 | ⏳ | Pagado = `failed` falso y `sentAmount ≥ debitAmount`, o el pago entrante completado. Lo confirma V-10 |
| D-17 | ✅ | El bloqueo de 15 min sale de los cobros Rechazados con `PinBloqueado`, sin tabla nueva |
| D-18 | ✅ | El evento de cierre guarda `{ autorizado, cobrado, nuncaSalio, fuente }` antes de revocar |
| D-21 | ✅ | Sin `programaId`, la API toma el subsidio activo con pago para la cédula; si no hay, el más relevante (Activo, luego Pausado, luego Cerrado), para que el rechazo quede en su tablero |
| Resto | ⏳ | Sin evidencia nueva todavía |

---

## 4. Hallazgos nuevos del piloto

| ID | Hallazgo | Dónde | Qué hace el piloto · acción propuesta |
|---|---|---|---|
| D-23 | El plan (§ 8.5 y § 8.6) marca Pagado un cobro que solo tiene el pago entrante completado, pero la BD lo prohíbe: `pagado_con_pago_saliente` exige `url_pago_saliente` | Plan backend frente a `db/001_esquema.sql` | Respeta la BD: el cobro queda en Pagando con un evento «requiere conciliación». **Acción:** decidir si se agrega `list` al permiso para encontrar el saliente por su `receiver`, o si se relaja la restricción |
| D-24 | El catálogo de HU-13 no tiene un motivo para una respuesta definitiva del banco que no sea el tope (un 4xx, o `failed` sin causa conocida) | `cobros/mensajes.ts` | Motivo nuevo `ErrorPago`: «El banco no pudo procesar el pago. No se movió dinero». **Acción:** agregarlo a HU-13 o cambiarlo por `SinFondos` si V-15 lo confirma |
| D-25 | `canal_y_cuenta` exige `cuenta_id` en todo cobro del canal cuenta, así que el rechazo «Primero enlaza y verifica tu cuenta» de alguien que nunca enlazó una no se puede guardar | `db/001_esquema.sql` frente a HU-09 | Responde 409 `CuentaNoVerificada` sin dejar cobro. Si la persona tuvo una cuenta antes, el rechazo sí queda, con esa cuenta. **Acción:** permitir `cuenta_id` nulo en los Rechazados del canal cuenta |
| D-26 | El plan dice que la cédula desconocida «no deja cobro», pero no dice qué responde | Plan backend § 8.2 | 404 con el código y el mensaje de `SinPagoDisponible` |
| D-27 | Los ids de `db/002_datos_prueba.sql` (`a0000000-…`) no son UUID v4: `z.uuid()` de Zod 4 los rechaza | Zod 4 frente a la semilla | Se valida con `z.guid()`. **Acción:** ninguna en `docs/`; queda anotado para el evento |
| D-28 | La web y el backend no tenían escritas las formas del tablero, del resumen ni de la cuenta (el plan § 7 solo nombra los campos) | Plan backend § 7 | El backend adoptó las formas de `web/src/api/tipos.ts`. **Acción:** copiar ese contrato a `docs/` antes del evento |
| D-29 | `npm audit` reporta 3 vulnerabilidades moderadas en `uuid` < 11.1.1, que llegan con `@interledger/http-signature-utils` (dependencia del SDK 7.4.0). No hay arreglo publicado | `npm audit` | No afecta al piloto (el aviso es sobre `buf` en v3/v5/v6, que no usamos). **Acción:** revisarlo antes del evento |
| D-30 | «Móvil primero desde 360 px» y «Beneficiario (celular, 390 px)» se leyeron como «solo celular»: en PC, el beneficiario y el punto quedaban en una columna de 480 px | Plan frontend § 4 y § 8 | Un marco que cambia en 768 px: columna en el celular y barra completa con columnas en PC ([Plan de ajustes](./Plan%20de%20ajustes.md) F1). **Acción:** que el Plan frontend diga que todos los roles se usan también en PC |
| D-31 | El esquema de `beneficiario` exige fechas, autorización de datos y más campos que un registro rápido (cédula y wallet) no tiene | `db/001_esquema.sql` frente al registro del equipo | Se llenan con valores fijos del piloto (`version_politica = 'piloto-equipo'`). **Acción:** definir el mínimo para inscribir a alguien y cuáles campos pueden ser nulos |
| D-32 | En un PC con antivirus que inspecciona HTTPS, Node rechaza el certificado de la Test Wallet (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) y **ninguna** llamada a Open Payments sale; la API lo reportaba como «sin respuesta» | Prueba en el equipo del 10 de octubre | `api/src/certificados.ts` hace que Node confíe también en los certificados del sistema. **Acción:** anotarlo en la Guía (checklist del equipo) para el día del evento |
| D-33 | Las wallets de la semilla «solo UI» (`https://ilp.interledger-test.dev/ana` y `/luis`) existen de verdad, son de otras personas y están en EUR y USD | `GET /api/beneficiarios` con la Test Wallet real | Se avisa en `api/README.md`; el equipo usa `db:reset` (BD limpia) y sus propias wallets. **Acción:** usar en `db/002_datos_prueba.sql` direcciones que no existan (por ejemplo, con un prefijo `tatu-ejemplo-`) |

---

## 5. Cómo seguir

**Lo que solo puede hacer el dueño de la Test Wallet (bloquea):**

1. Crear las 4 wallet addresses en COP y depositar al menos $700.000 en la del programa (plan § 12).
   Si no alcanza el saldo, `LIQUIDACION_MONTO_BASE=230000` en `api/.env` baja todo 100 veces.
2. Completar `api/.env`: `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID`, `OP_PRIVATE_KEY_BASE64` (o `_PATH`)
   y las `DEMO_WALLET_*`. Ese archivo está ignorado por git.

**Después, en este orden:**

3. `npm run start:3100 -w api` y abrir `http://localhost:3100/api/salud`: debe decir que la llave
   coincide con el `jwks.json`.
4. `npm run primer-cobro -w api -- --rotar --cancelar` y aprobar en la Test Wallet. Copiar aquí la
   tabla que imprime (también queda en `api/data/primer-cobro-<fecha>.json`, sin tokens). Si V-02,
   V-05 o V-10 salen distinto de lo supuesto, se ajusta `openPaymentsService.ts` o `hash.ts` antes de seguir.
5. `npm run db:reset:demo -w api`, reiniciar la API y `npm run guion -w api`: pasos 2 a 7 con pagos reales
   (Fases 3 y 4, V-02, V-14, V-18). Queda en `api/data/guion-<fecha>.json`.
6. Enlazar la cuenta de Luis desde la app (V-04, Fase 5) y recorrer el guion en la web (Fase 8).

> El callback de la aprobación vuelve a `API_BASE_URL` (el 3100) y luego redirige a la web. Para
> recorrer el guion **en la web**, el proxy de la web tiene que apuntar a la misma API. La variable
> `API_PROXY` lo cambia (por defecto va al 3000). En PowerShell:
> `$env:API_PROXY='http://localhost:3100'; npm run dev:web`. En bash:
> `API_PROXY=http://localhost:3100 npm run dev:web`.

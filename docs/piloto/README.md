# Piloto 1: plan general

> **Estado (12 de octubre de 2026): probado con pagos reales en la Test Wallet, rama `piloto`.**
> Con wallets del equipo en COP: aprobación del permiso, cobro a la cuenta, retiro en el punto con
> reembolso en segundos, varios subsidios por persona, renovación del permiso y la caja del punto.
> 147 pruebas de la API y 19 de la web en verde. Lo importante está en el
> [Resumen para el equipo](../Resumen%20para%20el%20equipo.md); el detalle y los hallazgos D-23…D-36,
> en [Resultados del piloto](./Resultados%20del%20piloto.md). Cómo correr la API: [`api/README.md`](../../api/README.md).
>
> **Qué es:** un primer piloto **desechable** que arma el proyecto tal como lo describen `docs/`,
> `db/` y `wireframe/`, con **SQLite en lugar de Supabase**, para comprobar qué de la
> documentación está claro y funciona, y qué hay que revisar.
>
> **Planes detallados:** [Plan backend](./Plan%20backend.md) · [Plan frontend](./Plan%20frontend.md) · [Plan de ajustes](./Plan%20de%20ajustes.md) (vistas para PC y celular, registro del equipo y pagos reales)

---

## 1. Antes de empezar: tres cuidados

| Cuidado | Por qué | Qué hacemos |
|---|---|---|
| **El piloto es desechable** | La Guía dice: «Todo se escribe durante el evento; presentar código hecho antes es causal de descalificación» y «No llegar con código del proyecto» | El código vive en la rama `piloto`, que nunca se mezcla a `main`, y no se copia al repo del evento. Lo que sí se reutiliza son los aprendizajes, que vuelven a `docs/`. Encaja con el «ensayo general con un proyecto desechable» del 11 de octubre (Guía § Checklist). `openPaymentsService.ts` lo reescribe el equipo en el evento (Guía § Estructura del repositorio) |
| **La llave privada** | Ya la tenemos y el repo será público | Va solo en `api/.env` (ignorado por git) como `OP_PRIVATE_KEY_BASE64`, o en un archivo fuera del repo. Como se compartió por chat, conviene rotarla en la Test Wallet antes de que algún repo sea público |
| **Vercel queda pendiente** | Así se pidió | El piloto corre en local (`localhost`), pero queda listo para desplegar después (§ 11) |

---

## 2. Objetivo y criterio de éxito

**Objetivo:** recorrer el flujo principal del subsidio de punta a punta con pagos reales en la
Test Wallet y dejar por escrito, punto por punto, qué de la documentación funciona tal cual, qué
funciona con ajustes y qué no funciona.

**El piloto está terminado cuando:**

1. `npm run dev` levanta la web (`http://localhost:5173`) y la API (`http://localhost:3000/api`).
2. Los pasos 2 a 7 del guion de la demo (Guía § Guion del video; el 1 es solo contexto) se
   recorren en la app con pagos reales en la Test Wallet.
3. `npm test` pasa en verde (estados, reglas, hash, protecciones de la BD, carrera de doble cobro).
4. `docs/piloto/Resultados del piloto.md` (se crea en la Fase 0) marca cada verificación de la § 7
   y cada hallazgo de la § 5 con ✅ funciona · ⚠️ funciona con ajustes · ❌ no funciona ·
   ⏳ sin probar, con su evidencia y la acción que se propone para la documentación.

---

## 3. Alcance

| Entra | Opcional, solo si lo anterior pasa | No entra |
|---|---|---|
| Todas las historias Must del flujo principal: HU-01 a HU-05, HU-07 a HU-17 y HU-19 | Extras HU-21, HU-22 y HU-24 detrás de sus banderas `EXTRA_*` | Despliegue (HU-25 y Vercel), § 11 |
| Las Should en versión simple: HU-06 (rotar el token al recibir 401) y HU-18 (pausar y reanudar) | HU-23 (PDF417): no tiene wireframe | `AI_USAGE.md`, `/prompts`, video y slides (HU-20): son entregables del evento |
| Las 19 pantallas del flujo principal (de las 22 de los wireframes, 3 son extras) | | Dinero real, login propio, app nativa |

---

## 4. Lo que esta revisión ya comprobó (sin escribir código)

| Qué se revisó | Resultado | Impacto |
|---|---|---|
| Wallet cliente de la app | Existe y está en **COP con escala 2** | La Test Wallet sí tiene pesos colombianos (cierra en parte P-06 y AD-18): $230.000 = `"23000000"` |
| Llave privada entregada | Corresponde a la única llave publicada en el `jwks.json` de la wallet cliente; la versión base64 es la misma llave | Ya conocemos el `OP_KEY_ID` (va en `.env`) y evitamos el error típico de un `keyId` que no corresponde (Guía § Errores típicos) |
| SDK `@interledger/open-payments` | La 7.4.0 (11 de marzo de 2026) sigue siendo la última; `privateKey` acepta el texto PEM o la ruta del archivo | Se fija la 7.4.0, como pide AD-02 |
| Tipos del SDK 7.4.0 | El pago saliente no trae un campo de estado, solo `failed`, `debitAmount` y `sentAmount`; el pago entrante trae `completed` y `receivedAmount`. `grant.request` agrega el `client` por su cuenta | RN-10 necesita definir qué es «se completó» (D-15 y V-10) |
| `node:sqlite` en el Node 24.21 instalado | Funciona sin instalar nada (SQLite 3.53.4), con índices únicos parciales y `RETURNING` | La BD del piloto no necesita librerías nativas |
| Herramientas de la máquina | Node 24.21.0, npm 11.19.0, Git 2.56 y Vercel CLI 62.2.0 ya instalados | La Fase 0 puede arrancar |
| Wireframes | 22 pantallas: entrada, 6 de entidad, 6 de beneficiaria, 6 de punto y 3 extras. Escala de grises, fuentes Atkinson Hyperlegible e IBM Plex Mono, PIN de 4 dígitos con teclado propio | Base del [Plan frontend](./Plan%20frontend.md) |

---

## 5. Hallazgos de la revisión: qué hay que revisar en la documentación

Contradicciones y vacíos encontrados al cruzar los documentos con la BD y los wireframes. El
piloto toma una decisión provisional en cada uno; la decisión definitiva es del equipo.

| ID | Hallazgo | Dónde | Qué hace el piloto |
|---|---|---|---|
| D-01 | La BD agrega la tabla `beneficiario` con datos personales (nombres, nacimiento, celular, correo, municipio, estrato) «que entrega Colsubsidio». Eso contradice AD-12, HU-02 y RNF-06 («no guardamos la base de beneficiarios») | `db/001_esquema.sql` frente a Arquitectura e Historias | La implementa tal cual el `db/`, con datos ficticios. El monto y el PIN siguen viniendo de la liquidación simulada. **Decisión del equipo** |
| D-02 | La BD nombra las columnas en español (`billetera`, `token_acceso`, `llave_idempotencia`…) y el diccionario de las Historias en inglés (`wallet_address`, `access_token`, `idempotency_key`…) | `db/README.md` § Cambios | Manda la BD |
| D-03 | `cuenta_beneficiario` no guarda la `uri` ni el token de continuación del permiso de verificación. Sin ellos no se puede llamar `grant.continue` en el callback de HU-07 | BD e Historias § Diccionario | Agrega `uri_continuacion` y `token_continuacion` (temporales, solo backend). Es la única desviación obligatoria del esquema |
| D-04 | La BD le pone referencia (`SUB-000n`, obligatoria) a todo cobro, también a los rechazados; el tablero del wireframe muestra «—» en el rechazado | BD frente a wireframe 04 | Respeta la BD y la pantalla muestra «—» en los rechazados. Detalle cosmético: la numeración puede saltar |
| D-05 | Las 9 rutas de la Guía, más las 3 que agrega la Estructura, no alcanzan para los wireframes: faltan 16 (listar programas y puntos, registrar punto, validar una wallet, resumen de la liquidación, resumen del beneficiario, estado de la cuenta, cancelar cobro, cancelar aprobación, pausar y reanudar, cobros del punto, editar programa, salud…) | Guía § API REST frente a wireframes | Las agrega, marcadas como «nueva» en el contrato del [Plan backend](./Plan%20backend.md) § 7 |
| D-06 | ¿A dónde vuelve la Test Wallet después de aprobar? Estructura y Hallazgos usan `APP_BASE_URL/callback/:id`; las Historias ponen los callbacks en `API_BASE_URL` | Estructura § 6, Hallazgos § 3.2, Historias § Variables | La API recibe el callback (`{API_BASE_URL}/callback/:id`), verifica el hash y redirige a la web |
| D-07 | PIN: la Guía (§ Seguridad mínima) dice «se guarda con hash»; AD-14 y RNF-06 dicen que no se guarda (P-01) | Guía frente a Arquitectura | Lo valida la liquidación simulada: 0 columnas de PIN |
| D-08 | Hay dos mensajes para el doble cobro: HU-13 «Este subsidio ya fue cobrado» y HU-14 «Este subsidio ya está en proceso o fue cobrado» | Historias | Usa los dos: `YaCobrado` cuando ya está pagado y `EnProceso` cuando hay un cobro vivo |
| D-09 | «Cancelar cobro» (wireframe del PIN) y «Cancelar» la aprobación (wireframe Aprobar) no tienen regla ni mensaje en las Historias | Wireframes 03 y 15 | Motivo nuevo `Cancelado`; cancelar la aprobación usa `grant.cancel` |
| D-10 | Los datos de la demo no coinciden: «Subsidio adulto mayor» en los wireframes y «Subsidio jóvenes» de «Colsubsidio» en la BD; «[Persona 2]» frente a «Luis» | Wireframes frente a `db/002_datos_prueba.sql` | Usa «Subsidio adulto mayor (simulado)» y «Entidad de prueba». En una demo pública conviene no usar el nombre de una entidad real |
| D-11 | `Reglas de negocio.md` llama a la vigencia `vigente_desde`/`vigente_hasta` (Historias y BD dicen `vigencia_inicio`/`vigencia_fin`) y ubica RN-08 en `cobros/servicio.ts` (la Estructura la pone en `programas/servicio.ts`) | Reglas § 1 y § 4 | Mandan la BD y la Estructura |
| D-12 | La BD no guarda `expires_in` del token, aunque Hallazgos C3 pide guardarlo | Tabla `programa` | Rota de forma reactiva: ante un 401, `token.rotate` y un solo reintento (HU-06) |
| D-13 | Nada dice qué liquidación usa cada programa: no hay un campo para eso | HU-02, BD | El simulador sirve un único conjunto de prueba para cualquier subsidio |
| D-14 | Las wallets de ejemplo de los docs (`/ana`, `/punto-1`, `/programa-subsidio`) no son del equipo | Historias, BD, wireframes | Se configuran en `.env` (`DEMO_WALLET_*`) |
| D-15 | El pago saliente no tiene estado en Open Payments, así que RN-10 no dice cómo saber que «se completó» | SDK 7.4.0 frente a RN-10 | Pagado = `failed` en falso y `sentAmount` igual a `debitAmount`, o el pago entrante en `completed`. Se confirma en V-10 |
| D-16 | `ENDPOINTS.md` sigue sin las 8 correcciones (C1 a C8) y cita archivos de Postman que no existen | Hallazgos § 2 | `api/scripts/primer-cobro.ts` reemplaza la colección; el piloto confirma C1, C3 y C4 |
| D-17 | El bloqueo de 15 minutos tras 3 PIN errados no tiene tabla (P-12) | `db/README.md` § Pendientes | Lo deduce de los cobros rechazados por PIN en los últimos 15 minutos, sin tabla nueva |
| D-18 | Al cerrar se revoca el token y el tablero ya no puede leer el gastado del permiso; nada dice de dónde sale la pantalla «Programa cerrado» | HU-15, HU-17, wireframe 07 | Antes de revocar lee el gastado y lo guarda en el `detalle` del evento de cierre |
| D-19 | El wireframe del tablero dice «Se actualiza cada 5 s»; las Historias fijan `POLL_INTERVALO_MS = 1000` | Wireframe 04 frente a Historias | Dos cadencias: 5 s para el tablero y 1 s para el estado del cobro |
| D-20 | La Estructura guarda el rol en `sessionStorage`, que se pierde si la aprobación vuelve en otra pestaña | Estructura § 2 | Usa `localStorage` (sin datos sensibles), y las pantallas de regreso cargan por id desde la URL |
| D-21 | En el wireframe el punto solo digita la cédula, sin elegir programa. ¿Contra qué programa cobra? | Wireframe 14, HU-03 | La API busca, entre los subsidios activos, el que tenga un pago disponible para esa cédula |
| D-22 | Los extras no tienen modelo de datos: ni el QR de 60 s (HU-22) ni el contrato por hitos (HU-24) tienen tablas en `db/`, y el PDF417 (HU-23) no tiene wireframe | `db/`, wireframes | Quedan fuera del piloto; si se hacen, se diseñan aparte |

---

## 6. Decisiones provisionales del piloto

| Pendiente | Decisión para el piloto | Por qué |
|---|---|---|
| P-01 PIN | Lo valida la liquidación simulada; no se guarda | AD-14 y RNF-06 (D-07) |
| P-02 Liquidación | Módulo con router propio en `/api/liquidacion/*`, consumido por HTTP a través de `LIQUIDACION_URL` | Estructura § 3 |
| P-03 Despliegue | Fuera de este piloto | Así se pidió (§ 11) |
| P-04 Retiro parcial | Siempre el valor completo (RN-05) | El wireframe dice «se entrega el valor completo» |
| P-09 Canal cuenta | `POST /cobros` con canal `cuenta` pasa directo a Pagando y paga | El wireframe 10 cobra con un solo toque (RNF-03) |
| P-10 Contrato de la liquidación | El del [Plan backend](./Plan%20backend.md) § 5 | Hay que escribirlo antes de programar |
| P-11 Callback de cuentas | `GET /api/cuentas/callback/:id` | Estructura § 3 |
| P-12 Bloqueo del PIN | Se deduce de los cobros rechazados (D-17) | Sin tabla nueva |
| P-13 Cierre | `token.revoke`; `grant.cancel` solo para una aprobación pendiente | Hallazgos § 3.6 |
| P-14 y AD-06 Base de datos | SQLite con el módulo `node:sqlite` de Node 24 y SQL directo, sin ORM | Así se pidió; Guía § Stack la da como alternativa válida «si todo corre en un solo proceso» |
| P-15 Frontend | React Router 7, estado local con hooks propios y el rol en `localStorage` | «Nada nuevo para el equipo» (D-20) |
| P-16 Idempotencia y textos | La web genera la `llaveIdempotencia` (un UUID por intento); los textos de rechazo viven en la API | Un solo lugar para los textos |
| P-18 Pagando más de 10 s | Mensaje «Está tardando más de lo normal. No entregues el efectivo todavía» | RNF-02 |
| P-20 Orquestación | `cobros/orquestacion.ts` | Estructura § 3 |
| AD-18 Moneda | COP con escala 2 | Comprobado en la wallet cliente (§ 4) |

---

## 7. Matriz de verificación: qué va a comprobar el piloto

| ID | Qué se comprueba | Fuente | Cómo | Fase |
|---|---|---|---|---|
| V-01 | Un permiso sin receptor paga a 2 wallets distintas | T-1, P-05, AD-09 | Script | 1 |
| V-02 | Superar el tope hace que el banco rechace el pago: código y mensaje exactos | T-2, RN-09 | Script y paso 6 del guion | 1 y 8 |
| V-03 | Duración real del token (`expires_in`) y `token.rotate` | T-3, P-06 | Script | 1 |
| V-04 | Verificación de propiedad de la cuenta con `subject` | T-4, P-07 | API de HU-07 | 5 |
| V-05 | Variante exacta del hash del callback (base64 estándar o url, con o sin `=`, `grant_url` con o sin `/` final) | T-5, HU-04 | Script y test | 1 |
| V-06 | Reiniciar la API con un cobro en Pagando: sin pérdidas ni duplicados | T-6, P-08, RNF-05 | API | 8 |
| V-07 | `token.revoke` deja el permiso inutilizable; `grant.cancel` sirve para el pendiente | T-7, P-13 | Script y HU-17 | 1 y 8 |
| V-08 | Qué `client` envía el SDK y si el servidor lo acepta | T-8, C2 | Script: el SDK pone el `client`; si el permiso sale, esa forma sirve | 1 |
| V-09 | Errores GNAP `too_fast` e `invalid_continuation` | T-9, C7 | Script (opcional) | 1 |
| V-10 | Cómo saber que un pago se completó | D-15, RN-10 | Script | 1 |
| V-11 | Un pago entrante con monto fijo y un `debitAmount` igual se completa (¿hay comisiones en la Test Wallet?) | AD-10, Hallazgos C1 | Script | 1 |
| V-12 | Las wallets de una misma cuenta de la Test Wallet, ¿comparten saldo? Importa para el video | Guía § Checklist | Test Wallet | 1 |
| V-13 | Llegan `result=grant_rejected` y `grant_invalid`; la aprobación vence a los 10 minutos | HU-05 | API | 3 |
| V-14 | Del PIN a «Pagado» en 10 s o menos (9 de 10 cobros) | RNF-02 | Tiempos de la tabla `evento` | 8 |
| V-15 | Cómo se ve un pago sin fondos en la cuenta del programa | HU-13 | Script (opcional) | 1 |
| V-16 | Las 15 protecciones de la BD (`db/README.md`) también funcionan en SQLite | `db/README.md` | Vitest | 2 |
| V-17 | 10 solicitudes simultáneas con la misma cédula crean un solo cobro | RNF-11, HU-14 | Vitest | 4 |
| V-18 | Guion de la demo, pasos 2 a 7, de punta a punta | Guía § Guion | Manual | 8 |
| V-19 | Móvil y accesibilidad: 360 px, Lighthouse de 90 o más, botones de 44 px | RNF-03, RNF-04, RNF-08 | Frontend | 8 |
| V-20 | Cero secretos en el repo, en las respuestas de la API, en los logs y en los eventos | RNF-01, RNF-09 | Vitest y búsqueda | 2 a 8 |
| V-21 | La referencia del cobro se ve en la Test Wallet del que recibe | HU-09, HU-12 | Test Wallet | 1 y 8 |

---

## 8. Fases y puertas

Igual que en la Guía, una puerta es un control: si no se cumple, no se avanza a la fase siguiente.

| Fase | Qué se hace | Detalle | Puerta |
|---|---|---|---|
| 0 | Rama `piloto`; `.gitignore` en el primer commit; workspaces `api` y `web`; instalación con versiones exactas; `.env`; plantilla de `Resultados del piloto.md` | Ambos planes | `npm install` limpio y búsqueda de secretos en 0 |
| 1 | `api/scripts/primer-cobro.ts`: permiso, pagos, tope, gastado y revocación contra la Test Wallet | [Backend](./Plan%20backend.md) § 10 | Un pago real completo; V-01, V-02, V-05, V-10 y V-11 respondidas |
| 2 | BD SQLite, liquidación simulada, estados y reglas puras con sus tests | Backend § 4, 5 y 9 | Tests en verde (V-16) |
| 3 | Programa: crear, conectar la liquidación, autorizar, callback, tablero, pausar y cerrar | Backend § 7 | Un programa pasa a Activo con un callback real |
| 4 | Cobros: solicitar, confirmar, pagar, consultar, cancelar y recuperar al arrancar | Backend § 8 | Un cobro en el punto se paga desde la API (V-17) |
| 5 | Cuentas: enlazar y verificar, o el plan B | Backend § 7 y 8 | V-04 respondida |
| 6 | Base del frontend: Vite, Tailwind, shadcn/ui, sistema visual, rol y cliente de la API | [Frontend](./Plan%20frontend.md) | El selector de rol funciona |
| 7 | Vistas de entidad, beneficiario y punto conectadas a la API | Frontend § 3 y 8 | Pasos 2 a 5 del guion en la app |
| 8 | Guion completo, requisitos no funcionales y resultados | Ambos | V-18 y la matriz completa en `Resultados del piloto.md` |
| 9 | Opcional: extras detrás de sus banderas | Ambos | Solo si la Fase 8 pasó |

El frontend puede empezar después de la Fase 2 con la semilla «solo UI» (datos falsos, sin Open
Payments), como pide la Guía para los roles 3 y 4.

---

## 9. Stack y versiones

**Política:** versiones exactas (`save-exact`) y publicadas hace al menos dos semanas. La única
excepción es Vite: el 6 de octubre salió un parche en todas sus ramas a la vez, así que se toma el
último parche y se revisa su changelog al instalar.

| Capa | Paquete | Versión | Nota |
|---|---|---|---|
| Runtime | Node.js · npm | 24.21.0 · 11.19.0 | Ya instalados |
| Open Payments | `@interledger/open-payments` | 7.4.0 | AD-02 |
| API | `express` · `zod` | 5.2.1 · 4.6.5 | Express 5.3.0 salió el 9 de octubre: se usa la anterior |
| Base de datos | `node:sqlite` (viene con Node) | SQLite 3.53.4 | Sin dependencias; plan B: `better-sqlite3` 13.0.3 |
| TypeScript | `typescript` · `tsx` | 6.0.3 · 4.23.15 | La 7.0.2 es el compilador nuevo (nativo); la 6.0.3 es la más compatible |
| Pruebas | `vitest` · `supertest` | 5.0.2 · 7.2.2 | |
| Tipos | `@types/node` · `@types/express` · `@types/supertest` | 24.19.0 · 5.0.6 · 7.2.1 | `@types/node` en la línea 24, como el runtime |
| Web | `react` · `react-dom` · `react-router` | 19.3.0 · 19.3.0 · 7.18.4 | La 7.x sigue con parches; la 8 es una versión mayor con cambios |
| Build | `vite` · `@vitejs/plugin-react` | 8.3.4 · 6.1.1 | |
| Estilos | `tailwindcss` · `@tailwindcss/vite` · `tw-animate-css` | 4.3.3 · 4.3.3 · 1.4.0 | |
| Componentes | CLI `shadcn` · `lucide-react` · `clsx` · `tailwind-merge` · `class-variance-authority` | 4.21.0 · 1.48.0 · 2.1.1 · 3.7.0 · 0.7.1 | El CLI agrega las dependencias de cada componente; se fijan exactas |
| Fuentes | `@fontsource/atkinson-hyperlegible` · `@fontsource/ibm-plex-mono` | 5.3.0 · 5.3.0 | Las de los wireframes, servidas en local |
| Raíz | `concurrently` | 10.0.5 | Un solo `npm run dev` |
| Extras (no se instalan sin bandera) | `qrcode.react` · `html5-qrcode` | 4.2.0 · 2.3.8 | Guía § Stack |
| Después | Vercel CLI | 62.2.0 | Ya instalado (§ 11) |

---

## 10. Riesgos y planes B

| Riesgo | Señal | Plan B |
|---|---|---|
| Un permiso sin receptor no paga a varias wallets | V-01 falla | Un permiso por destino (AD-09). Impacto alto: cambia O2 |
| La Test Wallet no rechaza por tope (no hay `InsufficientGrant`) | V-02 | Rechazo de la plataforma, y se dice así en el video (Historias § Riesgos) |
| La Test Wallet no acepta el permiso con `subject` | V-04 | `VERIFICACION_CUENTA=simulada`: se enlaza sin verificar y se presenta como paso de producción (Historias § Riesgos) |
| El hash no coincide con ninguna variante | V-05 | Revisar el orden de los componentes y la `grant_url`; preguntar a los mentores en el Slack de Interledger |
| No se pueden cargar $690.000 COP de prueba | Depósito | Bajar los montos por configuración (por ejemplo, $2.300 por persona) |
| La Test Wallet cobra comisiones | V-11 | Pago entrante sin monto fijo, o cotización con `receiveAmount` (forma A) |
| `node:sqlite` falla con Vitest o tsx | Fase 2 | `better-sqlite3` 13.0.3, con la misma API síncrona |
| Problemas al importar el SDK (CommonJS desde ESM) | Fase 1 | Se detecta en el script, antes de construir la API |
| El token vence en mitad de una prueba | 401 | `token.rotate` y un reintento (HU-06) |
| La llave se filtra | Búsqueda de secretos | Rotarla en la Test Wallet; el `OP_KEY_ID` cambia |

---

## 11. Despliegue en Vercel (pendiente, fuera de este piloto)

Lo que hay que resolver cuando se retome:

- **Web:** el build de Vite es estático y sube a Vercel tal cual.
- **API con SQLite:** en Vercel Functions el disco es efímero y puede haber varias instancias, así
  que el archivo SQLite no persiste: se perderían los nonces y tokens entre `autorizar` y el
  callback, y los cobros. Hay tres caminos:
  1. API en un servidor con disco persistente (Render, Railway o Fly). Es lo que dice AD-17.
  2. API en Vercel con Turso (SQLite en la nube, `@libsql/client`). Solo cambia `api/src/db/`.
  3. Volver a PostgreSQL gestionado (Supabase o Neon). También cambia solo `api/src/db/`.
- La Guía desaconseja runtimes edge o serverless para el cliente de Open Payments; en Vercel habría
  que usar el runtime de Node, no el Edge.
- Los callbacks necesitan una URL pública con HTTPS (`API_BASE_URL`), y la cámara de los extras
  también exige HTTPS.

Por eso el piloto se arma con todas las rutas bajo `/api`, el SQL encerrado en `api/src/db/`, toda
la configuración en variables de entorno y la llave en base64 (`OP_PRIVATE_KEY_BASE64`), que se
puede cargar como variable en Vercel.

---

## 12. Lo que necesito para ejecutar

**Decisiones (tomadas el 10 de octubre con la opción recomendada):**

1. ✅ **Rama `piloto` y piloto desechable** (§ 1). El código vive en `piloto` y todavía no tiene
   commits.
2. ✅ **Tabla `beneficiario`:** implementada tal cual el `db/`, con datos ficticios; la
   contradicción D-01 sigue anotada para el equipo.
3. ✅ **Wallets de la demo:** las 4 en COP (programa, Ana, Luis y punto).
4. ✅ **Vercel** queda fuera de este piloto (§ 11).

**Prerrequisitos que solo puede hacer el dueño de la Test Wallet (lo único que bloquea):**

- [ ] Crear las wallet addresses de la demo en COP, con nombres únicos (por ejemplo, `tatu-programa`,
      `tatu-ana`, `tatu-luis` y `tatu-punto1`), y compartir sus URLs. Si la Test Wallet deja crear
      cuentas separadas, mejor una cuenta por papel: así cada saldo se mueve por su lado (V-12).
- [ ] Depositar dinero de prueba en la wallet del programa: al menos $700.000 COP (el tope de
      $690.000 más margen para el script de la Fase 1).
- [ ] Tener la sesión de la Test Wallet abierta para aprobar los permisos cuando el script y la app
      lo pidan.
- [ ] Llenar `api/.env` (ignorado por git): `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID`,
      `OP_PRIVATE_KEY_BASE64` (o `_PATH`) y las 4 `DEMO_WALLET_*`. `GET /api/salud` dice si la
      llave coincide con el `jwks.json` antes del primer pago.

Si el saldo de prueba no alcanza, `LIQUIDACION_MONTO_BASE=230000` baja todos los montos 100 veces
($2.300 por persona; el guion completo gasta $4.600), como prevé el plan B de la § 10.

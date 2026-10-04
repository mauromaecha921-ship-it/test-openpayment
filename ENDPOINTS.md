# Open Payments — guía completa (sandbox de pruebas)

Esto explica **qué hace cada paso, por qué y cómo** la colección `open-payments.postman_collection.json`.
El objetivo final es: crear un pago entrante, cotizarlo, aprobar el pago saliente y ejecutarlo.

---

## 1. Qué es Open Payments

Es una **API REST para cuentas de dinero** sobre Interledger (ILP). Permite mover fondos entre
cuentas sin tocar el protocolo de pagos: primero se declaran las intenciones (pagos entrantes,
cotizaciones, pagos salientes) y luego el protocolo ILP hace el movimiento real.

Para no equivocarse al probar, todo ocurre en el **sandbox público de Interledger**: cuentas de
prueba con saldo ficticio, abiertas para cualquiera.

---

## 2. Las 3 piezas del sistema

| Pieza | Qué es | URL (tu cuenta) |
|---|---|---|
| **Wallet address** | La "tarjeta de presentación" de tu cuenta. Solo dice dónde viven los otros dos servicios y qué clave pública usas. | `https://ilp.interledger-test.dev/alh` |
| **AS** (authorization server) | Entrega y revoca **tokens de acceso** (estándar GNAP). Nunca guarda dinero. | `https://auth.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c` |
| **RS** (resource server) | Donde viven los recursos reales: `incoming-payments`, `quotes`, `outgoing-payments`. | `https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c` |
| **Test Wallet API** | Panel interno del sandbox: es donde el "usuario" aprueba los permisos interactivos. | `https://api-wallet.interledger-test.dev` |

El **paso 1** descubre `authServer` y `resourceServer` leyendo la wallet address, así que no hace
falta memorizar esas dos URLs largas.

---

## 3. Cómo se autentica (la parte difícil)

Hay **dos niveles** y confunden a todo el mundo:

### Nivel A — el token (GNAP)
Pedirle al AS un permiso (un *grant*) y recibir un `access_token`. Luego cada petición al RS lleva:

```
Authorization: GNAP 7Zg1XN5s...
```
El prefijo es **`GNAP`**, no `Bearer`.

### Nivel B — firmar la petición (RFC 9421)
El AS no confía en que le digas "soy la wallet X": tienes que **firmar cada petición** con tu clave
privada Ed25519. Tu clave pública está publicada en `https://ilp.interledger-test.dev/alh/jwks.json`
y el AS la busca usando el `keyid` que tú indicas.

Cómo se firma (lo hace **automáticamente** el *prerequest* de la colección, `prerequest.js`):

1. **Qué se firma** (los *componentes*), en este orden:
   ```
   @method, @target-uri
   + content-digest, content-length, content-type   (solo si hay body)
   + authorization                                   (solo si ya hay token)
   ```
2. **Digest del body**: `Content-Digest: sha-512=:<base64>:` sobre los bytes exactos del body.
   ⚠️ El body **debe ir en una línea (sin saltos de línea)**: el AS lo re-serializa en JSON plano
   y si tú firmaste una versión con espacios, la verificación falla con `401 invalid signature headers`.
3. **La base de la firma** (texto plano, una línea por componente + la última con los parámetros):
   ```
   "@method": POST
   "@target-uri": https://auth.interledger-test.dev/f537937b-...
   "content-digest": sha-512=:wcFay...
   "content-length": 283
   "content-type": application/json
   "@signature-params": ("@method" "@target-uri" "content-digest" "content-length" "content-type");keyid="50c71b5c-...";created=1791074029
   ```
4. **Envío**: esa base se firma con Ed25519 (clave privada de la variable `OP_PRIVATE_KEY_PEM`) y se
   mandan tres cabeceras:
   ```
   Signature-Input: sig1=(...);keyid="50c71b5c-...";created=1791074029
   Signature: sig1=:Rq3QfdpG9N3x0YXX9BKK2d0j...==:
   Content-Digest: sha-512=:wcFay...:
   ```

El AS reconstruye la misma base desde lo que recibe, verifica la firma contra `jwks.json` y
responde. Si algo no cuadra → `401 invalid_client / invalid signature headers`.

---

## 4. El recorrido completo

```
 1  GET  wallet address            → descubrir AS y RS
 2  POST AS                        → grant de incoming-payment   → token_incoming
 3  POST RS/incoming-payments      → declarar que te van a pagar → incoming_payment_url
 4  GET  incoming_payment_url      → comprobar que quedó creada
 ─── hasta acá es "soy receptor" ───
 5  POST AS                        → grant de quote              → token_quote
 6  POST RS/quotes                 → cuánto cuesta enviar 5,00   → quote_url
 7  GET  quote_url                 → comprobar la cotización
 ─── a partir de acá haces de emisor y necesitas aprobación ───
 8  POST AS (interactivo)          → pedir permiso de pago saliente → interact_url / continue_uri
 9  GET  interact_url              → abrir la pantalla de aprobación (302)
10  GET  api-wallet/…              → ver qué estás pidiendo
11  PATCH api-wallet/…             → el usuario acepta  {"response":"accept"}
12  GET  …/finish                  → el AS entrega interact_ref (302)
13  POST continue_uri              → canjear interact_ref por el token final → token_outgoing
14  POST RS/outgoing-payments      → ejecutar el pago con ese quote → outgoing_payment_url
15  GET  outgoing_payment_url      → comprobar el pago
16  GET  RS/outgoing-payment-grant → ver cuánto del límite gastaste
17  DELETE manage_url              → revocar el token (limpieza)
```

---

## 5. Paso a paso detallado

Variables en `{{...}}`: `OP_WALLET_ADDRESS`, `auth_server`, `resource_server`, `api_wallet` y las que
va guardando cada paso (columna "Guarda").

### Paso 1 — Descubrir los servidores
- **Qué hace:** lee la wallet address pública.
- **Por qué:** el resto de los pasos se construyen a partir de `authServer` y `resourceServer`.
- `GET https://ilp.interledger-test.dev/alh`  (sin token, sin firma)
- **Respuesta:** `200`
  ```json
  { "id":"https://ilp.interledger-test.dev/alh",
    "authServer":"https://auth.interledger-test.dev/f537…",
    "resourceServer":"https://ilp.interledger-test.dev/f537…",
    "jwksUrl":"https://ilp.interledger-test.dev/alh/jwks.json" }
  ```
- **Guarda:** `auth_server`, `resource_server`

### Paso 2 — Grant de pago entrante (no interactivo)
- **Qué hace:** pide permiso para crear/leer pagos entrantes.
- **Por qué:** sin este token el RS rechaza cualquier `/incoming-payments`. No necesita aprobación
  de un usuario, por eso es "no interactivo" y sale directo.
- `POST https://auth.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c`
  `Content-Type: application/json` + firma (nivel B)
  ```json
  { "access_token": { "access": [ { "type": "incoming-payment",
      "actions": ["create","read","read-all","list","complete"] } ] },
    "client": "https://ilp.interledger-test.dev/alh" }
  ```
  - `client` = **la URL de tu wallet address en texto** (no un objeto `{key:{jwk}}`).
  - `actions` = qué te permite hacer el token.
- **Respuesta:** `200`
  ```json
  { "access_token": { "value":"A47596F6…", "manage":"https://auth…/token/126b…",
      "access":[…], "expires_in":900 } }
  ```
- **Guarda:** `token_incoming`, `token_incoming_manage`

### Paso 3 — Crear el pago entrante
- **Qué hace:** declara "alguien me va a pagar 10,00 USD".
- **Por qué:** un quote (paso 6) necesita una recepción con la que comparar.
- `POST https://ilp.interledger-test.dev/f537…/incoming-payments`
  `Authorization: GNAP {{token_incoming}}` + `Content-Type: application/json` + firma
  ```json
  { "walletAddress":"https://ilp.interledger-test.dev/alh",
    "incomingAmount":{"value":"1000","assetCode":"USD","assetScale":2},
    "metadata":{"description":"Prueba desde Postman"} }
  ```
  - El campo es **`incomingAmount`** (no `amount`).
  - `value` es entero: 1000 con `assetScale:2` = 10,00 USD.
- **Respuesta:** `201` con el recurso completo
- **Guarda:** `incoming_payment_url` (la URL del pago recién creado)

### Paso 4 — Leer el pago entrante
- `GET {{incoming_payment_url}}` con `GNAP {{token_incoming}}` → `200`
- **Para qué:** ver `state: "pending"`, `receiver`, el monto y el `completed` a medida que llegue.

### Paso 5 — Grant de cotización (no interactivo)
- `POST {{auth_server}}` con el mismo formato del paso 2 pero:
  ```json
  { "access_token": { "access": [ { "type":"quote",
      "identifier":"https://ilp.interledger-test.dev/alh",
      "actions":["create","read","read-all"] } ] },
    "client":"https://ilp.interledger-test.dev/alh" }
  ```
  - `identifier` = sobre qué wallet address aplica.
  - ⚠️ en `quote` **no se admite `list`** en `actions`.
- **Respuesta:** `200` → **Guarda:** `token_quote`

### Paso 6 — Crear la cotización
- **Qué hace:** "¿cuánto me cuesta enviar 5,00 USD a ese pago entrante?".
- **Por qué:** el pago saliente **siempre** necesita un `quoteId`; no se puede enviar sin cotizar.
- `POST {{resource_server}}/quotes` con `GNAP {{token_quote}}`
  ```json
  { "walletAddress":"https://ilp.interledger-test.dev/alh",
    "receiver":"<incoming_payment_url>",
    "method":"ilp",
    "debitAmount":{"value":"500","assetCode":"USD","assetScale":2} }
  ```
- **Respuesta:** `201` con `id`, `debitAmount`, `receiveAmount`, `expiresAt`
- **Guarda:** `quote_url`
- ⚠️ **Un quote se usa una sola vez** (`400 invalid quote` si lo reutilizas).

### Paso 7 — Leer la cotización
- `GET {{quote_url}}` con `GNAP {{token_quote}}` → `200` (vence pronto: `expiresAt`).

### Paso 8 — Grant de pago saliente (interactivo)
- **Qué hace:** pide permiso para enviar dinero **con un límite de gasto**.
- **Por qué es interactivo:** no puedes autotarte el permiso de gastar; el dueño de la cuenta tiene
  que aprobarlo en la pantalla del Test Wallet. El AS devuelve un `interact_url` en lugar del token.
- `POST {{auth_server}}`
  ```json
  { "access_token": { "access": [ { "type":"outgoing-payment",
      "identifier":"https://ilp.interledger-test.dev/alh",
      "actions":["create","read","read-all","list"],
      "limits":{"debitAmount":{"value":"5000","assetCode":"USD","assetScale":2}} } ] },
    "client":"https://ilp.interledger-test.dev/alh",
    "interact": { "start":["redirect"],
      "finish": {"method":"redirect","uri":"https://example.com/finish","nonce":"n-1"} } }
  ```
  - `limits.debitAmount` = tope total que ese token podrá gastar.
  - `interact.finish.nonce` = valor aleatorio que servirá para comprobar que el callback es tuyo.
- **Respuesta:** `201` con `interact: {redirect: "https://auth…/interact/…"}` y
  `continue: {uri: "https://auth…/continue/…", access_token:{value:"CONT-…"}}`
- **Guarda:** `interact_url`, `continue_uri`, `continue_token`, `interact_finish`

### Paso 9 — Abrir la interacción (sin seguir el redirect)
- `GET {{interact_url}}` con **`followRedirect: false`**
- **Qué pasa:** `302 Location: https://wallet.interledger-test.dev/grant-interactions?interactId=…&nonce=…`
  y `Set-Cookie: sessionId=…; sessionId.sig=…`
- **Por qué:** esa cookie es la sesión con la que el AS te reconoce en los siguientes pasos.
- **Guarda:** `interact_id`, `nonce`, `as_origin`, `as_cookie`

### Paso 10 — Ver qué se está pidiendo
- `GET https://api-wallet.interledger-test.dev/grant-interactions/{{interact_id}}/{{nonce}}`
  con `Cookie: {{OP_TESTNET_COOKIE}}` (tu sesión en el Test Wallet) → `200`
- **Para qué:** es lo que vería el usuario en pantalla (monto, límite, acciones).

### Paso 11 — Aceptar (el "clic" del usuario)
- `PATCH https://api-wallet.interledger-test.dev/grant-interactions/{{interact_id}}/{{nonce}}`
  `Cookie: {{OP_TESTNET_COOKIE}}` + `Content-Type: application/json`
  ```json
  { "response": "accept" }
  ```
- `accept` aprueba, `reject` rechaza → `200`

### Paso 12 — Finish: conseguir el `interact_ref`
- `GET {{as_origin}}/interact/{{interact_id}}/{{nonce}}/finish` con `Cookie: {{as_cookie}}`
  → `302` y el `Location` termina en `#interact_ref=...`
- **Qué es:** el comprobante de que el usuario aprobó. Es de un solo uso.
- **Guarda:** `interact_ref`

### Paso 13 — Canjear el grant
- `POST {{continue_uri}}` con `Authorization: GNAP {{continue_token}}`
  ```json
  { "interact_ref": "{{interact_ref}}" }
  ```
- **Qué hace:** entrega el `interact_ref` al AS y este devuelve **el token real**.
- **Respuesta:** `201` → **Guarda:** `token_outgoing`, `token_outgoing_manage`

### Paso 14 — Ejecutar el pago saliente
- `POST {{resource_server}}/outgoing-payments` con `GNAP {{token_outgoing}}`
  ```json
  { "walletAddress":"https://ilp.interledger-test.dev/alh",
    "quoteId":"<quote_url>" }
  ```
- **Qué hace:** crea el pago usando la cotización; el límite del grant empieza a descontarse.
- **Respuesta:** `201` → **Guarda:** `outgoing_payment_url`

### Paso 15 — Leer el pago saliente
- `GET {{outgoing_payment_url}}` con `GNAP {{token_outgoing}}` → `200`
  (estado `pending` / `completed`, montos, `quote` asociado).

### Paso 16 — Consumo del grant
- `GET {{resource_server}}/outgoing-payment-grant` con `GNAP {{token_outgoing}}` → `200`
- **Qué muestra:** cuánto del `limits.debitAmount` ya gastaste con ese token.

### Paso 17 — Revocar el token (limpieza)
- `DELETE {{token_outgoing_manage}}` con `GNAP {{token_outgoing}}` → `204`
- **Por qué:** el token deja de servir inmediatamente.

---

## 6. Cómo ejecutarlo

**En Postman**
1. Importa `open-payments.postman_collection.json` y `open-payments-sandbox.postman_environment.json`.
2. Selecciona el environment *Open Payments Sandbox*.
3. Play → *Run collection*. No hay que escribir ninguna cabecera a mano: el *prerequest* de la
   colección (`prerequest.js`) firma todo con `OP_PRIVATE_KEY_PEM`.

**Por consola**
```bash
newman run open-payments.postman_collection.json \
         -e open-payments-sandbox.postman_environment.json
```
Los pasos 1–7 se pueden correr sueltos (`--folder "1. Wallet address"`); del 8 en adelante hay que
correr la colección entera porque cada paso depende del anterior.

---

## 7. Errores típicos

| Mensaje | Causa | Solución |
|---|---|---|
| `401 invalid_client / invalid signature headers` | La firma no coincide con lo que recibe el AS. Casi siempre el body va con saltos de línea: el AS lo re-serializa en JSON plano y el `Content-Digest` no coincide. | Body en una línea (la colección ya lo genera así). |
| `400 body.client must be string` | Mandaste `client` como objeto. | `"client": "https://ilp.interledger-test.dev/alh"` |
| `400 invalid quote` | Reusaste un quote. | Crea uno nuevo en el paso 6. |
| `403 Inactive Token` | Token revocado o expirado (viven ~15 min). | Repite desde el paso del grant correspondiente. |
| `401 invalid interact_ref` | El `interact_ref` ya se canjeó. | Repite 9→13. |
| Grant de quote rechazado | `actions` con `list`. | Usa `["create","read","read-all"]`. |

---

## 8. Archivos

| Archivo | Para qué |
|---|---|
| `open-payments.postman_collection.json` | La colección con los 17 pasos. |
| `open-payments-sandbox.postman_environment.json` | URLs, `OP_KEY_ID`, `OP_PRIVATE_KEY_PEM`, cookie del Test Wallet. |
| `prerequest.js` | La firma Ed25519 + RFC 9421 (se inyecta como prerequest de la colección). |
| `build.mjs` | Regenera la colección: `node build.mjs`. |
| `ENDPOINTS.md` | Este documento. |

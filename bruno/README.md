# Open Payments en Bruno 4.2.1 — scripts y guía de uso

Adaptación a Bruno de la colección Postman descrita en `../ENDPOINTS.md`.
El flujo: crear pago entrante → cotizar → aprobar pago saliente → ejecutarlo.

---

## 0. Requisitos previos (una sola vez)

1. **Developer Mode activado** en la colección (Bruno lo pide al abrirla, o en
   *Collection Settings → Security*). Sin él, `require("crypto")` y `Buffer` no
   funcionan y la firma falla.
2. Crear un **entorno** (p.ej. `Open Payments Sandbox`) con estas variables:

   | Variable | Valor | ¿Quién la pone? |
   |---|---|---|
   | `OP_WALLET_ADDRESS` | `https://ilp.interledger-test.dev/alh` | Tú |
   | `OP_KEY_ID` | `50c71b5c-...` (tu key id) | Tú |
   | `OP_PRIVATE_KEY_PEM` | Clave privada Ed25519 en PEM (pkcs8). Marcar como *secret*. | Tú |
   | `OP_TESTNET_COOKIE` | Cookie de sesión de https://wallet.interledger-test.dev (DevTools del navegador → copiar cabecera `Cookie`) | Tú |
   | `auth_server`, `resource_server`, `token_incoming`, `token_quote`, `token_outgoing`, etc. | — | **Se rellenan solas** con los scripts post-response |

   > Si el PEM lo pegas en una sola línea con `\n` literales, el script lo corrige solo.

---

## 1. Script de firma global (el corazón)

Pegar el contenido de **`collection-pre-request.js`** en:

> Colección → ⚙ Settings → Scripts → **Pre Request**

Firma automáticamente (RFC 9421 + Ed25519) toda petición que tenga **body JSON**
o **header `Authorization: GNAP …`**, y excluye el Test Wallet API (que va con
cookie). Por tanto **no hay que pegar nada de firma en los requests
individuales**: los pasos 2–8 y 13–17 se firman solos; los pasos 1, 9, 10, 11 y
12 no se firman (que es lo correcto).

> Reemplaza al antiguo `script-incoming-payment-grant.ts` (hardcodeado al paso 2).

---

## 2. Qué script va en cada paso / endpoint

Leyenda — **Pre**: pestaña *Script → Pre Request* del request ·
**Post**: pestaña *Script → Post Response* del request ·
**Firma**: la aplica el script global, no pegues nada.

| # | Request | Headers manuales (pestaña Headers) | Body (pestaña Body, JSON) | Pre | Post |
|---|---|---|---|---|---|
| 1 | `GET {{OP_WALLET_ADDRESS}}` | — | — | — | `paso-01-post-response.js` |
| 2 | `POST {{auth_server}}` | — (el script pone Content-Type) | grant incoming ① | firma auto | `paso-02-post-response.js` |
| 3 | `POST {{resource_server}}/incoming-payments` | `Authorization: GNAP {{token_incoming}}` | incoming payment ② | firma auto | `paso-03-post-response.js` |
| 4 | `GET {{incoming_payment_url}}` | `Authorization: GNAP {{token_incoming}}` | — | firma auto | — |
| 5 | `POST {{auth_server}}` | — | grant quote ③ | firma auto | `paso-05-post-response.js` |
| 6 | `POST {{resource_server}}/quotes` | `Authorization: GNAP {{token_quote}}` | quote ④ | firma auto | `paso-06-post-response.js` |
| 7 | `GET {{quote_url}}` | `Authorization: GNAP {{token_quote}}` | — | firma auto | — |
| 8 | `POST {{auth_server}}` | — | grant outgoing interactivo ⑤ | firma auto | `paso-08-post-response.js` |
| 9 | `GET {{interact_url}}` | — | — | `paso-09-pre-request.js` | `paso-09-post-response.js` |
| 10 | `GET https://api-wallet.interledger-test.dev/grant-interactions/{{interact_id}}/{{nonce}}` | `Cookie: {{OP_TESTNET_COOKIE}}` | — | — | — |
| 11 | `PATCH https://api-wallet.interledger-test.dev/grant-interactions/{{interact_id}}/{{nonce}}` | `Cookie: {{OP_TESTNET_COOKIE}}` | `{"response":"accept"}` | — | — |
| 12 | `GET {{as_origin}}/interact/{{interact_id}}/{{nonce}}/finish` | `Cookie: {{as_cookie}}` | — | `paso-12-pre-request.js` | `paso-12-post-response.js` |
| 13 | `POST {{continue_uri}}` | `Authorization: GNAP {{continue_token}}` | `{"interact_ref":"{{interact_ref}}"}` | firma auto | `paso-13-post-response.js` |
| 14 | `POST {{resource_server}}/outgoing-payments` | `Authorization: GNAP {{token_outgoing}}` | outgoing payment ⑥ | firma auto | `paso-14-post-response.js` |
| 15 | `GET {{outgoing_payment_url}}` | `Authorization: GNAP {{token_outgoing}}` | — | firma auto | — |
| 16 | `GET {{resource_server}}/outgoing-payment-grant` | `Authorization: GNAP {{token_outgoing}}` | — | firma auto | — |
| 17 | `DELETE {{token_outgoing_manage}}` | `Authorization: GNAP {{token_outgoing}}` | — | firma auto | — |

> Los pasos 9 y 12 necesitan `req.setMaxRedirects(0)` para **no** seguir el 302
> y poder leer el header `Location`. (Alternativa: desactivar *Follow redirects*
> en los settings de la colección.)

---

## 3. Bodies listos para pegar (pestaña Body → JSON)

El script global los minifica antes de firmar, así que puedes pegarlos tal cual.

**① Paso 2 — grant incoming-payment**
```json
{"access_token":{"access":[{"type":"incoming-payment","actions":["create","read","read-all","list","complete"]}]},"client":"{{OP_WALLET_ADDRESS}}"}
```

**② Paso 3 — crear incoming payment** (1000 con assetScale 2 = 10,00 USD)
```json
{"walletAddress":"{{OP_WALLET_ADDRESS}}","incomingAmount":{"value":"1000","assetCode":"USD","assetScale":2},"metadata":{"description":"Prueba desde Bruno"}}
```

**③ Paso 5 — grant quote** (⚠️ `quote` no admite `list` en actions)
```json
{"access_token":{"access":[{"type":"quote","identifier":"{{OP_WALLET_ADDRESS}}","actions":["create","read","read-all"]}]},"client":"{{OP_WALLET_ADDRESS}}"}
```

**④ Paso 6 — crear quote** (enviar 5,00 USD)
```json
{"walletAddress":"{{OP_WALLET_ADDRESS}}","receiver":"{{incoming_payment_url}}","method":"ilp","debitAmount":{"value":"500","assetCode":"USD","assetScale":2}}
```

**⑤ Paso 8 — grant outgoing-payment interactivo** (límite de gasto 50,00 USD)
```json
{"access_token":{"access":[{"type":"outgoing-payment","identifier":"{{OP_WALLET_ADDRESS}}","actions":["create","read","read-all","list"],"limits":{"debitAmount":{"value":"5000","assetCode":"USD","assetScale":2}}}]},"client":"{{OP_WALLET_ADDRESS}}","interact":{"start":["redirect"],"finish":{"method":"redirect","uri":"https://example.com/finish","nonce":"n-1"}}}
```

**⑥ Paso 14 — ejecutar pago saliente**
```json
{"walletAddress":"{{OP_WALLET_ADDRESS}}","quoteId":"{{quote_url}}"}
```

---

## 4. Orden de ejecución

1. Pasos **1–7** se pueden ejecutar sueltos (son "soy receptor" + cotización).
2. Del paso **8 en adelante** hay que ejecutarlos en orden y sin pausas largas:
   los tokens viven ~15 min y el `interact_ref` es de un solo uso.
3. El paso **11** es el "clic del usuario": requiere la cookie válida del Test
   Wallet (`OP_TESTNET_COOKIE`). En el sandbox también puedes abrir la
   `interact_url` en el navegador y aceptar a mano; entonces 10–11 no hacen falta.

---

## 5. Errores típicos

| Mensaje | Causa | Solución |
|---|---|---|
| `require is not defined` / `crypto` falla | Colección en Safe Mode | Activar **Developer Mode** |
| `401 invalid signature headers` | Body firmado ≠ body enviado | El script global ya lo minifica; no edites headers de firma a mano |
| `400 body.client must be string` | `client` como objeto | Usar la URL de la wallet en texto (ver bodies §3) |
| `400 invalid quote` | Quote reutilizado | Repetir paso 6 (un quote = un uso) |
| `403 Inactive Token` | Token expirado (~15 min) o revocado | Repetir desde el grant correspondiente (paso 2, 5 u 8) |
| `401 invalid interact_ref` | `interact_ref` ya canjeado | Repetir pasos 9→13 |
| Grant de quote rechazado | `actions` incluye `list` | Usar `["create","read","read-all"]` |
| Paso 12 sin `interact_ref` | No se aceptó el grant | Ejecutar paso 11 con cookie válida (o aceptar en el navegador) |

---

## 6. Archivos

| Archivo | Dónde se pega |
|---|---|
| `collection-pre-request.js` | Colección → Settings → Scripts → **Pre Request** |
| `paso-01-post-response.js` … `paso-14-post-response.js` | Request correspondiente → Script → **Post Response** |
| `paso-09-pre-request.js`, `paso-12-pre-request.js` | Requests 9 y 12 → Script → **Pre Request** |

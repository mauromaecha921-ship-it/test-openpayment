# Hallazgos — Investigación de Fuentes

> Consolidación de toda la investigación previa a la implementación: correcciones a `ENDPOINTS.md`,
> evidencia de especificación para los pendientes `P-01…P-25`, payloads de referencia para copiar y
> pegar en las pruebas, y checklist de pruebas contra la Test Wallet.
>
> **Fecha:** 6 de octubre de 2026 · **Estado:** investigación cerrada, decisiones del equipo pendientes.

## Cómo leer este documento

Abreviaturas de fuentes (todas clonadas y verificadas línea por línea):

| Abreviatura | Fuente |
|---|---|
| `[AS:nnn]` | `open-payments-specifications/openapi/auth-server.yaml` (v1.4.0) |
| `[RS:nnn]` | `open-payments-specifications/openapi/resource-server.yaml` (v1.4.0) |
| `[ENDPOINTS:nnn]` | `ENDPOINTS.md` de este repo |
| `[SDK:nnn]` | `open-payments-node/packages/open-payments/src/...` (SDK `@interledger/open-payments` 7.4.0) |
| `[DOCS:ruta]` | `open-payments/docs/src/content/docs/...` (openpayments.dev) |
| `[ARQ:nnn]` | `Documento de Arquitectura - Hackathon Open Payments.md` |
| `[HU:nnn]` | `Historias de Usuario - Bonos con Destino.md` |

---

## 1. Resumen ejecutivo

**Fuentes revisadas:**

1. Este repo (`test-openpayment`): Guía, Arquitectura, Historias, `ENDPOINTS.md`, script de Bruno.
2. `interledger/open-payments`: guías oficiales EN/ES de openpayments.dev (outgoing future payments,
   verify ownership, hash verification) y snippets del SDK.
3. `interledger/open-payments-specifications` **v1.4.0**: `auth-server.yaml` (1033 líneas),
   `resource-server.yaml` (1503 líneas), `wallet-address-server.yaml`.
4. `interledger/open-payments-node`: SDK 7.4.0, tipos (`types.ts`, tipos generados desde el OpenAPI).
5. Org `interledger` en GitHub: 104 repos inventariados (anexo en §6).

**Lo que esta investigación cerró:**

- **AD-10** está confirmada por especificación: `outgoingPayment.create` es `oneOf` (quote **o**
  incoming-payment + debitAmount). `ENDPOINTS.md` está al decir que «siempre» necesita `quoteId`.
- **P-05** tiene evidencia documental fuerte: la guía oficial *Split payments* pide **un grant sin
  `receiver`** y crea **dos pagos salientes a wallets distintas con el mismo token**. Solo falta
  reproduciéndolo en la Test Wallet (Rafiki).
- **P-07** está soportado por spec y SDK: grant con `subject.sub_ids` (maxItems 1, `format: uri`),
  interactivo, y helpers del SDK `isFinalizedGrantWithSubject`. Solo falta la prueba.
- **P-13** está respuelta a nivel de especificación: `DELETE /continue/{id}` cancela un grant
  **pendiente**; `DELETE /token/{id}` (vía `access_token.manage`) **revoca** uno ya emitido. HU-17
  corresponde a `token.revoke`.
- **HU-04 (hash)**: fórmula y vectores de prueba exactos, con un gotcha real detectado (§3.5).
- **P-06**: `expires_in` no está fijado por el spec; los ejemplos usan 3600 y el sandbox en
  `ENDPOINTS.md` reporta 900 → hay que medirlo y usar `token.rotate`.
- Tipos del SDK 7.4.0 verificados: `subject`, `Client` (string | `{walletAddress}` | `{jwk}`),
  `receiver` opcional en límites, `CreateOutgoingPaymentArgs` como unión de las dos formas.

**Lo que NO resuelve (va al equipo, §7):** decisiones de producto (P-01…P-04), contratos internos
(P-09, P-10, P-16), infraestructura (P-14, P-15), identidad visual (P-17…P-19) y las pruebas
físicas en Test Wallet (§5).

---

## 2. Correcciones a `ENDPOINTS.md`

| # | Ubicación | Dice | La fuente oficial dice | Corrección |
|---|---|---|---|---|
| C1 | `[ENDPOINTS:180]` «el pago saliente **siempre** necesita un `quoteId`; no se puede enviar sin cotizar» | Siempre `quoteId` | `create-outgoing-payment-request` es `oneOf`: `from-quote` (quoteId) **o** `from-incoming-payment` (incomingPayment + debitAmount). `[RS:283]`, `[RS:762-765]`, `[RS:789-810]` | Falso. Se puede crear el pago saliente directo desde el pago entrante con `incomingPayment + debitAmount` (es la ruta que usa el cobro O4). Ejemplos de payload en §3.1. |
| C2 | `[ENDPOINTS:136-138]` y tabla de errores `[ENDPOINTS:295]` «`400 body.client must be string` → mandaste `client` como objeto» | String obligatorio | El spec define `client` como `oneOf`: objeto `{walletAddress}` (preferido), objeto `{jwk}` (identidad dirigida, solo grants no interactivos) o string **`deprecated: true`** `[AS:639-660]`, `[AS:781-804]` | El spec va al revés: la forma objeto es la recomendada y la string está deprecada. Ojo: la guía oficial y nuestros scripts aún usan string → **es una prueba obligatoria** (T-8, §5): puede que Rafiki/Test Wallet solo acepte string hoy. Si es así, documentar la limitación del sandbox, no una regla del protocolo. |
| C3 | `[ENDPOINTS:143]` `expires_in: 900` y `[ENDPOINTS:297]` «viven ~15 min» | 900 s | El spec no fija el valor (`expires_in`: entero libre `[AS:629-631]`); todos sus ejemplos usan **3600** `[AS:74]`, `[AS:84]`, `[AS:284]`, `[AS:411]` | La duración la elige el ASE (Rafiki). Medir en el sandbox (T-3, §5) y no modelar «15 min» como constante: guardar `expires_in` y rotar con `token.rotate` (HU-06). |
| C4 | `[ENDPOINTS:211]` y `[ENDPOINTS:247]` «Respuesta: `201`» (grant request y continuación) | 201 | El spec devuelve **200** en `POST /` `[AS:33]` y **200** en `POST /continue/{id}` `[AS:263]`. (Solo `POST /outgoing-payments` y `POST /incoming-payments` devuelven 201) | Cambiar a `200`. En la práctica el SDK no falla por esto, pero confunde al probar a mano. |
| C5 | `[ENDPOINTS:203]` `actions: ["create","read","read-all","list"]` | 4 acciones | El enum del spec sí admite todas esas acciones `[AS:571-582]`, pero la guía oficial del grant futuro usa `['read','create']` (`[DOCS:partials/code/guides/outgoing-grant-future-payments/_grant-request-outgoing-payment.mdx:17]`) y el proyecto (HU-04/AD-09) también define `create` + `read` | No es error del spec: es divergencia interna. Pedir **`['create','read']`** (mínimo necesario para el tablero HU-15 y los pagos). `read-all`/`list` solo si se necesita listar pagos ajenos. |
| C6 | `[ENDPOINTS:3]`, §6 `[ENDPOINTS:272-286]` y §8 `[ENDPOINTS:303-311]` | Describe la colección `open-payments.postman_collection.json`, el environment, `prerequest.js` y `build.mjs`, y manda `newman run` | **Ninguno de esos archivos existe en el repo** (solo están `ENDPOINTS.md` y `script-incoming-payment-grant.ts`, que es un *pre-request* de **Bruno**, no de Postman: usa `bru.getEnvVar` y `req.setBody`, `script-incoming-payment-grant.ts:1,9,38`) | La §6 no es ejecutable tal cual. Opciones: (a) conseguir la colección original y subirla, o (b) reescribir §6 como guía de Bruno/HTTP. Decidir con el equipo. |
| C7 | §7 `[ENDPOINTS:290-299]` | Solo errores «típicos» del sandbox | El spec define códigos GNAP que no aparecen: `too_fast`, `invalid_continuation`, `invalid_rotation`, `request_denied`, `invalid_client`, `invalid_request` `[AS:881-958]` | Añadir la tabla GNAP (está en §3.9 de este documento) para no perder tiempo el viernes diagnosticando. |
| C8 | Paso 12 `[ENDPOINTS:235-239]` | El `interact_ref` se consigue llamando `finish` a mano con la cookie del Test Wallet | Ese atajo automatiza la interacción **saltándose el redirect del navegador**, que es justo donde el AS adjunta el `hash` del callback (HU-04) | El flujo manual sirve para pruebas, pero **no valida HU-04**. El producto debe recibir `GET /callback/:id?interact_ref=…&hash=…` y verificar el hash (§3.5). |

Confirmaciones (no correcciones): el paso 16 (`GET {{resource_server}}/outgoing-payment-grant`)
está bien ubicado en el RS `[RS:689-739]`; la advertencia de que `quote` no admite `list` es
correcta `[AS:604-613]`; la firma RFC 9421 y el prefijo `GNAP` son correctos.

---

## 3. Hallazgos técnicos con ejemplos

### 3.1 AD-10 confirmada: `outgoingPayment.create` tiene dos formas

Especificación: `[RS:762-765]` (`oneOf`), descripción explícita en `[RS:283]`:
*«Either provide a `quoteId` … or provide `incomingPayment` and `debitAmount` …»*.
SDK: `CreateOutgoingPaymentArgs` es la unión de ambos objetos `[SDK:types.ts:45-46]` +
tipos generados (`resource-server-types.ts`, operación `create-outgoing-payment`).

**Forma A — desde cotización** `[RS:259-265]`:

```json
{
  "walletAddress": "https://ilp.interledger-test.dev/alh/",
  "quoteId": "https://ilp.interledger-test.dev/quotes/ab03296b-0c8b-4776-b94e-7ee27d868d4d",
  "metadata": { "externalRef": "INV2022-02-0137" }
}
```

**Forma B — desde el pago entrante (la del cobro O4, sin cotización)** `[RS:266-275]`:

```json
{
  "walletAddress": "https://ilp.interledger-test.dev/alh/",
  "incomingPayment": "https://ilp.interledger-test.dev/incoming-payments/8d4e4776-2e55-4e5a-bcbe-8348ed1e86de",
  "debitAmount": { "value": "2500", "assetCode": "USD", "assetScale": 2 },
  "metadata": { "externalRef": "INV2022-02-0137" }
}
```

- `walletAddress` es obligatorio en ambas; no se pueden mezclar (`additionalProperties: false`
  en los dos esquemas, `[RS:788]` y `[RS:810]`).
- `debitAmount` debe usar el `assetCode`/`assetScale` de la wallet `[RS:281]`.
- Con la Forma B no aplica el problema de la cotización vencida (Guía, § Correcciones: «la
  cotización dura 5 min y la aprobación hasta 10» → Rafiki recotiza).

### 3.2 Payload del grant de pago saliente con tope y sin receptor (HU-04/AD-09/P-05)

Base: `[AS:136-159]` (ejemplo del spec) + guía oficial de pagos futuros
(`[DOCS:partials/code/guides/outgoing-grant-future-payments/_grant-request-outgoing-payment.mdx:7-39]`).

```json
POST {{auth_server}}
{
  "access_token": {
    "access": [
      {
        "type": "outgoing-payment",
        "actions": ["create", "read"],
        "identifier": "https://ilp.interledger-test.dev/alh",
        "limits": {
          "debitAmount": { "value": "5000", "assetCode": "USD", "assetScale": 2 }
        }
      }
    ]
  },
  "client": { "walletAddress": "https://ilp.interledger-test.dev/alh" },
  "interact": {
    "start": ["redirect"],
    "finish": {
      "method": "redirect",
      "uri": "https://APP_BASE_URL/callback/123",
      "nonce": "nonce-aleatorio-único-por-programa"
    }
  }
}
```

Detalles que confirma el spec:

- **`receiver` es opcional en `limits`**: `limits-outgoing-debit-amount` solo requiere
  `debitAmount` `[AS:813-825]`. El `receiver`, si va, debe ser una URL `…/incoming-payments/…`
  (patrón regex en `[AS:509-518]`).
- **`interact.finish.nonce` es obligatorio** si hay `finish` `[AS:711-714]`.
- **`access` admite máximo 3 ítems** `[AS:519-525]`.
- **Acciones válidas** para `outgoing-payment`: `create`, `read`, `read-all`, `list`, `list-all`
  `[AS:571-582]`; para `quote`: `create`, `read`, `read-all` (sin `list`) `[AS:604-613]`.
- **Respuesta** (pendiente, 200) `[AS:58-68]`:

```json
{
  "interact": {
    "redirect": "https://auth.interledger-test.dev/4CF492MLVMSW9MKMXKHQ",
    "finish": "4105340a-05eb-4290-8739-f9e2b463bfa7"
  },
  "continue": {
    "access_token": { "value": "33OMUKMKSKU80UPRY5NM" },
    "uri": "https://auth.interledger-test.dev/continue/4CF492MLVMSW9MKMXKHQ",
    "wait": 30
  }
}
```

> ⚠️ **Guardar las cuatro piezas para el hash:** `interact.finish.nonce` (la que generamos),
> `interact.finish` de la respuesta (el nonce del AS → `finish_nonce` en la tabla `programa`),
> `continue.uri` y la URL del grant. Campos `nonce`, `finish_nonce`, `grant_url` ya previstos en
> el modelo de datos `[HU:453]`.

### 3.3 P-05: un grant sin receptor paga a varias wallets (evidencia documental)

La guía oficial **Split payments** hace exactamente nuestro caso: pedir un solo grant con tope
total y **sin `receiver`**, y con ese token crear **dos pagos salientes hacia dos wallets
distintas** (merchant y plataforma):

1. Grant con `limits.debitAmount` combinado y **sin `receiver`**
   (`[DOCS:partials/code/guides/split-payments/_grant-request-outgoing-payment.mdx:9-39]`):

```ts
const pendingCustomerOutgoingPaymentGrant = await client.grant.request(
  { url: customerWalletAddress.authServer },
  {
    access_token: {
      access: [{
        identifier: customerWalletAddress.id,
        type: 'outgoing-payment',
        actions: ['create'],
        limits: {
          debitAmount: { assetCode: 'USD', assetScale: 2, value: '10000' } // 9900 + 100
        }
      }]
    },
    interact: { start: ['redirect'], finish: { method: 'redirect', uri: '…', nonce: NONCE } }
  }
)
```

2. Dos pagos salientes con el mismo token a receivers distintos
   (`[DOCS:partials/code/guides/split-payments/_create-outgoing-payments.mdx:8-28]`):

```ts
// Merchant
const toMerchant = await client.outgoingPayment.create(
  { url: customerWalletAddress.resourceServer, accessToken: grant.access_token.value },
  { walletAddress: customerWalletAddress.id, quoteId: merchantQuote.id }
)
// Platform
const toPlatform = await client.outgoingPayment.create(
  { url: customerWalletAddress.resourceServer, accessToken: grant.access_token.value },
  { walletAddress: customerWalletAddress.id, quoteId: platformQuote.id }
)
```

3. **SDK**: `receiver` es opcional en los límites `[SDK:types.ts:207-227]`
   (`AccessOutgoingBase.receiver?: …`).

**Conclusión:** spec + guías + SDK dicen que sí. Lo que falta es comprobarlo en la Test Wallet
(Rafiki) y medir el error al superar el tope → prueba **T-1/T-2** en §5.
Esto responde directamente la pregunta abierta de `[HU:628]`
(«¿Un grant de pago saliente sin receptor paga a varias wallets distintas?»).

### 3.4 P-07 / HU-07: verificación de propiedad con `subject.sub_ids`

Grant sin permisos de pago, solo `subject` (spec `[AS:187-200]`; guía oficial
`[DOCS:guides/verify-wallet-address-ownership.mdx]`):

```json
POST {{auth_server}}
{
  "subject": {
    "sub_ids": [
      { "id": "https://ilp.interledger-test.dev/beneficiario1", "format": "uri" }
    ]
  },
  "client": { "walletAddress": "https://ilp.interledger-test.dev/alh" },
  "interact": {
    "start": ["redirect"],
    "finish": {
      "method": "redirect",
      "uri": "https://APP_BASE_URL/cuentas/callback/456",
      "nonce": "nonce-verificación-cuenta"
    }
  }
}
```

- El esquema `grant-request-with-subject` exige `[client, interact, subject]`
  `[AS:764-780]` → **es interactivo obligatoriamente** (alguien debe aprobar en su wallet).
- `sub_ids`: **minItems 1, maxItems 1**, `format` solo puede ser `"uri"`, `id` + `format`
  obligatorios `[AS:959-984]`.
- La **respuesta de la continuación** (tras aprobar) devuelve el `subject` confirmado, sin
  `access_token` `[AS:303-313]`:

```json
{
  "subject": {
    "sub_ids": [{ "id": "https://ilp.interledger-test.dev/beneficiario1", "format": "uri" }]
  },
  "continue": {
    "access_token": { "value": "33OMUKMKSKU80UPRY5NM" },
    "uri": "https://auth.interledger-test.dev/continue/4CF492MLVMSW9MKMXKHQ",
    "wait": 30
  }
}
```

- **SDK 7.4.0 lo soporta**: `type Subject` `[SDK:types.ts:86]`, `GrantRequest` con `subject`
  requerido en su variante `[SDK:types.ts:107-112]`, y guards
  `isFinalizedGrantWithSubject` `[SDK:types.ts:159-161]`. En la práctica: si la continuación
  devuelve `subject`, la IdP verificó que el titular controla la wallet → HU-07 cumplida.

### 3.5 HU-04: verificación del hash del callback (y el gotcha del base64)

**Fórmula** `[HU:551]` (idéntica a la de los oficiales
`[DOCS:identity/hash-verification.mdx:15-31]`):

```
hash = base64( sha256( nonce + "\n" + finish_nonce + "\n" + interact_ref + "\n" + grant_url ) )
```

1. `nonce` → el que enviamos en `interact.finish.nonce`
2. `finish_nonce` → el campo `interact.finish` de la respuesta al grant request
3. `interact_ref` → el que llega en el callback
4. `grant_url` → la URL del endpoint del AS a la que hicimos el `POST /` inicial

Sin padding ni espacios en cada línea y sin salto final (solo `\n` entre componentes).

**Vector de prueba oficial** `[DOCS:identity/hash-verification.mdx:24-37]`:

```
Base (4 líneas):
VJLO6A4CATR0KRO
MBDOFXG4Y5CVJCX821LH
4IFWWIKYB2PQ6U56NL1
https://server.example.com/tx

Hash que publica la doc: x-gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY   (43 caracteres)
```

**Gotcha detectado (importante):** el texto de la doc dice «Base64 **sin padding**» y su ejemplo
usa `-` (alfabeto *base64url*, posición 62), pero el código JavaScript de la misma página usa
`digest('base64')`, que produce el alfabeto **estándar con `=` final**. Recalculado el vector:

```
sha256 + base64 estándar con padding:    x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY=   (44)
sha256 + base64 estándar sin padding:    x+gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY     (43)
sha256 + base64url sin padding (la doc): x-gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY     (43)
                                               ↑ un solo carácter difiere: '+' vs '-'
```

Es decir: **la doc es inconsistente consigo misma** (ejemplo en base64url, código en base64
estándar). El AS de Rafiki enviará una de las variantes y nosotros debemos comparar **de forma
tolerante**. Estrategia recomendada en el callback:

```ts
const crypto = require('crypto')
function hashCandidates(nonce: string, finishNonce: string, interactRef: string, grantUrl: string) {
  const base = `${nonce}\n${finishNonce}\n${interactRef}\n${grantUrl}`
  const raw = crypto.createHash('sha256').update(base).digest('base64') // estándar con '='
  return {
    estandarConPadding: raw,                                   // x+ggu…=
    estandarSinPadding: raw.replace(/=+$/, ''),                 // x+ggu…
    urlSafe: raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') // x-ggu…
  }
}
// Aceptar si el hash recibido coincide con cualquiera de los tres; luego fijar la variante
// que use el sandbox y dejar solo esa.
```

Cuando se fije la variante, dejar **un test de Vitest** que rechace un callback con hash alterado
(así lo exige RNF-01 `[HU:595]`).

### 3.6 P-13 / AD-20: cancelar el grant vs revocar el token

Resumen de endpoints del AS `[AS:12-17]`:

| Endpoint | Operación | Cuándo | Spec |
|---|---|---|---|
| `POST /continue/{id}` | Continuar grant (canjear `interact_ref`) | Durante/después de la interacción | `[AS:259-355]` |
| `DELETE /continue/{id}` | **Cancelar** un grant **pendiente** («Cancel a grant request or delete a grant client side»), `204` | Programa en Borrador/EsperandoAprobación: nadie aprobó o se abandonó | `[AS:358-379]` |
| `POST /token/{id}` | **Rotar** el access token (nuevo valor, `manage` nuevo), `200` | HU-06: antes de que venza `expires_in` | `[AS:390-449]` |
| `DELETE /token/{id}` | **Revocar** el access token, `204` | HU-17: cierre del programa ya activo | `[AS:452-455]` |

**Conclusión para HU-17 (P-13):** el cierre ocurre sobre un programa **ya aprobado**, que tiene
`access_token` + `manage_url` guardados en `programa` `[HU:451]` → corresponde
**`token.revoke` = `DELETE {{manage_url}}`** (igual que el paso 17 de `[ENDPOINTS:266-268]`).
`grant.cancel` (`DELETE /continue/{id}`) solo sirve para abortar una autorización que aún no se
completó (p. ej., el usuario nunca aprobó y queremos limpiar). **Queda la prueba T-7** para
confirmar que Rafiki deja el permiso inutilizable en ambos casos (checklist de Arquitectura
`[ARQ:368]`).

### 3.7 Continuación y rotación de token (payloads exactos)

**Canjear el `interact_ref`** — `POST {continue.uri}` con `Authorization: GNAP {continue_token}`
(request `[AS:346-354]`, respuesta `[AS:278-302]`):

```json
{ "interact_ref": "ad82597c-bbfa-4eb0-b72e-328e005b8689" }
```

```json
{
  "access_token": {
    "value": "OS9M2PMHKUR64TB8N6BW7OZB8CDFONP219RP1LT0",
    "manage": "https://auth.interledger-test.dev/token/dd17a202-9982-4ed9-ae31-564947fb6379",
    "expires_in": 3600,
    "access": [
      {
        "type": "outgoing-payment",
        "actions": ["create", "read"],
        "identifier": "https://ilp.interledger-test.dev/alice",
        "limits": { "debitAmount": { "value": "500", "assetCode": "USD", "assetScale": 2 } }
      }
    ]
  },
  "continue": {
    "access_token": { "value": "33OMUKMKSKU80UPRY5NM" },
    "uri": "https://auth.interledger-test.dev/continue/4CF492MLVMSW9MKMXKHQ",
    "wait": 30
  }
}
```

- Si se consulta la continuación **antes de que termine la interacción**, devuelve solo
  `continue` con `wait` `[AS:314-320]` → repetir respetando `wait` (si no, `too_fast`).
- Si se reintenta con un `interact_ref` ya canjeado → `invalid_continuation`/`invalid_request`
  `[AS:338-345]` (equivale al `401 invalid interact_ref` de `[ENDPOINTS:298]`).

**Rotar token (HU-06)** — `POST {manage_url}` con el token vigente; respuesta
`200 { "access_token": {…} }` `[AS:405-424]`; errores `invalid_rotation` `[AS:946-958]`.
Snippets oficiales: `snippets/node/token-rotate.ts` y `token-revoke.ts` (repo `open-payments`).

### 3.8 Consumo del grant (HU-15) — respuesta correcta

`GET {{resource_server}}/outgoing-payment-grant` con `Authorization: GNAP {token}` → `200`
`[RS:689-739]`. **Ojo:** devuelve `spentReceiveAmount`/`spentDebitAmount` (pueden ser `null`),
no `grantSpent*`:

```json
{
  "spentReceiveAmount": { "value": "2500", "assetCode": "USD", "assetScale": 2 },
  "spentDebitAmount":   { "value": "2600", "assetCode": "USD", "assetScale": 2 }
}
```

```json
{ "spentReceiveAmount": null, "spentDebitAmount": null }
```

SDK: `outgoingPayment.getGrantSpentAmounts({ url: resourceServer, accessToken })`
`[SDK:client/outgoing-payment.ts:30,91]` → es la llamada 28 de HU-15 `[HU:420]`.
Los pagos individuales también traen `grantSpentDebitAmount`/`grantSpentReceiveAmount`
`[RS:241-248]` → útiles para el tablero por cobro.

### 3.9 Errores GNAP (añadir a la §7 de `ENDPOINTS.md`)

Estructura de error del AS: `{ "error": { "code": "…", "description": "…" } }` `[AS:881-958]`.

| Código | HTTP | Cuándo aparece | Qué hacer |
|---|---|---|---|
| `invalid_client` | 400/401 | Firma RFC 9421 inválida, `client` inválido o sin `jwks.json` publicado | Revisar firma, `keyid`, que la wallet tenga `jwks.json` |
| `invalid_request` | 400/404 | Body malformado, grant request inválido | Revisar payload contra §3.2/§3.4 |
| `too_fast` | 400 | `POST /continue` antes de esperar `wait` segundos | Dormir `wait` y reintentar |
| `invalid_continuation` | 401/404 | `interact_ref` ya canjeado, continuación inexistente o token de continuación malo | Repetir desde la interacción |
| `invalid_rotation` | 400/404 | `POST /token/{id}` con token inválido o inexistente | Verificar `manage` y que no esté revocado |
| `request_denied` | 500 | El AS denegó internamente | Reintentar / revisar logs del AS |

Del lado del RS: `401` token ausente/inválido/expirado, `403` fuera de los permisos o del tope
(`[RS:252-255]` al crear pagos salientes → es el candidato del **InsufficientGrant** de P-05;
el mensaje concreto hay que medirlo: T-2).

### 3.10 Tipos del SDK 7.4.0 verificados (lo que faltaba confirmar)

| Tema | Verificado en | Resultado |
|---|---|---|
| Versión | `packages/open-payments/package.json` | `7.4.0` (coincide con la Guía) |
| `subject` | `types.ts:86,104,107-112,117,123` | Existe `Subject`, opcional en grants con `access_token` y requerido en la variante `with-subject` |
| `client` | `types.ts:87-91` | Unión `string \| {walletAddress} \| {jwk}` (el string sigue permitido) |
| Límites sin receptor | `types.ts:207-227` | `receiver?` opcional; `debitAmount`/`receiveAmount`/`interval` opcionales en su base |
| Formas de pago saliente | `types.ts:45-46` + tipos generados | Unión quoteId \| incomingPayment+debitAmount |
| Guard del grant | `types.ts:155-161` | `isFinalizedGrantWithAccessToken` / `isFinalizedGrantWithSubject` (el `isFinalizedGrant` genérico está `@deprecated`) |
| Tablero HU-15 | `client/outgoing-payment.ts:30,91` | `getGrantSpentAmounts` → `GET /outgoing-payment-grant` |
| Acciones | `types.ts:189-199` | `AccessAction.Create/Read/ReadAll/List/ListAll` |

---

## 4. Estado de `P-01…P-25` tras la investigación

| ID | Pendiente | Avance de investigación | Siguiente paso |
|---|---|---|---|
| P-01 | PIN: hash vs servicio simulado | Sin cambio (decisión de producto) | Elegir versión y corregir la fuente (Rol 1) |
| P-02 | Liquidación: servicio aparte o módulo | Sin cambio | Elegir y actualizar estructura (Rol 1) |
| P-03 | ¿Despliegue público desde el viernes o es extra 5? | Sin cambio | Decidir alcance (Rol 5) |
| P-04 | ¿Retiro parcial o siempre completo? | Sin cambio | Cerrar la pregunta (Rol 5) |
| P-05 | Grant sin receptor → varias wallets + InsufficientGrant | **Avanzado:** spec `[AS:813-825]`, guía *Split payments* (§3.3) y SDK dicen que sí | Prueba **T-1/T-2** en Test Wallet (Rol 1) |
| P-06 | Monedas Test Wallet y duración del token | **Parcial:** `expires_in` no fijado por spec; ejemplos 3600 vs sandbox 900 (C3) | Prueba **T-3**; usar `token.rotate` (Rol 1) |
| P-07 | Verificación de propiedad en Test Wallet | **Avanzado:** subject grant conforme a spec + SDK (§3.4) | Prueba **T-4**; si falla, plan B de Historias (Rol 1) |
| P-08 | Recuperar un cobro «Pagando» perdido | Sin cambio (requiere sandbox) | Prueba **T-6**: leer el pago entrante (`completed`) y reconsultar pagos salientes por metadata (Rol 1) |
| P-09 | ¿Qué dispara el pago en canal cuenta? | Sin cambio (vacío interno) | Definir contrato de `POST /cobros` (Rol 1) |
| P-10 | Contrato HTTP de la liquidación simulada | Sin cambio | Escribir el contrato antes del evento (Rol 1) |
| P-11 | Ruta del callback de verificación de cuentas | Sin cambio | Nombrarla en la tabla de la API; ojo: ya hay dos callbacks posibles (programa y cuenta) (Rol 1) |
| P-12 | Bloqueo 15 min por cédula | Sin cambio | Campo nuevo o derivado (Rol 1) |
| P-13 | ¿`grant.cancel` o `token.revoke` en el cierre? | **Resuelto por spec (§3.6):** cierre = `token.revoke` (`DELETE manage_url`); `grant.cancel` solo para pendientes | Prueba **T-7** para confirmar comportamiento en Rafiki (Rol 1) |
| P-14 | Proveedor DB (Supabase/Neon) y acceso | Sin cambio | Elegir por experiencia del equipo (Rol 1) |
| P-15 | Enrutamiento/estado/`EXTRA_*` en frontend | Sin cambio | Elegir por experiencia del equipo (Rol 1) |
| P-16 | Quién genera `idempotency_key` y textos de rechazo | Sin cambio | Fijarlo en el contrato de la API (Rol 1) |
| P-17 | Identidad visual y bocetos | Sin cambio | Bocetos 11 oct (Rol 5) |
| P-18 | Indicador «Pagando» >10 s | Sin cambio | Incluir en bocetos (Rol 5) |
| P-19 | Nombre comercial y logo | Sin cambio | Proponer opciones (Rol 5) |
| P-20 | Dónde vive la orquestación del cobro | Sin cambio | Nombrar módulo (`cobros/orquestacion.ts` vs `openPaymentsService.ts`) (Rol 1) |
| P-21 | Corresponsal vs giro postal (licencia MinTIC) | Sin cambio | Preguntar a mentores en el evento (Rol 5) |
| P-22 | Biometría exigida vs PIN del MVP | Sin cambio | Decir en el pitch que el PIN es simplificación (Rol 5) |
| P-23 | Exportar conciliación con estructura del anexo | Sin cambio | Decidir si entra como detalle (Rol 1) |
| P-24 | Términos del anexo 2026 («orden de no pago», «archivo de liquidación») | Sin cambio | Alinear textos de interfaz (Rol 5) |
| P-25 | Comisión del punto y rendimientos | Sin cambio | Preguntar a Puntored en el evento (Rol 5) |

---

## 5. Checklist de pruebas para la Test Wallet

**Prerrequisitos:** cuenta en `https://api-wallet.interledger-test.dev` (cookie `OP_TESTNET_COOKIE`),
una wallet address de prueba con saldo (`https://ilp.interledger-test.dev/…`), par Ed25519 con
`jwks.json` publicado en `{wallet}/jwks.json`, y un cliente HTTP con firma RFC 9421 (el script de
Bruno `script-incoming-payment-grant.ts` ya resuelve la firma para grants).

| # | Prueba | Pendiente que cierra | Pasos | Resultado esperado | Si falla |
|---|---|---|---|---|---|
| T-1 | Grant sin receptor paga a 2 wallets | P-05 | 1) `POST /` grant `outgoing-payment` sin `limits.receiver`, `debitAmount` = suma (§3.2). 2) Aprobar (pasos 9-13 de ENDPOINTS). 3) Crear 2 incoming payments en 2 wallets distintas. 4) 2× `POST /outgoing-payments` con `incomingPayment+debitAmount` (§3.1 B) usando el mismo token | Ambos `201`; `GET /outgoing-payment-grant` muestra el gasto acumulado | Si el 2.º pago es `403`: anotar mensaje exacto; replantear O4 (¿un grant por wallet?) |
| T-2 | Límite de gasto (`InsufficientGrant`) | P-05 | Repetir T-1 con `debitAmount` menor a lo que se intenta pagar | `403` del RS al exceder el tope, sin debitar de más | Anotar código/mensaje; validar comportamiento de `spentDebitAmount` |
| T-3 | Duración y monedas del token | P-06 | 1) Anotar `expires_in` real de la respuesta. 2) `POST /token/{id}` antes de vencer (rotar). 3) Usar el token nuevo. 4) Ver `assetCode`/`assetScale` de las wallets de prueba | `expires_in` observado (900 o 3600); rotación `200` con token nuevo; revocación `204` deja el viejo en `401` | Guardar hallazgo en Arquitectura (§ Checklist) |
| T-4 | Verificación de propiedad (`subject`) | P-07 | 1) `POST /` con `subject.sub_ids` (§3.4), sin `access_token`. 2) Aprobar en Test Wallet. 3) `POST /continue/{id}` | Continuación devuelve `subject` confirmado | Si el AS rechaza `subject` → activar plan B de Historias para HU-07 |
| T-5 | Hash del callback (HU-04) | RNF-01 / HU-04 | 1) Iniciar grant con `interact.finish.uri` = `APP_BASE_URL/callback/:id`. 2) Aprobar en navegador. 3) Capturar `interact_ref` y `hash` del callback. 4) Recalcular con las 3 variantes de §3.5 | Coincide exactamente con una de las variantes → dejar solo esa en el código y test de Vitest (hash alterado → rechaza) | Revisar orden de componentes y salto de línea final |
| T-6 | Recuperar cobro perdido en «Pagando» | P-08 | 1) Crear cobro, matar el proceso tras `outgoingPayment.create`. 2) `GET` del incoming payment del punto. 3) `GET /outgoing-payments` (list) o `outgoingPayment.get` guardando la URL antes | El incoming payment revela `completed`/`receivedAmount`; o el list por `walletAddress`+metadata encuentra el saliente | Definir reintento idempotente con `idempotency_key` (P-16) |
| T-7 | Cancelar vs revocar | P-13 / AD-20 | 1) Grant pendiente → `DELETE /continue/{id}` → `204`. 2) Grant activo → `DELETE {manage_url}` → `204`; probar pagos con el token | Revocado: cualquier `POST /outgoing-payments` → `401`. Pendiente cancelado: la continuación falla | Documentar cuál deja «inutilizable» el permiso (Arquitectura § Checklist) |
| T-8 | `client` objeto vs string | C2 | Enviar el mismo grant con `"client": "https://…"` y con `"client": {"walletAddress": "https://…"}` | Si acepta objeto → usar objeto (spec). Si solo string → anotar limitación del sandbox | Decidir con el equipo qué forma usa el SDK |
| T-9 | Errores GNAP | C7 | 1) `POST /continue` antes de `wait`. 2) Repetir `interact_ref` | `too_fast` y `invalid_continuation` respectivamente | — |

**Cadencia sugerida:** T-8 y T-3 son rápidas (van con el primer script de grants); T-1/T-2/T-4/T-6
son las **bloqueantes** y deben correr el 8 de octubre; T-5 se valida integrada en el
desarrollo de `GET /callback/:id`.

---

## 6. Anexo: repos relevantes de la org `interledger` (104 inventariados)

**Tier 1 — directos del proyecto**

| Repo | Relevancia |
|---|---|
| `open-payments-node` | SDK TS 7.4.0 que usaremos (tipos verificados en §3.10) |
| `rafiki` (359★) | ASE de referencia = lo que corre Test Wallet → valida P-05/P-07 de verdad |
| `testnet` (124★) | App de pruebas sobre Rafiki → credenciales/wallets para el E2E del viernes 16 |
| `open-payments-specifications` | Fuente de verdad (v1.4.0, ya analizado) |

**Tier 2 — referencias de implementación**

| Repo | Relevancia |
|---|---|
| `open-payments-playground` | App Express contra OP → patrón casi idéntico a nuestro `api/` |
| `open-payments-workshop` | Flujo E2E completo sencillo → plantilla del primer cobro |
| `open-payments-example`, `open-payments-snippets` | Clientes mínimos y snippets por operación |
| `openpayments.es` | Documentación oficial en español |
| `hackathon-backend-example` | Backend Express de ejemplo para hackathons |
| `hackathon-submission-template` | Plantilla del entregable |

**Tier 3 — ecosistema (menor prioridad):** `web-monetization-extension`, `interledger-pay`,
`paymentpointers.org`, `rfcs`, `xk6-open-payments` (load testing), SDKs en Python/Go/Rust/.NET/
Java/PHP, `httpbis-digest-headers`, `structured-headers` (firmas).

---

## 7. Preguntas abiertas para el equipo

La investigación **no puede resolver** esto; necesita decisión o información del evento:

**Rol 1 (arquitectura/contratos):**

1. **P-01** ¿PIN con hash o validado por el servicio simulado?
2. **P-02** ¿Liquidación como servicio aparte o módulo de la API?
3. **P-09** ¿Qué dispara el pago en canal cuenta (`POST /cobros` paga directo o hay confirmar sin PIN)?
4. **P-10** Contrato HTTP de la liquidación simulada (rutas, campos, errores) — escribirlo antes del evento.
5. **P-11** Nombre de la ruta del callback de verificación de cuentas (ya hay dos callbacks: programa y cuenta).
6. **P-12** ¿Dónde se guarda el bloqueo de 15 min de una cédula?
7. **P-14** Supabase o Neon, y acceso (`pg` o Drizzle).
8. **P-15** Enrutamiento y estado del frontend, lectura de `EXTRA_*`.
9. **P-16** Quién genera `idempotency_key` y dónde viven los textos de rechazo.
10. **P-20** Archivo/módulo de la orquestación del cobro.
11. **P-23** ¿Exportar conciliación con la estructura del anexo técnico 2026?
12. **C6** ¿Conseguimos la colección Postman original o reescribimos ENDPOINTS §6 para Bruno?
13. **Decisión de stack:** según la Guía, E2E en Express y frontend React+Vite; confirmar que
    `openPaymentsService.ts` y las 9 rutas se mantienen como está en AD (o re-priorizar).

**Rol 5 (producto/pitch):**

14. **P-03** ¿Despliegue público desde el viernes o es el extra 5?
15. **P-04** ¿El cajero digita el monto o el retiro es siempre completo?
16. **P-17/P-18/P-19** Identidad visual, bocetos (11 oct), indicador «Pagando», nombre y logo.
17. **P-21** ¿Corresponsal bancario o giro postal? (preguntar a mentores de Puntored/Interledger).
18. **P-22** Cómo presentar el PIN frente a la exigencia de biometría del anexo 2026.
19. **P-24** Alinear textos con términos del anexo («orden de no pago», «archivo de liquidación»).
20. **P-25** Comisión del punto por giro (preguntar a Puntored).

**Pruebas bloqueantes (Rol 1, antes del 16 oct):** T-1/T-2 (P-05), T-4 (P-07), T-5 (HU-04),
T-6 (P-08), T-7 (P-13). Detalle en §5.

# Open Payments — endpoints (sandbox)

```
AS  (auth)    = https://auth.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c
RS  (recurso) = https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c
WALLET        = https://ilp.interledger-test.dev/alh
WALLET API    = https://api-wallet.interledger-test.dev
```

Auth: firma RFC 9421 (la hace Postman) + `Authorization: GNAP <token>` (nunca `Bearer`).

## Pasos

| # | Qué hace | Método + ruta completa | Body | Devuelve |
|---|---|---|---|---|
| 1 | Descubre AS y RS | `GET https://ilp.interledger-test.dev/alh` | — | 200 + `authServer`, `resourceServer` |
| 2 | Grant de entrada | `POST https://auth.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c` | `{"access_token":{"access":[{"type":"incoming-payment","actions":["create","read","read-all","list","complete"]}]},"client":"https://ilp.interledger-test.dev/alh"}` | 200 → **token_incoming** |
| 3 | Crea pago entrante | `POST https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/incoming-payments` | `{"walletAddress":"https://ilp.interledger-test.dev/alh","incomingAmount":{"value":"1000","assetCode":"USD","assetScale":2}}` | 201 → **incoming_payment_url** |
| 4 | Lee el pago entrante | `GET <incoming_payment_url>` | — | 200 |
| 5 | Grant de quote | `POST https://auth.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c` | `{"access_token":{"access":[{"type":"quote","identifier":"https://ilp.interledger-test.dev/alh","actions":["create","read","read-all"]}]},"client":"https://ilp.interledger-test.dev/alh"}` | 200 → **token_quote** |
| 6 | Crea quote | `POST https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/quotes` | `{"walletAddress":"https://ilp.interledger-test.dev/alh","receiver":"<incoming_payment_url>","method":"ilp","debitAmount":{"value":"500","assetCode":"USD","assetScale":2}}` | 201 → **quote_url** |
| 7 | Lee el quote | `GET <quote_url>` | — | 200 |
| 8 | Grant de salida (interactivo) | `POST https://auth.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c` | `{"access_token":{"access":[{"type":"outgoing-payment","identifier":"https://ilp.interledger-test.dev/alh","actions":["create","read","read-all","list"],"limits":{"debitAmount":{"value":"5000","assetCode":"USD","assetScale":2}}}]},"client":"https://ilp.interledger-test.dev/alh","interact":{"start":["redirect"],"finish":{"method":"redirect","uri":"https://example.com/finish","nonce":"n-1"}}}` | 201 → **interact_url, continue_uri, continue_token** |
| 9 | Abre la interacción | `GET <interact_url>` (**no seguir** el redirect) | — | 302 → **interact_id, nonce, as_cookie** |
| 10 | Ve la petición | `GET https://api-wallet.interledger-test.dev/grant-interactions/<interact_id>/<nonce>` (Cookie wallet) | — | 200 |
| 11 | Usuario acepta | `PATCH https://api-wallet.interledger-test.dev/grant-interactions/<interact_id>/<nonce>` (Cookie wallet) | `{"response":"accept"}` | 200 |
| 12 | Finish | `GET <as_origin>/interact/<interact_id>/<nonce>/finish` (Cookie AS) | — | 302 → **interact_ref** |
| 13 | Canjea el grant | `POST <continue_uri>` | `{"interact_ref":"<interact_ref>"}` | 201 → **token_outgoing** |
| 14 | Ejecuta el pago | `POST https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments` | `{"walletAddress":"https://ilp.interledger-test.dev/alh","quoteId":"<quote_url>"}` | 201 → **outgoing_payment_url** |
| 15 | Lee el pago | `GET <outgoing_payment_url>` | — | 200 |
| 16 | Gasto del grant | `GET https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payment-grant` | — | 200 |
| 17 | Revoca el token | `DELETE <manage_url>` | — | 204 |

## Errores

- `401 invalid signature headers` → body con formato (debe ir en una línea/minificado) o firma mal construida.
- `400 body.client must be string` → `client` debe ser la URL de la wallet, no un objeto.
- `400 invalid quote` → el quote ya se usó.
- `403 Inactive Token` → token revocado/expirado.

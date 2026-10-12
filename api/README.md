# API del piloto (desechable)

API del [Piloto 1](../docs/piloto/README.md): Node 24, Express 5, el SDK de Open Payments 7.4.0 y
SQLite (`node:sqlite`, sin instalar nada). Vive en la rama `piloto` y **no se copia al repo del
evento**: la Guía descalifica el código escrito antes. Diseño:
[Plan backend](../docs/piloto/Plan%20backend.md) · avance: [Resultados](../docs/piloto/Resultados%20del%20piloto.md).

## Arrancar

Desde la raíz del repo:

```bash
npm install
```

Copia `api/.env.example` a `api/.env` y llena los secretos. `api/.env` está ignorado por git y la
llave privada va solo ahí.

| Para… | Comando |
|---|---|
| **Pagos reales entre el equipo:** BD limpia; se registran en la app, en «Equipo de prueba» | `npm run db:reset -w api` y luego `npm run dev` (raíz) |
| Ver pantallas sin Open Payments (token falso: nunca paga) | `npm run db:semilla:ui -w api` y luego `npm run dev -w api` |
| El guion de la demo con Ana, Luis, Jorge y Rosa (necesita las `DEMO_WALLET_*`) | `npm run db:reset:demo -w api` y luego `npm run dev -w api` |
| La API en el **3100**, cuando el frontend ya usa el 3000 | `npm run dev:3100 -w api` o `npm run start:3100 -w api` |
| API y web juntas (raíz) | `npm run dev` |
| La web contra la API del 3100 (PowerShell) | `$env:API_PROXY='http://localhost:3100'; npm run dev:web` |
| Fase 1: el primer cobro contra la Test Wallet | `npm run primer-cobro -w api -- --rotar --cancelar` |
| El guion de la demo, pasos 2 a 7, contra la API que está corriendo | `npm run guion -w api` (usa el 3100; `GUION_API` lo cambia) |
| Pruebas y tipos | `npm test -w api` · `npm run typecheck -w api` |
| Buscar llaves en lo que git vería (raíz) | `npm run check:secretos` |

`GET /api/salud` dice si la BD responde y si la llave coincide con el `jwks.json` de la wallet
cliente. En la web, la página **Estado de los pagos** (`/estado`, que lee `GET /api/estado`) dice si
los pagos son reales o simulados y qué falta. Conviene revisarla antes del primer pago.

### Pagos reales entre el equipo

1. Cada persona crea su cuenta en la [Test Wallet](https://wallet.interledger-test.dev) y una
   wallet en **COP**. Quien paga deposita saldo de prueba en la suya.
2. Quien maneja la API genera una llave de desarrollador para una de sus wallets, guarda la llave
   privada **fuera del repo** y llena `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID` y
   `OP_PRIVATE_KEY_PATH` en `api/.env`.
3. `npm run db:reset -w api` (con la API apagada: en Windows no se puede borrar la BD abierta) y
   `npm run dev` en la raíz.
4. En la web: «Equipo de prueba» → registrar a cada persona (cédula y wallet; el PIN es opcional y
   solo sirve para cobrar en un punto). Luego, como entidad, crear el programa con la wallet de
   quien paga y el monto por persona, y aprobarlo en su Test Wallet. Cada persona entra y cobra.

Quien se registra **después** de aprobar queda como novedad (RN-08): no entra en el tope y el
banco puede rechazar su cobro. Registren a todos antes de aprobar, o creen otro programa.

**El permiso dura lo que dure el programa:** el token de la Test Wallet vence a los 10 minutos, y la
API lo renueva sola al arrancar y cada 4 minutos (`TOKEN_RENOVAR_CADA_SEG`). Si estuvo apagada
tanto que el banco ya no acepta la renovación, el tablero muestra «Renovar permiso»: la entidad
aprueba una vez por lo que falta del tope y lo ya cobrado se conserva (D-35).

**HTTPS en Windows:** la API confía también en los certificados del sistema
(`src/certificados.ts`). En equipos con antivirus que inspecciona HTTPS, sin eso Node rechaza la
Test Wallet (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) y ninguna llamada sale (D-32).

## Variables que importan

| Variable | Para qué |
|---|---|
| `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID`, `OP_PRIVATE_KEY_BASE64` u `OP_PRIVATE_KEY_PATH` | El cliente de Open Payments. Sin ellas la API arranca, pero no paga |
| `DEMO_WALLET_PROGRAMA`, `DEMO_WALLET_ANA`, `DEMO_WALLET_LUIS`, `DEMO_WALLET_PUNTO` | Solo para el guion de la demo, en COP. `db:reset:demo` necesita la de Ana y la del punto; `db:reset` no usa ninguna |
| `LIQUIDACION_MONTO_BASE` | Monto por persona de los programas que no dicen otro (23000000 = $230.000). En la app, cada programa trae su propio «monto por persona» |
| `VERIFICACION_CUENTA` | `subject` (verifica en el banco) o `simulada` (plan B de HU-07) |
| `LIQUIDACION_SIMULAR_FALLA` | `true` hace que la liquidación responda 503 (HU-02) |

## Datos de prueba

Solo existen con `db:reset:demo` o `db:semilla:ui`; `db:reset` deja la BD vacía para el equipo.
Ojo: las wallets de la semilla «solo UI» (`…/ana`, `…/luis`) existen en la Test Wallet, pero son de
otras personas y no están en COP (D-33). Nunca les envíen dinero.

| Cédula | Persona | Monto | PIN | Papel |
|---|---|---|---|---|
| 900000001 | Ana | 1 × base | 1111 | Cobra a su cuenta, ya verificada |
| 900000002 | Luis | 1 × base | 2222 | Enlaza su cuenta; intenta después del cierre |
| 900000003 | Jorge | 1 × base | 3333 | Retira en el punto y luego intenta otra vez |
| 900000004 | Rosa | 2 × base (novedad) | 4444 | El banco la rechaza por tope |

## Estructura

Sigue el Plan backend § 1. Solo `src/openPaymentsService.ts` importa el SDK (AD-07). Todo el SQL
vive en `src/db/`, y la traducción del esquema está en `src/db/migraciones/`; `db/` de la raíz sigue
siendo la referencia en PostgreSQL. Las pruebas van junto al código (`*.test.ts`) y los dobles, en `test/`.

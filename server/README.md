# API del piloto (desechable) · rama `piloto-v2`

API del [Piloto 1](../docs/piloto/README.md): Node 24, Express 5, el SDK de Open Payments 7.4.0 y
**PostgreSQL con Drizzle**: Supabase, o PGlite (el mismo PostgreSQL dentro de Node) para probar sin
internet. Vive en la rama `piloto-v2` y **no se copia al repo del evento**: la Guía descalifica el
código escrito antes. La rama `piloto` conserva la versión con SQLite. **Está desplegada en Vercel**
junto con la web: <https://test-openpayment.vercel.app/api> ([abajo](#despliegue-en-vercel)). Diseño:
[Plan backend](../docs/piloto/Plan%20backend.md) · migración: [Plan Supabase y pnpm](../docs/piloto/Plan%20Supabase%20y%20pnpm.md) ·
avance: [Resultados](../docs/piloto/Resultados%20del%20piloto.md).

## Arrancar

Desde la raíz del repo, con pnpm 12.9.1:

```bash
pnpm install
```

Copia `.env.example` (raíz) a `.env` y llena los secretos. El `.env` está ignorado por git; la llave
privada va fuera del repo. La API lee el `.env` de la raíz y, si existe, también `server/.env`: manda
el de la raíz. El paquete se sigue llamando `api` (por eso `pnpm --filter api …`), aunque la carpeta
ahora es `server/`.

| Para… | Comando |
|---|---|
| **Pagos reales entre el equipo:** base limpia; se registran en la app, en «Equipo de prueba» | `pnpm --filter api db:reset` y luego `pnpm dev` (raíz) |
| Ver pantallas sin Open Payments (token falso: nunca paga) | `pnpm --filter api db:semilla:ui` y luego `pnpm --filter api dev` |
| El guion de la demo con Ana, Luis, Jorge y Rosa (necesita las `DEMO_WALLET_*`) | `pnpm --filter api db:reset:demo` y luego `pnpm --filter api dev` |
| La API en el **3100**, cuando el frontend ya usa el 3000 | `pnpm --filter api dev:3100` o `pnpm --filter api start:3100` |
| API y web juntas (raíz) | `pnpm dev` |
| La web contra la API del 3100 (PowerShell) | `$env:API_PROXY='http://localhost:3100'; pnpm dev:web` |
| Generar `src/db/schema.ts` desde las migraciones («primero la base», como la rama de Pablo) | `pnpm --filter api db:pull` (o `db:pull --postgres` para leer Supabase) |
| Fase 1: el primer cobro contra la Test Wallet | `pnpm --filter api primer-cobro --rotar --cancelar` |
| El guion de la demo, pasos 2 a 7, contra la API que está corriendo | `pnpm --filter api guion` (usa el 3100; `GUION_API` lo cambia) |
| Pruebas y tipos | `pnpm --filter api test` · `pnpm --filter api typecheck` |
| Buscar llaves en lo que git vería (raíz) | `pnpm check:secretos` |

`GET /api/salud` dice si la base responde (`bd.donde`: Supabase o PGlite, sin la contraseña) y si la
llave coincide con el `jwks.json` de la wallet cliente. En la web, la página **Estado de los pagos**
(`/estado`, que lee `GET /api/estado`) dice si los pagos son reales o simulados y qué falta.
Conviene revisarla antes del primer pago.

**Swagger:** `http://localhost:3000/api/docs` (o el 3100; también tras el proxy de la web, y en
Vercel en <https://test-openpayment.vercel.app/api/docs>) lista
las 52 rutas con sus campos y deja probarlas. El documento OpenAPI 3.1 está en `/api/openapi.json`
y se arma en `src/openapi.ts` con los mismos esquemas Zod de las rutas. Una ruta nueva va también
en `RUTAS` de ese archivo, si no `openapi.test.ts` falla. «Try it out» llama a la API de verdad:
con el `.env` lleno, los cobros mueven dinero de prueba.

### La base de datos

| `DATABASE_URL` | Qué es |
|---|---|
| `postgresql://…pooler.supabase.com:5432/postgres` | Supabase, modo «Session» (en local). En Vercel se usa el **6543** (modo «Transaction»), y la API apaga los *prepared statements* sola. Si la contraseña tiene `@`, `#`, `+`, `/`, `?`, `:` o `%`, van codificados (`%40`, `%23`, `%2B`…): la API avisa si la URL está mal armada, sin mostrarla (D-44) |
| `pglite:./data/pglite` (por defecto) | PostgreSQL local en `server/data/pglite`: sin internet ni cuenta, y separado de la base de Vercel. Una sola API a la vez: dos procesos no pueden abrir la misma carpeta |
| `file:…` (el de la rama `piloto`) | Se ignora con un aviso y se usa la base local |

- **Migraciones** (`src/db/migraciones/`, se aplican solas al arrancar): `001_esquema.sql` y
  `003_ajustes.sql` son copia exacta de `db/` de `main`; `010_piloto.sql` agrega lo que el piloto
  resolvió y el esquema original no tenía (D-03, D-35, D-38, D-39, D-41), y `020_gobierno.sql` crea el
  sistema del gobierno simulado.
- **Banco puente de Bre-B simulado** ([Plan Bre-B](../docs/piloto/Plan%20Bre-B.md)): `030_puente.sql` crea el esquema
  `piloto_puente`, donde cada llave Bre-B apunta a una wallet de la Test Wallet, y `031_llaves.sql` deja
  que la cuenta del beneficiario sea una llave. La API lo consulta por HTTP en `/api/puente`
  (`PUENTE_URL`; vacío, el simulador), nunca con SQL. «Equipo de prueba» registra las llaves.
- **Tatú guarda lo mínimo**: la cédula, la wallet, los programas y los cobros. El nombre, el PIN y el
  monto de cada persona viven en el esquema `piloto_gobierno`, y la API los pide por HTTP
  (`/api/liquidacion/*`), nunca con SQL.
- **La base de Supabase es la del equipo (la de Pablo)**: el piloto vive solo en los esquemas `piloto`,
  `piloto_gobierno` y `piloto_puente`, y nunca toca `public`, donde están las tablas de Pablo. `db:reset`
  borra y vuelve a crear solo esos tres esquemas. Corre con la API apagada.
- **Es la misma base que usa Vercel.** Con la `DATABASE_URL` de Supabase en tu `.env`, `db:reset`
  **borra los datos de producción**, y la API local y la de Vercel pueden rotar el mismo token a la
  vez: la que pierde marca el permiso como vencido (Arquitectura, § 3.6). Para programar, usa PGlite
  (sin `DATABASE_URL`).

### Pagos reales entre el equipo

1. Cada persona crea su cuenta en la [Test Wallet](https://wallet.interledger-test.dev) y una
   wallet en **COP**. Quien paga deposita saldo de prueba en la suya.
2. Quien maneja la API genera una llave de desarrollador para una de sus wallets, guarda la llave
   privada **fuera del repo** y llena `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID` y
   `OP_PRIVATE_KEY_PATH` en el `.env`, más la `DATABASE_URL` de Supabase.
3. `pnpm --filter api db:reset` (con la API apagada) y `pnpm dev` en la raíz.
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
(`src/certificados.ts`), lo que cubre también la conexión a Supabase. En equipos con antivirus que
inspecciona HTTPS, sin eso Node rechaza la Test Wallet (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) y ninguna
llamada sale (D-32).

## Despliegue en Vercel

La web y la API se despliegan juntas, en un solo dominio: <https://test-openpayment.vercel.app>.
Vercel publica cada push a su rama de producción (`produccion`); las demás ramas salen como
*preview*. Diseño completo y cuidados: [Arquitectura, § 3.6](../docs/Documento%20de%20Arquitectura%20—%20Hackathon%20Open%20Payments.md).

**Cómo se arma** (`vercel.json` → `pnpm run build:vercel`):

1. `pnpm --filter web build` deja la web en `web/dist`.
2. `scripts/build-vercel.mjs` escribe `.vercel/output` (Build Output API v3, ignorado por git):
   - `static/`: la web, con `index.html` para todas las rutas que no son `/api`.
   - `functions/api.func`: `src/vercel.ts` empaquetado con esbuild (Node 24, hasta 60 s por pedido),
     más las migraciones, los archivos de Swagger y los specs de Open Payments. PGlite no viaja.
3. `^/api` va a la función; lo demás, a los archivos estáticos.

**Qué hace distinto `src/vercel.ts`** (comparado con `src/main.ts`, que es la entrada en local):

| En local (`main.ts`) | En Vercel (`vercel.ts`) |
|---|---|
| Al arrancar: abre la base, migra y recupera los cobros en Pagando | Lo mismo, en el primer pedido de cada instancia. Si la base no responde: 503 `NoDisponible` |
| Renueva los tokens con un `setInterval` cada `TOKEN_RENOVAR_CADA_SEG` | Con los pedidos, como mucho una vez por intervalo, y solo la instancia que toma el candado de PostgreSQL |
| El pago sigue en el proceso | `waitUntil` mantiene viva la función hasta que el pago termina; las tareas de fondo se cortan a los 45 s |
| 5 conexiones a la base | 8 por instancia |

**Variables en el proyecto de Vercel** (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La del pooler de Supabase, **puerto 6543**. Obligatoria: en Vercel no hay PGlite |
| `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID` | Las del cliente Open Payments |
| `OP_PRIVATE_KEY_BASE64` | La llave privada en base64 (no hay disco para `OP_PRIVATE_KEY_PATH`) |
| `APP_BASE_URL`, `API_BASE_URL`, `LIQUIDACION_URL` | No hace falta ponerlas: salen del dominio del despliegue (`completarUrlsDeVercel` en `src/config.ts`) |
| Las demás (`TOKEN_RENOVAR_CADA_SEG`, `EXTRA_*`…) | Opcionales, con el mismo valor por defecto que en local |

Para revisar un despliegue: `GET /api/salud` (base y llave) y la página `/estado`. Los errores
quedan en los logs de la función en Vercel.

## Variables que importan

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Supabase o PGlite (arriba) |
| `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID`, `OP_PRIVATE_KEY_BASE64` u `OP_PRIVATE_KEY_PATH` | El cliente de Open Payments (en Vercel, la llave va en base64). Sin ellas la API arranca, pero no paga |
| `DEMO_WALLET_PROGRAMA`, `DEMO_WALLET_ANA`, `DEMO_WALLET_LUIS`, `DEMO_WALLET_PUNTO` | Solo para el guion de la demo, en COP. `db:reset:demo` necesita la de Ana y la del punto; `db:reset` no usa ninguna |
| `LIQUIDACION_MONTO_BASE` | Monto por persona de los programas que no dicen otro (23000000 = $230.000). En la app, cada programa trae su propio «monto por persona» |
| `VERIFICACION_CUENTA` | `subject` (verifica en el banco) o `simulada` (plan B de HU-07) |
| `LIQUIDACION_SIMULAR_FALLA` | `true` hace que la liquidación responda 503 (HU-02) |

## Datos de prueba

Solo existen con `db:reset:demo` o `db:semilla:ui`; `db:reset` deja la base vacía para el equipo. La
semilla «solo UI» usa wallets de ejemplo que no existen (`…/tatu-ejemplo-*`): las de
`db/002_datos_prueba.sql` (`…/ana`, `…/luis`) son de otras personas (D-33). Nunca les envíen dinero.

| Cédula | Persona | Monto | PIN | Papel |
|---|---|---|---|---|
| 900000001 | Ana | 1 × base | 1111 | Cobra a su cuenta, ya verificada |
| 900000002 | Luis | 1 × base | 2222 | Enlaza su cuenta; intenta después del cierre |
| 900000003 | Jorge | 1 × base | 3333 | Retira en el punto y luego intenta otra vez |
| 900000004 | Rosa | 2 × base (novedad) | 4444 | El banco la rechaza por tope |

## Estructura

Sigue el Plan backend § 1. Solo `src/openPaymentsService.ts` importa el SDK (AD-07). Todo el SQL
vive en `src/db/` y pasa por Drizzle: `schema.ts` se genera con `db:pull`, y los repositorios toman
solos la transacción en curso (`src/db/conexion.ts`). Las pruebas van junto al código (`*.test.ts`),
corren sobre PGlite en memoria con las migraciones de verdad, y los dobles están en `test/`.

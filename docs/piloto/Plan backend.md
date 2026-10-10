# Piloto 1: plan del backend

> Parte del [plan general](./README.md). API en Node 24 con Express, el SDK de Open Payments 7.4.0
> y SQLite (`node:sqlite`), siguiendo `Estructura del proyecto.md`, la API de la Guía, las
> Historias y `db/001_esquema.sql`.
>
> **Estado (10 de octubre de 2026): construido en la rama `piloto`, sin commits todavía.** Todo lo
> de este plan está en `api/` y pasa 120 pruebas con un Open Payments falso. Faltan las puertas que
> exigen la Test Wallet (Fase 1 y los pagos reales de las Fases 3 a 5). Los ajustes frente a este
> plan están en el § 14; la evidencia, en [Resultados del piloto](./Resultados%20del%20piloto.md).

---

## 1. Estructura de `api/`

Sigue el árbol de `Estructura del proyecto.md` § 2. Lo marcado «nuevo» no estaba en ese árbol y
sale de los hallazgos D-05 y D-21.

```text
api/
├── package.json · tsconfig.json
├── .env                         # local, ignorado por git: llave, wallets
├── .env.example                 # sin secretos
├── data/                        # tatu.db, ignorado por git
├── scripts/
│   └── primer-cobro.ts          # Fase 1: de punta a punta con el SDK contra la Test Wallet
└── src/
    ├── main.ts                  # arranca Express y hace la recuperación al arrancar (RNF-05)
    ├── app.ts                   # arma la app y monta los routers bajo /api (lo usan los tests)
    ├── config.ts                # variables validadas con Zod; carga la llave
    ├── openPaymentsService.ts   # ÚNICO archivo que importa el SDK (AD-07)
    ├── extras.ts                # GET /config: banderas EXTRA_* (RNF-10)
    ├── salud.ts                 # nuevo: GET /salud (BD, cliente OP, llave frente a jwks.json)
    ├── comun/
    │   ├── montos.ts            # texto ↔ unidades mínimas con assetScale (RN-11)
    │   ├── billeteras.ts        # $ilp… → https://… (HU-01)
    │   ├── errores.ts           # ErrorApi { codigo, mensaje, status }
    │   └── log.ts               # registro que nunca imprime secretos (RNF-09)
    ├── programas/
    │   ├── rutas.ts             # programas, autorizar, callback, tablero, pausar, cerrar
    │   ├── servicio.ts          # tope (RN-08), vencimiento de 10 min, cierre
    │   ├── estados.ts           # máquina del programa (5 estados)
    │   └── hash.ts              # verificación del callback (Hallazgos § 3.5); también para cuentas
    ├── cuentas/
    │   ├── rutas.ts             # POST /cuentas, GET /cuentas/callback/:id, GET /cuentas/:documento
    │   └── servicio.ts          # PIN y permiso con subject (HU-07), o plan B
    ├── cobros/
    │   ├── rutas.ts             # solo reciben y validan con Zod
    │   ├── orquestacion.ts      # P-20: liquidación → transición → pagar → guardar
    │   ├── estados.ts           # máquina pura del cobro (6 estados)
    │   ├── reglas.ts            # RN-01 a RN-07 y RN-12 como funciones puras
    │   └── mensajes.ts          # catálogo único de rechazos (HU-13)
    ├── puntos/rutas.ts          # nuevo: puntos, billeteras/resolver y cobros del punto
    ├── beneficiarios/rutas.ts   # nuevo: cédulas de prueba y resumen del beneficiario
    ├── liquidacion/
    │   ├── router.ts            # simulador bajo /api/liquidacion/* (P-02)
    │   ├── datos.ts             # cédulas, montos y PIN de prueba
    │   ├── contrato.ts          # tipos y Zod del contrato HTTP (P-10)
    │   └── cliente.ts           # lo que usa la API: HTTP contra LIQUIDACION_URL
    └── db/
        ├── conexion.ts          # DatabaseSync, PRAGMAs y transaccion()
        ├── migrar.ts            # aplica migraciones/*.sql en orden; reset y semillas
        ├── migraciones/
        │   ├── 001_esquema.sql        # traducción fiel de db/001_esquema.sql
        │   └── 002_ajustes_piloto.sql # D-03
        ├── semillas/
        │   ├── base.ts          # municipios, beneficiarios, punto y cuenta de Ana (wallets del .env)
        │   └── solo-ui.sql      # escenario de db/002_datos_prueba.sql, solo para pantallas
        └── repositorios/        # programas · puntos · beneficiarios · cuentas · cobros · eventos
```

`db/` de la raíz no se toca: sigue siendo la referencia en PostgreSQL. La traducción vive en
`api/src/db/migraciones/`, como dice `db/README.md` («pasa a ser `api/src/db/migraciones/001_init.sql`»).

---

## 2. Instalación y scripts

Primero se crea `api/package.json` con `"type": "module"` y `"engines": { "node": ">=24" }`, y
luego, desde la raíz (con `save-exact=true` en `.npmrc`):

```bash
npm install -w api --save-exact @interledger/open-payments@7.4.0 express@5.2.1 zod@4.6.5
npm install -w api --save-exact -D typescript@6.0.3 tsx@4.23.15 vitest@5.0.2 supertest@7.2.2 @types/node@24.19.0 @types/express@5.0.6 @types/supertest@7.2.1
```

SQLite no se instala: es el módulo `node:sqlite` de Node 24. Tampoco hace falta `dotenv`:
`process.loadEnvFile()` viene con Node.

| Script | Qué hace |
|---|---|
| `npm run dev -w api` | `tsx watch src/main.ts` en el puerto 3000 |
| `npm run dev:3100 -w api` · `npm run start:3100 -w api` | La misma API en el puerto 3100, cuando el frontend ya ocupa el 3000 (agregado en la ejecución) |
| `npm run primer-cobro -w api` | Fase 1: el script de punta a punta (§ 10) |
| `npm run guion -w api` | Pasos 2 a 7 del guion por HTTP contra la API que está corriendo (agregado en la ejecución) |
| `npm run db:reset -w api` | Borra `data/tatu.db`, aplica las migraciones y carga la semilla base |
| `npm run db:semilla:ui -w api` | Carga el escenario de `db/002_datos_prueba.sql` (token falso): solo para ver pantallas |
| `npm test -w api` | Vitest |
| `npm run typecheck -w api` | `tsc --noEmit` |

`tsconfig.json`: `strict`, `module` y `moduleResolution` en `NodeNext`, `target` `ES2023`,
`types: ["node"]`.

---

## 3. Configuración (`config.ts`)

- Lee `api/.env` con `process.loadEnvFile()` y valida todo con Zod al arrancar. Si falta algo,
  falla con la lista de variables, sin imprimir sus valores.
- **Llave:** `OP_PRIVATE_KEY_BASE64` (recomendada: sirve igual en local y en Vercel) o
  `OP_PRIVATE_KEY_PATH` (archivo fuera del repo, como dicen las Historias). Al arrancar se comprueba
  que sea Ed25519, y `GET /api/salud` compara su llave pública con el `jwks.json` de la wallet
  cliente. Así el error de un `keyId` que no corresponde aparece antes del primer 401.

`.env.example` (sin secretos; los valores reales van solo en `api/.env`):

```dotenv
PORT=3000
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000/api
LIQUIDACION_URL=http://localhost:3000/api/liquidacion
# file: también lo entiende @libsql/client, por si después se pasa a Turso (plan general § 11)
DATABASE_URL=file:./data/tatu.db

# Cliente Open Payments: solo backend
OP_CLIENT_WALLET_ADDRESS=
OP_KEY_ID=
# Una de las dos, nunca en el repo
OP_PRIVATE_KEY_BASE64=
OP_PRIVATE_KEY_PATH=

# Wallets de la demo (Test Wallet, en COP)
DEMO_WALLET_PROGRAMA=
DEMO_WALLET_ANA=
DEMO_WALLET_LUIS=
DEMO_WALLET_PUNTO=

# Reglas (Historias § Variables)
CONFIRMACION_TTL_SEG=120
PIN_MAX_INTENTOS=3
PIN_BLOQUEO_MIN=15
POLL_INTERVALO_MS=1000
APROBACION_TTL_MIN=10
# subject | simulada (plan B de HU-07)
VERIFICACION_CUENTA=subject
LIQUIDACION_SIMULAR_FALLA=false

# Extras (RNF-10)
EXTRA_BONO=false
EXTRA_QR=false
EXTRA_PDF417=false
EXTRA_CONTRATO=false
EXTRA_DEPLOY=false
QR_TTL_SEG=60
```

---

## 4. Base de datos (SQLite)

### 4.1 Cómo se traduce `db/001_esquema.sql`

Las tablas, columnas, restricciones, índices y triggers son los mismos. Cambia solo la forma de
escribirlos:

| PostgreSQL (`db/001_esquema.sql`) | SQLite (piloto) |
|---|---|
| `CREATE TYPE … AS ENUM` | `TEXT` con `CHECK (col IN (…))` y los mismos valores |
| `uuid DEFAULT gen_random_uuid()` | `TEXT PRIMARY KEY`; el id lo genera la API con `crypto.randomUUID()` |
| `timestamptz DEFAULT now()` | `TEXT` en ISO 8601 UTC, con `strftime('%Y-%m-%dT%H:%M:%fZ','now')` por defecto (se compara bien como texto) |
| `date` | `TEXT` con `CHECK (x = date(x))` |
| `bigint`, `int`, `smallint` | `INTEGER` (64 bits: alcanza para cualquier monto en unidades mínimas) |
| `boolean` | `INTEGER` con `CHECK (x IN (0, 1))` |
| `jsonb` | `TEXT` con `CHECK (json_valid(detalle))` |
| `bigserial` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `CHECK (x ~ 'regex')` | `GLOB`, `LIKE` y `length()` equivalentes (SQLite no trae expresiones regulares) |
| `SEQUENCE cobro_referencia_seq` y `lpad` | Tabla `secuencia`: la API hace `UPDATE secuencia … RETURNING valor` en la misma transacción del `INSERT` y arma `'SUB-' \|\| printf('%04d', valor)` |
| Triggers `plpgsql` con `RAISE EXCEPTION` | `CREATE TRIGGER … BEFORE … WHEN … BEGIN SELECT RAISE(ABORT, '…'); END`, con mensajes fijos |
| Trigger que asigna `NEW.version` y `actualizado_en` | SQLite no deja modificar `NEW`: la API los asigna en cada `UPDATE`, y un trigger rechaza todo cambio que no suba `version` en 1 |
| `IS DISTINCT FROM` | `IS NOT` |
| `TRUNCATE` | No existe en SQLite; el trigger de `DELETE` lo cubre |
| Índices únicos parciales, FK compuesta y `ON DELETE RESTRICT` | Iguales; las FK exigen `PRAGMA foreign_keys = ON` en cada conexión, porque SQLite no las revisa por defecto |
| Vista `beneficiario_con_edad` con `age()` | La misma vista, con la edad calculada con `strftime` |
| Tipos de columna | Tablas `STRICT`, para que los tipos se respeten como en PostgreSQL |

Ejemplo, la máquina de estados del cobro como trigger:

```sql
CREATE TRIGGER cobro_transicion BEFORE UPDATE OF estado ON cobro
WHEN NEW.estado IS NOT OLD.estado AND NOT (
     (OLD.estado = 'Solicitado'   AND NEW.estado IN ('PorConfirmar', 'Pagando', 'Rechazado'))
  OR (OLD.estado = 'PorConfirmar' AND NEW.estado IN ('Pagando', 'Rechazado'))
  OR (OLD.estado = 'Pagando'      AND NEW.estado IN ('Pagado', 'Fallido')))
BEGIN
  SELECT RAISE(ABORT, 'Transición de cobro no permitida');
END;

CREATE TRIGGER cobro_version BEFORE UPDATE ON cobro
WHEN NEW.version IS NOT OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'Cada cambio de un cobro debe subir version en 1');
END;
```

### 4.2 Desviaciones del esquema (las únicas)

1. **`secuencia`**: reemplaza a `cobro_referencia_seq`. No cambia el modelo.
2. **D-03**: `cuenta_beneficiario` gana `uri_continuacion` y `token_continuacion`, temporales y
   solo del backend; se ponen en `NULL` al terminar la verificación. Van en
   `002_ajustes_piloto.sql`, para que se vea qué se agregó.

D-04 no cambia el esquema: todo cobro lleva referencia, como dice la BD, y la pantalla muestra
«—» en los rechazados.

### 4.3 Conexión y transacciones

- `db/conexion.ts` abre `new DatabaseSync(ruta)` y fija `PRAGMA foreign_keys = ON`,
  `journal_mode = WAL` y `busy_timeout = 5000`.
- `transaccion(fn)` envuelve `BEGIN IMMEDIATE … COMMIT`, con `ROLLBACK` si hay error. Es síncrona,
  sin `await` adentro, así que ninguna otra petición se intercala a mitad de una escritura.
- Todo el SQL vive en `db/repositorios/`, con SQL directo (AD-06). Cambiar después a Turso o a
  PostgreSQL toca solo `api/src/db/`.
- Un cobro se actualiza siempre con
  `SET estado = ?, version = version + 1, actualizado_en = ? WHERE id = ? AND version = ?`. Si no
  cambió ninguna fila, otra petición ganó: es el bloqueo optimista de HU-14.

### 4.4 Migraciones y semillas

- `migrar.ts` aplica `migraciones/*.sql` en orden y anota en una tabla `migracion` las que ya
  corrieron.
- **Semilla base** (`semillas/base.ts`, porque las wallets salen del `.env`): los 3 municipios y las
  4 personas ficticias de `db/002_datos_prueba.sql`, el punto «Tienda Marta — corresponsal» con
  `DEMO_WALLET_PUNTO` y la cuenta de Ana ya Verificada con `DEMO_WALLET_ANA`. Luis queda sin
  cuenta, para probar HU-07 en serio. El programa **no** se siembra: se crea desde la app, que es
  lo que valida HU-01.
- **Semilla «solo UI»** (`semillas/solo-ui.sql`): el escenario completo de `db/002_datos_prueba.sql`,
  con un programa Activo con token falso y cobros ya pagados, para construir el tablero sin Open
  Payments. Nunca se usa para pagar.

---

## 5. Liquidación simulada (P-02 y P-10)

Es un módulo con router propio, montado en la misma API bajo `/api/liquidacion`. La API lo usa por
HTTP a través de `LIQUIDACION_URL`, como si fuera el sistema de la entidad (AD-12), así que podría
salir a otro proceso sin cambiar código.

### Contrato

| Método y ruta | Respuesta | Para qué |
|---|---|---|
| `GET /api/liquidacion/programas/:programaId/resumen` | `200 {"cedulas":3,"total":"69000000"}`, sin las novedades | HU-02 («Conectar liquidación de prueba») y el tope de RN-08 |
| `GET /api/liquidacion/programas/:programaId/pagos/:documento` | `200 {"documento":"900000003","disponible":true,"monto":"23000000","novedad":false}` o `404 {"disponible":false}` | RN-01 y RN-05 |
| `POST /api/liquidacion/pin/validar` con `{"documento","pin"}` | `200 {"valido":true}` o `200 {"valido":false}` | RN-07 y HU-07 |
| Cualquiera, con `LIQUIDACION_SIMULAR_FALLA=true` | `503` | HU-02: «No pudimos consultar tu pago; intenta en un momento» |

El simulador sirve el mismo conjunto para cualquier subsidio (D-13). No cuenta intentos de PIN:
eso lo lleva la API en `cobro.intentos_pin`.

### Datos de prueba

| Cédula | Persona | Monto | PIN de prueba | Novedad | Papel en el guion |
|---|---|---|---|---|---|
| 900000001 | Ana | $230.000 | 1111 | No | Paso 3: cobra a su cuenta, ya verificada |
| 900000002 | Luis («[Persona 2]») | $230.000 | 2222 | No | Enlaza su cuenta (HU-07) pero no cobra; en el paso 7 intenta después del cierre |
| 900000003 | Jorge | $230.000 | 3333 | No | Pasos 4 y 5: cobra en el punto y luego intenta otra vez |
| 900000004 | Rosa | $460.000 | 4444 | Sí: retroactivo cargado después de aprobar | Paso 6: el banco lo rechaza por tope |

Resumen: 3 cédulas y $690.000, porque la novedad de Rosa no cuenta para el tope. Con Ana y Jorge
pagados ($460.000), los $460.000 de Rosa superan el tope y el banco los rechaza; al cerrar, los
$230.000 de Luis nunca salieron (Historias § Fórmulas).

---

## 6. Adaptador `openPaymentsService.ts`

Es el único archivo que importa `@interledger/open-payments` (AD-07). Crea el cliente una sola vez
al arrancar: `createAuthenticatedClient({ walletAddressUrl, keyId, privateKey, logLevel: 'warn', requestTimeoutMs: 15000 })`.

| Función | Llamada del SDK | Servidor | Se usa en |
|---|---|---|---|
| `leerWallet(url)` | `walletAddress.get`, con caché de 5 minutos | Wallet address | O1, HU-03, HU-07 y pagos |
| `pedirPermisoPrograma` | `grant.request` de `outgoing-payment` con `actions: ['create','read']`, `identifier` = wallet del programa, `limits.debitAmount` = tope, sin `receiver` e `interact.finish` con nonce propio | Autorización del programa | O2 |
| `continuarPermiso` | `grant.continue` con `interact_ref`; exige `isFinalizedGrantWithAccessToken` | Autorización del programa | Callback de O2 |
| `cancelarPermisoPendiente` | `grant.cancel` | Autorización del programa | Cancelar la aprobación y su vencimiento (HU-05) |
| `rotarToken` | `token.rotate` | Autorización del programa | HU-06 |
| `revocarPermiso` | `token.revoke` | Autorización del programa | O8 |
| `pedirVerificacionCuenta` | `grant.request` con `subject.sub_ids` = wallet del beneficiario e `interact` | Autorización del beneficiario | O3 |
| `continuarVerificacion` | `grant.continue`; exige `isFinalizedGrantWithSubject` y que el `sub_id` sea la wallet enlazada | Autorización del beneficiario | Callback de O3 |
| `crearPagoEntrante` | `grant.request` de `incoming-payment` (no interactivo; `create` y `read`) e `incomingPayment.create` con `incomingAmount` y `metadata: { description, referencia }` | Destino: cuenta o punto | O4 y O5 |
| `crearPagoSaliente` | `outgoingPayment.create` con `incomingPayment` y `debitAmount`: la forma B, sin cotización (AD-10) | Recursos del programa | O4 y O5 |
| `leerPagoSaliente` · `leerPagoEntrante` | `outgoingPayment.get` · `incomingPayment.get` (con un permiso de lectura nuevo) | Programa · destino | O6 y recuperación |
| `gastadoDelPermiso` | `outgoingPayment.getGrantSpentAmounts` → `spentDebitAmount` | Recursos del programa | O7 y antes del cierre |
| `diagnosticoLlave` | Lee el `jwks.json` de la wallet cliente y lo compara con la llave pública | Wallet address | `GET /salud` |

### Cómo se traducen los errores

El SDK lanza `OpenPaymentsClientError` con `status`, `code` y `description`.

| Lo que llega | Se traduce a | Efecto en el cobro |
|---|---|---|
| 403 al crear el pago saliente (el candidato a `InsufficientGrant`; se confirma en V-02) | `TopeSuperado` | Fallido: «El banco rechazó el pago: el programa llegó a su tope» |
| 401 con el token del permiso | `TokenVencido` | `token.rotate` y un solo reintento; si falla, Fallido con `PermisoVencido` |
| Pago saliente con `failed: true` | `PagoFallido` | Fallido; si V-15 confirma que la causa son los fondos, `SinFondos` |
| Tiempo agotado o error de red | `SinRespuesta` | Sigue en Pagando y se reconcilia al consultar. Nunca Fallido por un timeout (`db/README.md` § Pendientes, punto 1) |
| Cualquier otro | `ErrorOpenPayments` | Se registran `status`, `code` y `description`, nunca tokens |

---

## 7. Contrato de la API (`/api`)

**Convenciones:**

- JSON en camelCase. Los montos van como texto en unidades mínimas, junto con
  `moneda: { codigo, escala }`, como en Open Payments.
- Errores: `{ "error": { "codigo": "…", "mensaje": "…" } }`, con 400 si la entrada es inválida, 404
  si no existe, 409 si la transición no está permitida o la versión cambió, y 422 si el PIN es
  incorrecto.
- **Un rechazo de negocio no es un error HTTP:** se devuelve el cobro en Rechazado con
  `motivo: { codigo, mensaje }`, y la pantalla lo muestra como un resultado, igual que los wireframes.
- Ninguna respuesta incluye `token_acceso`, `url_gestion`, `uri_continuacion`,
  `token_continuacion`, `nonce_*` ni `url_permiso` (V-20).

### Programas

| Método y ruta | Qué hace | Open Payments | Origen | Fase |
|---|---|---|---|---|
| `GET /api/programas` | Lista para el selector de rol y la entidad | — | Nueva | 3 |
| `POST /api/programas` | O1: crea el programa en Borrador, convierte `$` en `https://` y toma la moneda y la escala de la wallet. Si no resuelve: «No encontramos esa cuenta» (HU-01) | `walletAddress.get` | Guía | 3 |
| `GET /api/programas/:id` | Estado del programa; si lleva más de 10 minutos en EsperandoAprobacion, vuelve a Borrador (HU-05) | `grant.cancel` si vence | Nueva | 3 |
| `PATCH /api/programas/:id` | Editar mientras está en Borrador («Volver a editar», «Guardar borrador») | `walletAddress.get` si cambia la wallet | Nueva, opcional | 3 |
| `GET /api/programas/:id/liquidacion` | «Conectar liquidación de prueba»: cédulas y total (HU-02) | — | Nueva | 3 |
| `POST /api/programas/:id/autorizar` | O2: fija el tope (RN-08) y devuelve `{ redirect }` para aprobar en la Test Wallet | `grant.request` interactivo | Guía | 3 |
| `GET /api/callback/:id` | O2: con `result=grant_rejected` o `grant_invalid`, vuelve a Borrador; con hash válido, `grant.continue` y Activo. Responde con un 302 a la web | `grant.continue` | Guía | 3 |
| `POST /api/programas/:id/cancelar-aprobacion` | «Cancelar» mientras espera: vuelve a Borrador (D-09) | `grant.cancel` | Nueva | 3 |
| `GET /api/programas/:id/tablero` | O7: autorizado, cobrado, lo que no ha salido, cobros por canal, segundos de reembolso, cédulas sin cobrar y lista de cobros | `getGrantSpentAmounts` | Guía | 3 |
| `POST /api/programas/:id/pausar` · `/reanudar` | HU-18: Activo ⇄ Pausado | — | Nueva | 3 |
| `POST /api/programas/:id/cerrar` | O8: exige `{ "confirmacion": "CERRAR" }` y que no haya cobros en Pagando; guarda el gastado y revoca (D-18) | `getGrantSpentAmounts` y `token.revoke` | Guía | 3 |

### Puntos y billeteras

| Método y ruta | Qué hace | Open Payments | Origen | Fase |
|---|---|---|---|---|
| `GET /api/billeteras/resolver?direccion=` | «Cuenta encontrada» antes de guardar (wireframe 02): id, moneda y escala | `walletAddress.get` | Nueva | 3 |
| `GET /api/puntos` | Lista de puntos | — | Nueva | 3 |
| `POST /api/puntos` | HU-03: registra un punto; lo rechaza si su moneda no es la del programa | `walletAddress.get` | Nueva | 3 |
| `GET /api/puntos/:id/cobros?desde=hoy` | «Cobros de hoy» del punto | — | Nueva | 4 |

### Beneficiarios y cuentas

| Método y ruta | Qué hace | Open Payments | Origen | Fase |
|---|---|---|---|---|
| `GET /api/beneficiarios/demo` | Cédulas de prueba para el selector de rol: solo nombre y etiqueta | — | Nueva | 4 |
| `GET /api/beneficiarios/:documento/resumen` | HU-08: «Tienes $230.000», vigencia, estado de la cuenta y último cobro | — (consulta la liquidación) | Nueva | 4 |
| `POST /api/cuentas` | O3: `{ documento, billetera, pin }`; valida el PIN, pide el permiso con `subject` y devuelve `{ redirect }`; la cuenta queda PorVerificar | `walletAddress.get` y `grant.request` | Guía | 5 |
| `GET /api/cuentas/callback/:id` | O3: hash y `grant.continue`; la cuenta queda Verificada. 302 a la web | `grant.continue` | Estructura (P-11) | 5 |
| `GET /api/cuentas/:documento` | Estado de la cuenta, que la web consulta mientras el beneficiario aprueba | — | Nueva | 5 |

### Cobros

| Método y ruta | Qué hace | Open Payments | Origen | Fase |
|---|---|---|---|---|
| `POST /api/cobros` | O4 y O5: `{ programaId?, documento, canal, puntoId?, llaveIdempotencia }`; aplica RN-01 a RN-06. Retiro → PorConfirmar; cuenta → Pagando y paga (P-09) | Los pagos, solo en el canal cuenta | Guía | 4 |
| `POST /api/cobros/:id/confirmar` | O5: `{ pin }`; aplica RN-07 (intentos y bloqueo); PorConfirmar → Pagando, y paga | `incomingPayment.create` y `outgoingPayment.create` | Guía | 4 |
| `POST /api/cobros/:id/cancelar` | «Cancelar cobro»: PorConfirmar → Rechazado con `Cancelado` (D-09) | — | Nueva | 4 |
| `GET /api/cobros/:id` | O6: aplica RN-12 (vence a los 120 s) y RN-10 (consulta el pago); incluye la línea de tiempo | `outgoingPayment.get` | Guía | 4 |

### Otros

| Método y ruta | Qué hace | Origen | Fase |
|---|---|---|---|
| `GET /api/config` | Banderas `EXTRA_*`, `POLL_INTERVALO_MS` y `CONFIRMACION_TTL_SEG` | Estructura (RNF-10) | 2 |
| `GET /api/salud` | BD, cliente de Open Payments y si la llave coincide con el `jwks.json` | Nueva | 2 |
| `/api/liquidacion/*` | El simulador (§ 5) | Estructura (P-02) | 2 |

Ejemplo de un cobro tal como lo ve la web:

```json
{
  "id": "…",
  "referencia": "SUB-0002",
  "programa": { "id": "…", "nombre": "Subsidio adulto mayor (simulado)" },
  "canal": "retiro",
  "punto": { "id": "…", "nombre": "Tienda Marta — corresponsal", "billeteraCorta": "…/tatu-punto1" },
  "persona": { "nombre": "Jorge", "etiqueta": "C.C. de prueba 3" },
  "monto": "23000000",
  "moneda": { "codigo": "COP", "escala": 2 },
  "estado": "PorConfirmar",
  "motivo": null,
  "intentosRestantes": 3,
  "confirmarAntesDe": "2026-10-16T15:02:00.000Z",
  "eventos": [
    { "desde": null, "hacia": "Solicitado", "texto": "Tienda Marta digitó la cédula.", "creado": "…" }
  ]
}
```

---

## 8. Los flujos, paso a paso

### 8.1 Aprobar el programa (O2)

1. `POST /autorizar` con el programa en Borrador: el tope es el total de la liquidación (RN-08) y se
   guarda en `tope_total`.
2. Se genera un `nonce` con `crypto.randomUUID()` y se lee la wallet del programa.
3. `pedirPermisoPrograma`, con `interact.finish.uri = {API_BASE_URL}/callback/:id` (D-06). El
   permiso tiene que quedar pendiente (`isPendingGrant`).
4. Se guardan `nonce_cliente` (el nuestro), `nonce_cierre` (el `interact.finish` de la respuesta),
   `uri_continuacion`, `token_continuacion` y `url_permiso` (el `authServer`); el programa pasa a
   EsperandoAprobacion y se escribe su evento.
5. Se responde `{ redirect }` con `interact.redirect`, que no se guarda (Historias § Variables de
   Open Payments).
6. **Callback:** con `result=grant_rejected` o `grant_invalid`, vuelve a Borrador con su evento.
7. Con `hash` e `interact_ref`, `programas/hash.ts` calcula los 6 candidatos (base64 estándar con y
   sin `=`, base64url, y `grant_url` con y sin `/` final) y los compara con
   `crypto.timingSafeEqual`. Si ninguno coincide: evento, el programa no cambia y 302 con
   `resultado=invalido`. Después de V-05 se deja solo la variante que use la Test Wallet.
8. `continuarPermiso`: se guardan `token_acceso` y `url_gestion`, se borran los temporales y el
   programa pasa a Activo, con evento (el detalle lleva `expires_in`, nunca el token).
9. 302 a `{APP_BASE_URL}/entidad/programas/:id/aprobar?resultado=aprobado`. Si el callback llega
   repetido con el programa ya Activo, redirige igual sin cambiar nada (HU-04).

### 8.2 Solicitar un cobro (`POST /cobros`)

1. Zod valida la entrada. Si ya existe un cobro con esa `llaveIdempotencia`, se devuelve ese mismo
   cobro (HU-10, doble clic).
2. **Programa:** el indicado o, si no viene `programaId` (el punto no elige programa, D-21), el
   subsidio activo que tenga un pago disponible para esa cédula.
3. Se aplican, en orden: RN-06 (Activo y en vigencia), RN-03 (canal permitido por el destino), la
   persona en la tabla `beneficiario`, el bloqueo por PIN (D-17), RN-01 (la liquidación; si no
   responde, `LiquidacionNoResponde`), RN-04 (cuenta Verificada y en la misma moneda) y RN-05 (el
   monto lo calcula el backend). Cada rechazo deja un cobro Rechazado con su motivo, que aparece en
   el tablero. Una cédula que no existe no deja cobro: solo un evento del programa, con la cédula
   enmascarada.
4. **Una sola transacción síncrona:** referencia desde `secuencia`, `INSERT` en Solicitado con su
   evento y `UPDATE` a PorConfirmar (retiro) o a Pagando (cuenta) con su evento. Es la misma línea
   de tiempo del wireframe 05.
5. Si salta el índice único parcial (RN-02), se guarda un Rechazado con `YaCobrado` (si el otro
   cobro ya está pagado) o `EnProceso` (si sigue vivo).
6. En el canal cuenta se llama `pagar()` sin esperar y se responde con el cobro en Pagando.

### 8.3 Confirmar con PIN (`POST /cobros/:id/confirmar`)

1. Si el cobro ya pasó los 120 segundos (RN-12): Rechazado con `TiempoAgotado`.
2. El PIN se valida contra la liquidación. Si es incorrecto, sube `intentos_pin`; al tercero, el
   cobro queda Rechazado con `PinBloqueado`. Si no, responde 422 con «PIN incorrecto, te quedan N
   intentos» (HU-11).
3. Si es correcto, `UPDATE … WHERE version = ?` a Pagando, con su evento. **Este es el punto de no
   retorno** (HU-12). Si la versión ya cambió (doble confirmación), se devuelve el cobro como está
   y no se paga dos veces.
4. Se llama `pagar()` sin esperar y se responde 202 con el cobro en Pagando.

### 8.4 Pagar (`pagar(cobro)`)

1. Destino: la wallet de la cuenta o la del punto.
2. `crearPagoEntrante` y se guarda `url_pago_entrante` **antes** de crear el saliente: es lo que
   permite recuperar el cobro (§ 8.6).
3. `crearPagoSaliente` y se guarda `url_pago_saliente`.
4. Los errores siguen la tabla del § 6.

### 8.5 Consultar (`GET /cobros/:id`)

- PorConfirmar vencido → Rechazado con `TiempoAgotado` (RN-12).
- Pagando: como máximo una consulta a Open Payments por segundo y por cobro. Con `failed`, el cobro
  queda Fallido; con `sentAmount` igual a `debitAmount`, Pagado (RN-10). Si falta el saliente pero
  el entrante está `completed`, también Pagado. Se ajusta según V-10.
- Siempre devuelve el cobro con su línea de tiempo.

### 8.6 Recuperar al arrancar (RNF-05 y P-08)

Una sola pasada al iniciar la API, sobre los cobros en Pagando. No es un worker.

| Lo que hay guardado | Qué se hace |
|---|---|
| `url_pago_saliente` | Se consulta como en el § 8.5 |
| Solo `url_pago_entrante` | Se lee el pago entrante: si está completado, Pagado. Si no, queda en Pagando con un evento «requiere conciliación». V-06 prueba si reintentar el saliente contra **el mismo** pago entrante, que tiene monto fijo, es seguro |
| Nada | No se movió dinero: se vuelve a llamar `pagar()` |

### 8.7 Enlazar la cuenta (O3)

1. Zod valida `{ documento, billetera, pin }`, el PIN se valida contra la liquidación y se lee la
   wallet.
2. Una sola cuenta vigente por persona (índice `una_cuenta_vigente`): si había una PorVerificar,
   pasa a SinEnlazar.
3. Se inserta la cuenta en PorVerificar con sus nonces y la continuación (D-03), y su evento.
4. `pedirVerificacionCuenta` con `finish.uri = {API_BASE_URL}/cuentas/callback/:id` y se responde
   `{ redirect }`. Con `VERIFICACION_CUENTA=simulada` (plan B) queda Verificada de una vez, con un
   evento «verificación simulada».
5. **Callback:** el mismo `hash.ts`, con `grant_url` = el `authServer` de la wallet del
   beneficiario. `continuarVerificacion` y, si el `sub_id` coincide, Verificada con
   `verificada_en`, y se borran los temporales. Con rechazo o pasados 10 minutos, SinEnlazar (HU-07).

### 8.8 Tablero y cierre (O7 y O8)

- **Cobrado** es `spentDebitAmount` del permiso. Si la llamada falla, se suma lo Pagado en la BD y
  la respuesta lo marca con `fuente: "plataforma"`, para que la pantalla lo diga.
- **Reembolso al punto** es el promedio de t(Pagado) − t(PorConfirmar → Pagando) en los retiros,
  sacado de `evento`.
- **Sin cobrar todavía** son las cédulas de la liquidación menos los cobros pagados.
- **Cerrar:** exige Activo o Pausado, ningún cobro en Pagando y `confirmacion = "CERRAR"`. Lee el
  gastado, revoca con `token.revoke`, pasa a Cerrado, borra los tokens y guarda en el evento de
  cierre `{ autorizado, cobrado, nuncaSalio }` (D-18).

---

## 9. Reglas, estados y mensajes

- **`cobros/estados.ts`** repite la tabla del trigger del § 4.1 como función pura: es la doble
  defensa (función con tests y BD). El canal cuenta salta PorConfirmar.
- **Programa:** Borrador → EsperandoAprobacion → Activo ⇄ Pausado → Cerrado; de EsperandoAprobacion
  se vuelve a Borrador si se rechaza, vence o se cancela.
- **Cuenta:** SinEnlazar → PorVerificar → Verificada; de PorVerificar se vuelve a SinEnlazar.
- **`cobros/reglas.ts`:** RN-01 a RN-07, RN-11 y RN-12 como funciones sin red ni BD. RN-08 vive en
  `programas/servicio.ts`; RN-09 no se valida (lo hace el banco); RN-10 está en la orquestación.

### Catálogo de mensajes (`cobros/mensajes.ts`)

| Código (`motivo_rechazo`) | Mensaje | Estado | Fuente |
|---|---|---|---|
| `YaCobrado` | Este subsidio ya fue cobrado | Rechazado | HU-13 |
| `EnProceso` | Este subsidio ya está en proceso o fue cobrado | Rechazado | HU-14 (D-08) |
| `TopeSuperado` | El banco rechazó el pago: el programa llegó a su tope | Fallido | HU-13, RN-09 |
| `ProgramaCerrado` | El programa está cerrado y ya no recibe cobros | Rechazado | HU-13, HU-17 |
| `SinPagoDisponible` | Esta cédula no tiene pagos disponibles en este programa | Rechazado | HU-13 |
| `CuentaNoVerificada` | Primero enlaza y verifica tu cuenta | Rechazado | HU-09, HU-13 |
| `PinBloqueado` · `TiempoAgotado` | No pudimos confirmar tu identidad | Rechazado | HU-11, HU-13 |
| `ProgramaNoRecibe` | El programa no está recibiendo cobros | Rechazado | HU-13, HU-18 |
| `SinFondos` | El programa no tiene fondos en este momento | Fallido | HU-13 |
| `LiquidacionNoResponde` | No pudimos consultar tu pago; intenta en un momento | Rechazado | HU-02 |
| `PermisoVencido` | El permiso venció: apruébalo de nuevo | Fallido | HU-06 |
| `Cancelado` | El cobro se canceló. No se movió dinero | Rechazado | Nuevo (D-09) |

El PIN incorrecto no es un motivo: es la respuesta 422 «PIN incorrecto, te quedan N intentos».

---

## 10. Fase 1: `scripts/primer-cobro.ts`

Es el hito crítico de la Guía (HU-04 y HU-12 en un script) y responde las preguntas que pueden
cambiar el diseño **antes** de construir la API. Usa montos pequeños para no gastar el saldo de la
demo: `MONTO_PRUEBA` de $10.000 por defecto y un tope de dos pagos.

| # | Paso | Valida |
|---|---|---|
| 1 | Crea el cliente y compara la llave con el `jwks.json` | Llave y `keyId` |
| 2 | `walletAddress.get` del programa, Ana y el punto; imprime `assetCode` y `assetScale` | V-03 (moneda) |
| 3 | Levanta un receptor en `http://localhost:3001/callback` para capturar `interact_ref` y `hash` | — |
| 4 | Pide el permiso de pago saliente con tope y sin receptor, e imprime la URL de aprobación. **Hay que aprobar en la Test Wallet** | O2, V-08 |
| 5 | Al llegar el callback, calcula las 6 variantes del hash e imprime cuál coincide; luego `grant.continue` e imprime `expires_in` | V-05, V-03 |
| 6 | Pago 1 al punto: pago entrante de monto fijo y saliente con `debitAmount` igual; consulta cada segundo hasta 30 s ambos recursos | V-10, V-11, V-14, V-21 |
| 7 | Pago 2 a Ana con el mismo token | V-01 |
| 8 | Pago 3, que supera lo que queda del tope: imprime `status`, `code` y `description` exactos | V-02 |
| 9 | `getGrantSpentAmounts` | Datos del tablero (HU-15) |
| 10 | `token.rotate` y un uso del token nuevo (opcional) | V-03 |
| 11 | `token.revoke` y un intento de pago con el token revocado | V-07 |
| 12 | Opcional: un segundo permiso cancelado con `grant.cancel` y `continue` antes de `wait` | V-07, V-09 |
| 13 | Revisar a mano en la Test Wallet los saldos y la referencia visible | V-12, V-21 |

El script imprime una tabla de resultados y la guarda en `api/data/primer-cobro-<fecha>.json`
(ignorado por git), sin tokens, para copiarla a `Resultados del piloto.md`. Si el permiso sale
bien, la forma de `client` que manda el SDK es la que acepta la Test Wallet (V-08): no hace falta
probarla a mano.

---

## 11. Pruebas (Vitest)

Usan SQLite en memoria (`:memory:`), una liquidación falsa y `vi.mock` del adaptador de Open
Payments.

| Archivo | Qué prueba | Cubre |
|---|---|---|
| `cobros/estados.test.ts` | Tabla con todas las transiciones válidas e inválidas; el canal cuenta salta PorConfirmar | RNF-07 |
| `cobros/reglas.test.ts` | Al menos un caso por regla: RN-01 a RN-07, RN-11 y RN-12 | RNF-07 |
| `programas/hash.test.ts` | Vector oficial en sus 3 variantes; hash alterado → rechazado; `grant_url` con y sin `/` | RNF-01, HU-04, V-05 |
| `comun/montos.test.ts` | Texto ↔ unidades mínimas con escalas 0 y 2 y montos grandes, nunca con `float` | RN-11 |
| `db/esquema.test.ts` | Las protecciones de `db/README.md`: saltos de estado, `DELETE` de un cobro, `UPDATE` de un evento, índice parcial, FK compuesta, canal y punto, moneda fija… | V-16 |
| `cobros/carrera.test.ts` | 10 `POST /cobros` simultáneos con la misma cédula → 1 cobro vivo; doble confirmación → 1 pago | V-17, HU-14 |
| `programas/callback.test.ts` | Hash alterado → no activa y deja evento; callback repetido → no cambia nada; `grant_rejected` → Borrador | HU-04, HU-05 |
| `seguridad.test.ts` | Ninguna respuesta ni evento contiene tokens, nonces, llaves ni PIN | V-20 |

---

## 12. Seguridad

- **`.gitignore` en el primer commit:** `.env`, `.env.*` (menos `.env.example`), `*.key`, `*.pem`,
  `private.key`, `api/data/`, `*.db*`, `node_modules/`, `dist/` y `coverage/`.
- **`npm run check:secretos`** (en la raíz) busca en los archivos que git vería el encabezado de
  una llave PEM, tanto en texto como codificado en base64. El patrón se arma dentro del script,
  para que el script no se detecte a sí mismo. Se corre antes de cada commit.
- Las respuestas se arman con funciones que eligen los campos (lista blanca), y `seguridad.test.ts`
  lo comprueba.
- `evento.detalle` nunca guarda tokens, PIN, llaves ni datos personales; la cédula va enmascarada.
- El SDK registra con `logLevel: 'warn'`; nuestros registros solo imprimen `status`, `code` y
  `description` de los errores.
- En la BD local los tokens quedan en texto plano, como reconoce `db/README.md` § Pendientes
  (punto 3); por eso `api/data/` nunca se sube.
- Rotar la llave en la Test Wallet antes de que algún repo sea público.

---

## 13. Checklist por fase

Estado al 10 de octubre de 2026. ✅ hecho · ⏳ espera la Test Wallet · ⬜ pendiente.

**Fase 0: preparación**

- [x] Rama `piloto`, con `.gitignore` y `.npmrc` (`save-exact=true`, `engine-strict=true`). ⬜ El
      primer commit todavía no se hace.
- [x] `package.json` raíz con workspaces `api` y `web`, `engines.node >= 24` y `concurrently`
      (lo agregó el frontend).
- [x] `api/package.json`, `tsconfig.json`, instalación (§ 2), `.env.example` y `.env` local sin secretos.
- [x] `docs/piloto/Resultados del piloto.md` con las tablas V-xx y D-xx.
- **Hecho cuando:** ✅ `npm install` termina sin errores, `check:secretos` da 0 y `typecheck` pasa.

**Fase 1: primer cobro**

- [x] `scripts/primer-cobro.ts` (§ 10). ⏳ Falta ejecutarlo con una aprobación real.
- **Hecho cuando:** ⏳ hay un pago real completo y quedan registradas V-01, V-02, V-03, V-05, V-07,
  V-08, V-10, V-11, V-12 y V-21.

**Fase 2: base**

- [x] `config.ts`, `db/` (conexión, migraciones y semillas), `liquidacion/`, `comun/`,
      `cobros/estados.ts`, `reglas.ts` y `mensajes.ts`, `/config` y `/salud`.
- **Hecho cuando:** ✅ pasan los tests de estados, reglas, hash, montos y esquema (V-16).
  `db:semilla:ui` funciona; ⏳ `db:reset` necesita `DEMO_WALLET_PUNTO` y `DEMO_WALLET_ANA`.

**Fase 3: programa**

- [x] Rutas de programas, puntos y billeteras: O1, O2, O7 y O8, más HU-05 y HU-18.
- **Hecho cuando:** ⏳ un programa creado por la API pasa a Activo con un callback real, el tablero
  lee el gastado del permiso y V-13 queda registrada (`npm run guion -w api`, paso 2).

**Fase 4: cobros**

- [x] `POST /cobros`, confirmar, cancelar, `GET /cobros/:id`, `pagar()` y la recuperación al arrancar.
- **Hecho cuando:** ✅ pasa el test de carrera (V-17). ⏳ Un retiro en el punto y un cobro a la cuenta
  terminan en Pagado contra la Test Wallet (`npm run guion -w api`, pasos 3 y 4).

**Fase 5: cuentas**

- [x] `POST /cuentas`, su callback, `GET /cuentas/:documento` y el plan B.
- **Hecho cuando:** ⏳ la cuenta de Luis queda Verificada y V-04 queda registrada. El plan B
  (`VERIFICACION_CUENTA=simulada`) ya está probado.

**Fase 8: junto con el frontend**

- [ ] V-06: ✅ con dobles (`recuperacion.test.ts`); ⏳ con un cobro real en Pagando.
- [ ] V-14: ⏳ (el guion mide del PIN a Pagado).
- [ ] V-18: ⚠️ la web corre contra la API con la semilla «solo UI»; ⏳ con pagos reales.
- [ ] V-20: ⚠️ en verde con dobles (`seguridad.test.ts`); ⏳ revisar los logs con la Test Wallet.

---

## 14. Ajustes frente a este plan (hechos en la ejecución)

| Tema | Plan | Cómo quedó | Por qué |
|---|---|---|---|
| Formas JSON del § 7 | Solo nombraba algunos campos | Programa, tablero, cobro, cuenta y resumen usan las formas de `web/src/api/tipos.ts`: `billetera` en lugar de `billeteraPrograma`, vigencias `YYYY-MM-DD` (día completo en Bogotá), tablero con `noHaSalido`, `porCanal`, `sinCobrar {cedulas, monto}`, `cierre` y `fuente: "banco"` o `"plataforma"` | La web ya estaba construida contra esas formas (D-28) |
| `GET /cuentas/:documento` | Estado de la cuenta | Devuelve la cuenta, o 404 si nunca enlazó una | Lo que espera la web |
| Motivo `ErrorPago` | No existía | Fallido por una respuesta definitiva del banco que no es el tope | D-24 |
| Solo pago entrante en Pagando | Pagado si el entrante está completado | Queda en Pagando con un evento «requiere conciliación» | La BD exige `url_pago_saliente` para Pagado (D-23) |
| Canal cuenta sin ninguna cuenta | Rechazado con `CuentaNoVerificada` | 409 `CuentaNoVerificada`, sin cobro | `canal_y_cuenta` no deja guardarlo (D-25) |
| Cédula desconocida | «No deja cobro» | 404 `SinPagoDisponible` | D-26 |
| Validación de ids | `z.uuid()` | `z.guid()` | Los ids de la semilla no son UUID v4 (D-27) |
| RN-02 | Se arbitra en la transacción | Además hay un aviso temprano antes de ir a la red | Que «ya fue cobrado» no dependa de leer la wallet |
| Montos de la liquidación | Fijos | `LIQUIDACION_MONTO_BASE` (por defecto 23000000) | Plan B del plan general § 10, por si falta saldo |
| Puerto | 3000 | También 3100 (`config/puerto-3100.env`) | Para correr junto a la instancia del frontend |
| Script del guion | No estaba | `scripts/guion.ts` recorre los pasos 2 a 7 por HTTP | Que las Fases 3, 4 y 8 se corran con un comando |

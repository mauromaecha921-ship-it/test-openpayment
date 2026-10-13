# Piloto v2: plan para montar el piloto en Supabase y pnpm

> Parte del [plan general](./README.md). **Estado (12 de octubre de 2026): fases 0 a 4 hechas en la rama
> `piloto-v2`** (pnpm, PostgreSQL con Drizzle, esquema de `main` y gobierno simulado; 169 pruebas de la
> API y 20 de la web en verde). La base vive en el Supabase del equipo, en los esquemas `piloto` y
> `piloto_gobierno`, sin tocar `public` de Pablo (§ 2), y quedó limpia. **Falta la fase 5**: pagos
> reales con el equipo registrado y la aprobación en la Test Wallet.
> El equipo decidió que el proyecto del evento usa **Supabase (PostgreSQL), Drizzle y pnpm**, como la
> rama de Pablo (`feature/HU-1-programa-support`, en `D:\PREPARACION-RAMA PABLO`). El piloto va más
> adelante en funcionalidad (todo el flujo con pagos reales), pero corre sobre SQLite y npm. Este plan
> monta **lo que el piloto hace hoy** sobre el stack del equipo, sin perder nada de lo que funciona, y
> trae de la rama de Pablo lo que conviene. Sale de revisar los 70 archivos de `api/` y los scripts.

---

## 1. La rama: `piloto-v2`

**Sí, conviene una rama nueva.** `piloto-v2` sale de `piloto` en el commit `0c60ad4` (el del Swagger).

| Rama | Qué queda ahí |
|---|---|
| `piloto` | El piloto como está hoy: SQLite y npm, **probado con pagos reales**. No se toca: sirve de referencia para comparar y de respaldo si algo de v2 falla |
| `piloto-v2` | El mismo piloto sobre Supabase, Drizzle y pnpm, con el esquema de `main` y la separación de datos del § 3 |

Las dos son desechables y **ninguna se mezcla a `main`** (la Guía descalifica el código escrito antes
del evento). A `docs/` de `main` solo vuelven los aprendizajes. Git no acepta espacios en el nombre:
`piloto-v2`, no «piloto v2».

**Ya está hecho:** el Swagger quedó en `0c60ad4` y pnpm 12.9.1 está instalado en este PC.

**Ojo al publicar:** en GitHub, `piloto-v2` se creó desde `main` (commit `00226ec`), no desde `piloto`.
La rama local salió de `piloto`, como se pidió, y trae `db/` de `main`. Para subirla **sin forzar**, se
une `origin/piloto-v2` a la local antes del push: los únicos conflictos son `README.md`,
`docs/README.md` y `docs/Resumen para el equipo.md`, y se deja la versión del piloto, que es la más
nueva. Así la rama queda con lo del piloto y con lo de `main`.

---

## 2. La conexión a Supabase

La cadena de conexión que se compartió el 12 de octubre **no se escribe en ningún documento ni en el
repo**: va solo en el `.env` de la raíz, que está ignorado por git. Tres cosas sobre ella:

1. **Hay que codificar la contraseña.** Tiene `@`, `#` y `+`, que en una URL significan otra cosa: la
   URL tal cual no se puede leer. Dentro de la contraseña van como `%40`, `%23` y `%2B` (el `.` se
   queda igual). Se comprueba en la fase 1 sin imprimir la URL.
2. **Se compartió por chat:** cambiar la contraseña en Supabase (Project Settings → Database) cuando
   termine la migración, como con la llave de la Test Wallet.
3. **Es el pooler en modo «Session»** (puerto 5432 de `pooler.supabase.com`). Sirve: deja usar
   transacciones normales. Se usa `prepare: false`, como en la rama de Pablo, para que el mismo código
   funcione también con el modo «Transaction» (puerto 6543).

**¿De quién es ese proyecto?** **Decidido el 12 de octubre: es el de Pablo (el del equipo).** Por eso el
piloto **nunca usa `public`**, donde están las tablas de Pablo con los mismos nombres: vive en dos
esquemas propios, `piloto` y `piloto_gobierno`, igual en Supabase que en PGlite. Drizzle escribe el
esquema en cada consulta; las migraciones de `main` (que no lo dicen) corren con `search_path`, y las
funciones de los triggers quedan con su `search_path` fijo para que nunca lean una tabla de `public`
(una prueba lo comprueba con una tabla señuelo). `db:reset` borra solo esos dos esquemas.

**Distancia:** el proyecto está en `us-east-1` (Estados Unidos). Cada consulta va y vuelve por
internet (unos 75 ms desde Medellín), así que el código tiene que hacer pocas consultas por pantalla (§ 5.4).

---

## 3. Qué datos guarda cada sistema (decidido por el equipo, 12 de octubre)

**Principio: Tatú guarda lo mínimo necesario para pagar y auditar.** Lo que identifica a las personas
y lo que dice quién tiene derecho a qué es del **gobierno**: nos lo pasa por un endpoint y nosotros
solo lo leemos (AD-12, RNF-06).

| Dato | Dueño | En el piloto v2 |
|---|---|---|
| Beneficiarios de cada subsidio: cédula, nombre, cuánto recibe | Gobierno (la liquidación) | Simulador del gobierno, en el esquema `gobierno`. Tatú lo lee por HTTP (`LIQUIDACION_URL`) |
| Huella (en el MVP, el PIN) | Gobierno; en producción la valida un operador autorizado por la Registraduría | El PIN vive en el simulador del gobierno, con hash, como hoy. Tatú nunca lo guarda |
| Puntos de pago y comercios autorizados | Gobierno | Etapa 2 (§ 4): viven en el simulador del gobierno y Tatú guarda solo la referencia para pagar y auditar (id, nombre comercial, wallet y tipo). Son negocios, no datos personales |
| Programa, permiso con tope, cobros y eventos | Tatú | Esquema `public`, el de `main` |
| Persona en Tatú | Tatú | Solo tipo y número de documento (`beneficiario` de `main`), para atar los cobros y el bloqueo por PIN |
| Wallet de la persona y si está verificada | Tatú | `cuenta_beneficiario`: la wallet, el estado y la fecha |

**«Equipo de prueba» hace el papel del gobierno:** registrar una persona (y, en la etapa 2, un punto
o un comercio) escribe en el simulador del gobierno, no en las tablas de Tatú.

**Verificar a quien recibe en su wallet (producción, no el hackathon).** En el hackathon no hay login:
la wallet la registra el equipo y se da por verificada. En producción la persona entra como en un
banco: cédula, dirección, foto del documento y foto de la cara. Propuesta para que siga siendo «lo
mínimo»: **un proveedor de verificación de identidad (o la Registraduría) procesa las fotos y Tatú
guarda solo el resultado**: verificada sí o no, la fecha y la referencia del proveedor. Guardar las
fotos contradice la Guía (§ Seguridad mínima) y RNF-06, y en Colombia son datos sensibles (Ley 1581
de 2012). Decisión del equipo; hallazgo **D-40**. En el piloto no se construye nada de esto.

---

## 4. Dos etapas

| Etapa | Qué | Por qué separarlas |
|---|---|---|
| **1 · Lo mismo, en Supabase** | El piloto de hoy sobre PostgreSQL, Drizzle y pnpm, con el esquema de `main`. Las personas (nombre, PIN, monto) pasan al simulador del gobierno, **porque el `beneficiario` de `main` ya no tiene nombre**: no hay otra forma | Es el cambio grande (§ 5). Al terminar, la app hace exactamente lo que hacía, con pagos reales |
| **2 · Puntos y comercios al gobierno** | Los puntos autorizados y los comercios (NIT, actividad, verificación) pasan al simulador; Tatú los lee y guarda su referencia | Cambia cómo se registran puntos y comercios. Se hace solo si la etapa 1 pasó su puerta |

---

## 5. Lo que encontró la revisión del código (etapa 1)

### 5.1 De síncrono a asíncrono (es el grueso del trabajo)

Hoy toda la base es **síncrona** (`node:sqlite`) y `transaccion()` prohíbe `await` adentro, para que
ninguna petición se cuele a mitad de una escritura (Plan backend § 4.3). Con PostgreSQL todo es
asíncrono:

| Qué | Dónde | Cambio |
|---|---|---|
| `uno()`, `varios()`, `ejecutar()` | 8 repositorios y 4 archivos fuera de `db/`: `liquidacion/datos.ts`, `programas/renovacion.ts`, `salud.ts`, `scripts/mantener-permiso.ts` | Repositorios en Drizzle y `async`. Fuera de `db/` no queda SQL: lo de esos 4 archivos pasa a funciones de repositorio |
| `transaccion(() => …)` | 15 lugares: `programas/servicio.ts` (7), `cuentas/servicio.ts` (3), `cobros/orquestacion.ts` (2), `beneficiarios/servicio.ts`, `comercios/rutas.ts` y la semilla | `db.transaction(async (tx) => …)`; los repositorios reciben `tx`. Sigue la regla de siempre: guardar Pagando **antes** de llamar a Open Payments, y **nunca** llamar a Open Payments ni a la liquidación dentro de una transacción |
| Transacción dentro de otra (`isTransaction`) | `conexion.ts` | Se pasa `tx` en lugar de detectar si hay una abierta |
| Vistas que consultan la BD | `comun/vistas.ts` (`vistaCobro`, `vistaPrograma`, `vistaPunto`, `vistaCuenta`…) | Pasan a `async`, y con ellas todas las rutas que las usan |
| Pruebas | 158 en 24 archivos, `test/ayuda.ts` y `test/falsos.ts` | Todo `async`. Las reglas y lo que se comprueba no cambian |

### 5.2 Lo que es propio de SQLite

| En el piloto | Problema en PostgreSQL | Arreglo |
|---|---|---|
| `ORDER BY rowid` en `programas.listar`, `cuentas.ultimaDe` y los listados de cobros | PostgreSQL no tiene `rowid` | Ordenar por `creado_en`. **`programa` y `cuenta_beneficiario` de `main` no tienen `creado_en`**: se agrega en `010_piloto.sql` (**D-41**) |
| Fechas en texto ISO, comparadas como texto (`creado_en > desde`, `desde ?? '0000'`, `fechaBogota`) | postgres-js devuelve `Date` | Los repositorios devuelven texto ISO (`toISOString()`), así el resto del código no cambia |
| `evento.detalle` en texto y `JSON.parse` | En `main` es `jsonb`: llega como objeto | `detalleDe` deja de parsear |
| `count(*)` y `sum(monto)` como número | En PostgreSQL llegan como texto (`bigint` y `numeric`) | `::int` y `::bigint` con `mode: 'number'`; los montos ya se manejan como enteros |
| Tabla `secuencia` y `printf('%04d')` para `SUB-0001` | No hace falta | La secuencia `cobro_referencia_seq` de `main` pone la referencia sola |
| `version = version + 1` en cada `UPDATE` | El trigger `fn_cobro_transicion` de `main` ya la sube | Se quita de la API; `WHERE version = $n` se queda (bloqueo optimista) |
| `strftime(…)` en semillas y repositorios | No existe | `now()` |
| `novedad = 1` (enteros como booleanos) | En `piloto_gobierno.persona` es `boolean` | Comparar con `true` |
| `esRestriccion()` lee el mensaje de SQLite | Otros errores | Códigos de PostgreSQL: `23505` único, `23514` check, `23503` llave foránea, `P0001` excepción de un trigger |
| `migrar.ts` envuelve cada archivo en `BEGIN … COMMIT` | `001` y `003` de `main` ya traen su `BEGIN`/`COMMIT` | El migrador corre cada archivo tal cual y anota que corrió |

### 5.3 Lo que cambia por usar el esquema de `main`

| # | Diferencia | Qué se hace | Hallazgo |
|---|---|---|---|
| 1 | `beneficiario` solo tiene tipo y número de documento | El nombre pasa al simulador del gobierno (§ 3). Las pantallas lo piden por HTTP, **varias cédulas en una sola consulta** (ruta nueva del simulador). Se borran `municipio`, los datos ficticios y el estado `Anonimizado` | Cierra D-01 y D-31 |
| 2 | `bloqueo_pin` es una tabla y el bloqueo es **por programa** | Al tercer PIN errado se inserta el bloqueo. El piloto bloqueaba a la persona en **todos** los programas (D-17); HU-11 dice «en ese programa», como `main` | Reemplaza D-17 (**D-42**) |
| 3 | `evento.actor` | Cada evento dice quién lo hizo: `entidad`, `punto:<id>`, `beneficiario:<id>`, `banco` o `sistema` | RNF-09 |
| 4 | `aprobacion_solicitada_en` | El vencimiento de 10 minutos de la aprobación usa esta columna en lugar del evento | HU-05 |
| 5 | El trigger `fn_cobro_reglas` exige que un bono se cobre en un comercio de `programa_punto`; el piloto autoriza por **categorías** (D-38) | **Hecho distinto a lo planeado:** `010_piloto.sql` reemplaza la función del trigger para que acepte también la categoría (sede de un comercio verificado). Llenar `programa_punto` obligaba a mantener dos listas sincronizadas | **D-39** |
| 6 | El mismo trigger revisa RN-03, RN-04, RN-06 y RN-07 al insertar un cobro vivo | La API las sigue revisando antes, para dejar el Rechazado con su motivo. Si el trigger igual rechaza (por ejemplo, el programa se pausó en ese instante), su error se traduce al mismo motivo | Doble defensa |
| 7 | `canal_y_cuenta` de `main` ya deja guardar el Rechazado sin cuenta | El 409 se queda en la etapa 1, para no tocar la web; queda anotado que la base del evento ya lo resuelve | D-25 |
| 8 | `punto.direccion` es obligatoria | Sin dirección se guarda «Sin dirección» | — |
| 9 | RLS activado y sin políticas | La API se conecta como dueña de las tablas y no pasa por RLS. Las tablas nuevas (`010`, `020`) también llevan RLS | Seguridad en Supabase |

### 5.4 Rendimiento con la base lejos (nuevo)

Las vistas hacen muchas consultas pequeñas: `vistaCobro` lee el programa, el punto, la persona, la
cuenta y 3 o 4 veces los eventos. En SQLite eso no costaba nada. Contra `us-east-1` cada consulta
tarda decenas de milisegundos, y el tablero con 50 cobros haría unas 400. **Hallazgo D-43.**

| Pantalla | Arreglo |
|---|---|
| Tablero, «Mi caja», historial y lista del equipo | Cargar los cobros y, en una consulta por tabla, sus programas, puntos, cuentas y eventos. Pedir los nombres al gobierno en una sola consulta |
| Estado del cobro (cada segundo) | Una sola consulta con sus eventos |
| Conexiones | Un pool de 5 conexiones y un solo cliente por proceso |

**Meta (se mide en la fase 4):** tablero con 50 cobros en menos de 1 s y estado del cobro en menos de
300 ms, desde este PC contra Supabase.

### 5.5 El simulador del gobierno

| Hoy | En v2 |
|---|---|
| `liquidacion_persona` en la misma BD | `piloto_gobierno.persona` (documento, **nombre**, veces, PIN con hash, novedad, creado_en) |
| El registro escribe la persona en Tatú y en la liquidación dentro de la misma transacción | Primero el gobierno (por HTTP) y después Tatú; si falla Tatú, la persona queda en el gobierno y el registro se puede repetir |
| El simulador lee `programa` y sus eventos (monto por persona y la hora del tope) | Se queda así: es el **único** cruce entre los dos sistemas, ya anotado como atajo del piloto. Se lee con una consulta de solo lectura |
| `datos.ts` lo usan también el registro y la lista del equipo | Todo pasa por `liquidacion/cliente.ts` (HTTP), con rutas nuevas para registrar, poner el PIN y pedir varios nombres |

---

## 6. Qué se trae de la rama de Pablo

| De la rama de Pablo | ¿Se trae? | Por qué |
|---|---|---|
| **pnpm** con workspaces (`pnpm-workspace.yaml`, `packageManager: pnpm@12.9.1`, `devEngines`) | ✅ | Decisión del equipo |
| **postgres-js con `prepare: false`** | ✅ | Igual que Pablo; funciona con los dos modos del pooler |
| **Drizzle** (`drizzle-orm` y `drizzle-kit` 1.0.0-rc.4) | ✅ | Lo usará el equipo: el piloto lo prueba antes del evento |
| **El esquema de `main`** (`db/` 001 y 003) | ✅ | Es el que tiene el Supabase del equipo |
| **«Primero la base»**: `db:pull` y `scripts/pos-pull.ts` generan `schema.ts` y `relations.ts` | ✅ | Igual que Pablo; con `schemaFilter: ['public', 'gobierno']` |
| **`.env` en la raíz** con `--env-file-if-exists=../.env` | ✅ | Un solo `.env` para todo el repo |
| `normalizarBilletera` quita la `/` final | ✅ | Detalle útil |
| `swagger.ts` escrito a mano | ❌ | El piloto ya tiene uno mejor: se genera de los esquemas Zod y una prueba revisa que estén todas las rutas |
| Rutas sin `/api` y errores `{ error: "texto" }` | ❌ (se propone al equipo) | El piloto usa `/api` (proxy de Vite, sin CORS) y `{ error: { codigo, mensaje } }`; el contrato del evento lo decide el equipo |
| Liquidación en memoria, enlace de cuenta con permiso de `incoming-payment`, rol en `sessionStorage` | ❌ | El piloto ya resolvió esos puntos (D-13, HU-07 con `subject`, D-20) |
| `AI_USAGE.md` y `/prompts` | ❌ | Son entregables del evento; el piloto no se entrega |

---

## 7. Archivo por archivo (etapa 1)

| Archivo | Cambio |
|---|---|
| `package.json` (raíz), `pnpm-workspace.yaml`, `.npmrc` | pnpm; scripts `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm check:secretos`. Se borra `package-lock.json` |
| `api/package.json`, `web/package.json` | Scripts con pnpm; `--env-file-if-exists=../.env`; dependencias nuevas (§ 8) |
| `.env.example` (raíz) | Sale de `api/.env.example`: `DATABASE_URL` de PostgreSQL y la nota de codificar la contraseña |
| `api/src/config.ts` | `DATABASE_URL` acepta `postgres://`, `postgresql://` y `pglite:`; `rutaBaseDeDatos` desaparece; el `.env` se busca en la raíz |
| `api/drizzle.config.ts`, `api/scripts/pos-pull.ts` | Nuevos, desde la rama de Pablo |
| `api/src/db/conexion.ts` | `db` de Drizzle (postgres-js o PGlite según la URL), `transaccion` asíncrona y `esRestriccion` con códigos de PostgreSQL |
| `api/src/db/migrar.ts` | Corre los `.sql` en orden con postgres-js; `db:reset` borra y vuelve a crear los esquemas del piloto |
| `api/src/db/migraciones/` | `001_esquema.sql` y `003_ajustes.sql` de `main` tal cual; `010_piloto.sql` (columnas del piloto, `creado_en`, `programa_categoria`, `comercio` (etapa 1), RLS); `020_gobierno.sql` (esquema `gobierno`). Se borran los SQL de SQLite |
| `api/src/db/schema.ts`, `relations.ts` | Generados con `db:pull` |
| `api/src/db/repositorios/*` (8) | Drizzle, `async`, fechas ISO, sin `rowid`; consultas por lote para las vistas (§ 5.4) |
| `api/src/db/semillas/` | `db:reset` (vacía), `db:reset:demo` (Ana, Luis, Jorge y Rosa en el gobierno, sin datos personales en Tatú) y `db:semilla:ui`, traducida |
| `api/src/liquidacion/*` | Esquema `piloto_gobierno`; rutas nuevas (registrar, PIN, nombres por lote); el registro deja de escribir directo |
| `api/src/comun/vistas.ts` | `async` y por lote |
| `api/src/beneficiarios/`, `cuentas/`, `cobros/`, `programas/`, `puntos/`, `comercios/` | `await`, transacciones, `bloqueo_pin`, `actor`, `aprobacion_solicitada_en` |
| `api/src/salud.ts` | `/salud` dice si responde la base de Supabase, sin mostrar la URL |
| `api/src/main.ts` | Migra al arrancar, cierra el pool al apagar |
| `api/scripts/mantener-permiso.ts`, `primer-cobro.ts`, `guion.ts` | Sin SQL propio; comandos con pnpm |
| `api/test/*`, `api/src/**/*.test.ts` | PGlite en memoria, `async`; `esquema.test.ts` suma los triggers de `main` |
| `web/` | Solo los scripts y dos textos que dicen `npm run …` (`vistas/Estado.tsx`, `api/simulada/servidor.ts`). Mismas respuestas de la API |
| Documentos | `api/README.md`, `web/README.md`, Resumen § 5 y este plan con lo que salga |

**No cambian:** `openPaymentsService.ts`, `certificados.ts` (sirve también para la conexión TLS a
Supabase si el antivirus la inspecciona, D-32), el hash, la renovación del token, las reglas puras
(`cobros/reglas.ts`, `estados.ts`), los mensajes y el Swagger (solo se revisa que siga completo).

---

## 8. Versiones nuevas (exactas)

| Paquete | Versión | Publicada | Nota |
|---|---|---|---|
| `drizzle-orm` · `drizzle-kit` | 1.0.0-rc.4 | 27 de junio de 2026 | La de Pablo. Es candidata a versión final: si algo falla, `sql\`…\`` de Drizzle |
| `postgres` | 3.4.9 | 5 de abril de 2026 | La de Pablo |
| `@electric-sql/pglite` | 0.5.8 | 26 de agosto de 2026 | Pruebas y trabajo sin internet. La 0.5.9 salió hoy: no se usa |
| `pnpm` | 12.9.1 | 3 de octubre de 2026 | **Excepción** a la regla de las dos semanas: la fija el equipo. Ya instalado |

No se agrega `dotenv`: `drizzle.config.ts` usa `process.loadEnvFile()` de Node.

---

## 9. Fases y puertas

| Fase | Qué | Puerta |
|---|---|---|
| 0 | ✅ Swagger en `0c60ad4` y pnpm instalado | Hecho |
| 1 | ✅ Rama `piloto-v2`. pnpm sin tocar la base. `.env.example` en la raíz | ✅ `pnpm install` limpio; 162 + 20 pruebas en verde con pnpm; la API valida la URL sin imprimirla |
| 2 | ✅ Migraciones, PGlite, `schema.ts` (con `db:pull`) y el simulador del gobierno | ✅ La base se crea en PGlite (PostgreSQL 18); `esquema.test.ts`: 22 casos con los triggers de `main` |
| 3 | ✅ Repositorios, transacciones, vistas por lote, servicios y reglas de `main` | ✅ `typecheck` limpio; 168 pruebas de la API y 20 de la web en verde; la app corre en local con la semilla «solo UI» |
| 4 | ✅ Supabase real (el de Pablo, en esquemas propios) | ✅ `/salud` responde; migraciones aplicadas; el catálogo de Supabase es igual al de PGlite; 10 cobros simultáneos de la misma cédula → 1 vivo y 9 `EnProceso`; tablero 0,9 s (meta 1 s ✅), estado del cobro 0,45 s (meta 0,3 s ❌, D-49); `public` de Pablo intacto |
| 5 | Pagos reales otra vez | Registrar al equipo, crear y aprobar un programa, cobro a la cuenta, retiro en el punto, «Mi caja», renovación del permiso y un bono, todo sobre Supabase |
| 6 | Documentos | `Resultados del piloto.md` (D-39 a D-44), `api/README.md`, Resumen § 5 y el README del piloto |
| 7 | Etapa 2 (opcional) | Puntos y comercios al gobierno (§ 4) |

**Datos actuales:** la base SQLite (`api/data/tatu.db`) se queda en la rama `piloto` y no se migra.
Son pocas filas: el equipo se vuelve a registrar y se aprueba un programa nuevo, que de todas formas
es lo que hay que probar en Supabase.

---

## 10. Lo que solo puedes hacer tú

- [x] Instalar pnpm 12.9.1 (hecho, con tu permiso).
- [ ] **Confirmar de quién es el proyecto de Supabase** (§ 2): ¿solo del piloto o del equipo?
- [ ] **Escribir la `DATABASE_URL` en el `.env` de la raíz**, con la contraseña codificada (§ 2). Yo no
      la escribo: la compartiste por chat, pero los secretos los pone el dueño.
- [ ] Después de la fase 5: **cambiar la contraseña** de la base en Supabase y actualizar el `.env`.
- [ ] En la fase 5: volver a registrar al equipo y aprobar el programa en la Test Wallet.

---

## 11. Decisiones (la recomendada primero)

1. **¿Dónde se monta?** ✅ **Decidido: en el Supabase del equipo (el de Pablo)**, en los esquemas
   `piloto` y `piloto_gobierno`, sin tocar `public` (§ 2). Las decisiones 2 a 4 se tomaron como se
   recomendaban.
2. **¿Cómo se accede a los datos?** **Drizzle (recomendado)**, igual que la rama de Pablo, para
   probarlo antes del evento. La alternativa es SQL directo con postgres-js: menos cambio, pero no
   prueba lo que va a usar el equipo.
3. **¿Contra qué corren las pruebas?** **PGlite en memoria (recomendado)**: rápidas, sin internet y
   con los mismos triggers. Solo la prueba de la carrera va también contra Supabase.
4. **¿Etapa 2 ahora o después?** **Después (recomendado)**, solo si la etapa 1 pasa su puerta.
5. **Para el equipo:** la verificación de identidad en producción (§ 3, D-40) y el contrato de la API
   del evento (rutas con o sin `/api`, formato de los errores).

---

## 12. Riesgos y planes B

| Riesgo | Señal | Plan B |
|---|---|---|
| Sin internet o Supabase caído el día del evento | `/salud` falla | `DATABASE_URL=pglite:./data/tatu`: la misma app con PostgreSQL local (PGlite), mismas migraciones |
| La base lejos hace lenta la app | No se cumplen las metas del § 5.4 | Más consultas por lote; si no basta, un proyecto de Supabase en una región más cercana (`sa-east-1`, São Paulo) |
| Drizzle 1.0.0-rc.4 falla en algo | Error de Drizzle | `sql\`…\`` de Drizzle para esa consulta |
| El antivirus inspecciona también la conexión a Supabase | Error de certificado al conectar | `certificados.ts` ya cubre todo TLS de Node; si no basta, `ssl` explícito en postgres-js |
| El pooler se queda sin conexiones | Error «too many clients» | Pool de 5, un solo cliente por proceso, y cerrar el pool al apagar |
| La URL con caracteres especiales | «Invalid URL» al arrancar | Codificar la contraseña (§ 2); la API dice qué falta sin mostrar la URL |
| Usar por error el proyecto del equipo | Aparecen las tablas de Pablo | `db:reset` se niega a borrar si encuentra tablas que no son del piloto |

---

## 13. Hallazgos nuevos (ya están en `Resultados del piloto.md`, con D-45 a D-48 de la ejecución)

| ID | Hallazgo |
|---|---|
| D-39 | El trigger de `main` autoriza bonos solo por `programa_punto`; el piloto autoriza por categorías y comercios verificados. Hay que elegir uno para el evento; v2 amplía el trigger para aceptar los dos |
| D-40 | La verificación de identidad en producción (fotos del documento y de la cara) choca con «no guardamos fotos» (Guía, RNF-06) y con la Ley 1581: guardar solo el resultado del proveedor |
| D-41 | `programa` y `cuenta_beneficiario` de `main` no tienen `creado_en`: no hay cómo ordenarlos por fecha |
| D-42 | El piloto bloqueaba el PIN en todos los programas; HU-11 y `main` lo bloquean solo en ese programa |
| D-43 | Con la base en otra región, las vistas que hacen una consulta por fila se vuelven lentas: el código del evento tiene que consultar por lote desde el principio |
| D-44 | Una contraseña con `@`, `#` o `+` rompe la `DATABASE_URL` si no se codifica; y la del piloto se compartió por chat |

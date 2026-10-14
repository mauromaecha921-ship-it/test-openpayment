# Plan: actualizar la arquitectura y la documentación a Vercel + Supabase

> **Estado: aprobado y ejecutado (14 de octubre de 2026).** Revisión de `docs/`, los README y
> `.env.example` contra el código de `piloto-v2` después de unirle `produccion` (commit `c682441`).
> Despliegue: <https://test-openpayment.vercel.app> (rama `produccion`), con el pooler de Supabase
> en el puerto 6543 según `GET /api/salud`.

## 1. Qué cambió en la arquitectura (lo que dice el código)

| Antes (lo que dicen los documentos) | Ahora (lo que hace el código) | Dónde se ve |
|---|---|---|
| Rama `piloto`: SQLite en un archivo, `api/.env` | `piloto-v2`: PostgreSQL con Drizzle. **Supabase** (pooler) en la nube; **PGlite** (PostgreSQL dentro de Node) solo para desarrollo sin internet y para las pruebas | `server/src/config.ts`, `server/src/db/conexion.ts` |
| Carpeta `api/` | Carpeta **`server/`** (el paquete pnpm sigue llamándose `api`: `pnpm --filter api …` no cambia) | commit `49cd58b` |
| Dos puertos: API en 3000 y web en 5173 (Vite con proxy de `/api`) | **En Vercel, un solo dominio**: la web estática y la API como una función de Node que atiende todo `/api`. En local siguen siendo dos procesos, pero el navegador solo usa uno (el 5173, con el proxy) | `vercel.json`, `scripts/build-vercel.mjs`, `server/src/vercel.ts` |
| AD-17: web en Vercel y API en Render o Railway (pendiente) | Las dos en Vercel con la Build Output API v3: `static/` (web) + `functions/api.func` (Express empaquetado con esbuild, Node 24, `maxDuration` 60 s) | `scripts/build-vercel.mjs` |
| La API es un solo proceso prendido: migra, recupera los cobros en Pagando y renueva los tokens con un `setInterval` | En Vercel no hay proceso prendido: lo que hacía `main.ts` al arrancar se hace **en el primer pedido de cada instancia**; la renovación de tokens (D-35) se dispara con los pedidos y usa un **candado de PostgreSQL** (`pg_try_advisory_lock`) para que solo una instancia renueve; el pago sigue vivo después de responder gracias a `waitUntil` | `server/src/vercel.ts`, `cobros/orquestacion.ts` |
| AD-08: «con un solo proceso no hay competencia» | Puede haber **varias instancias** a la vez: el bloqueo optimista (`version`) y el índice único parcial ya lo cubren; la renovación usa el candado | `conexion.ts` (`conCandado`) |
| `APP_BASE_URL`, `API_BASE_URL`, `LIQUIDACION_URL` obligatorias | En Vercel se completan solas con el dominio del despliegue (producción o la rama en preview) si no se definen | `config.ts` (`completarUrlsDeVercel`) |
| «La aprobación del banco vuelve a `localhost`» (Resumen § 4, punto 4) | Con Vercel vuelve al dominio público con HTTPS: la entidad puede aprobar desde cualquier equipo | `completarUrlsDeVercel` |
| Llave privada en un archivo (`OP_PRIVATE_KEY_PATH`) | En Vercel no hay archivo: va en `OP_PRIVATE_KEY_BASE64` como variable del proyecto | `openPaymentsService.ts` |
| Pooler de Supabase en modo «Session» (5432) | En Vercel conviene el modo «Transaction» (6543): cada instancia abre sus conexiones (`max` 8 en Vercel, 5 en local) y en 6543 se apagan los *prepared statements* | `conexion.ts` |

## 2. Antes de documentar: `produccion` y `piloto-v2` no tienen el mismo código

La rama **`produccion`** (la que parece desplegar Vercel) tiene 5 commits que `piloto-v2` no tiene, y
`piloto-v2` tiene el commit de Bre-B (`a3d506c`) que `produccion` no tiene:

| Commit en `produccion` | Qué arregla |
|---|---|
| `a616871` | Copia los specs OpenAPI de `@interledger/open-payments` dentro de la función (sin eso el cliente no arranca en Vercel) |
| `09f3375` | Ignora `.vercel/` en `.gitignore` |
| `9f4ce62` | Límite de 45 s a las tareas de fondo, 8 s al `jwks.json` y 8 conexiones en Vercel (evita timeouts) |
| `991e50d`, `5d1701c` | Limpieza del montaje; deja un archivo sobrante `vercel.json.local-bak` |

**Propuesta:** unir `origin/produccion` en `piloto-v2` (y quitar `vercel.json.local-bak`) antes de
documentar, para que lo escrito corresponda al código de la rama.

**Resuelto:** el PR #8 ya había llevado `piloto-v2` (con Bre-B) a `produccion`, así que la unión fue
un avance directo (*fast-forward*) a `c682441`, sin conflictos. `vercel.json.local-bak` se quitó.

## 3. Qué se actualiza

Los documentos se separan en dos grupos:

- **Vigentes:** describen cómo funciona hoy y se actualizan.
- **Históricos:** registran lo que se planeó y se probó en una fecha. No se reescriben: solo llevan
  una nota arriba que remite a la arquitectura vigente.

### 3.1 Vigentes (se reescribe lo que ya no corresponde)

| # | Documento | Cambios |
|---|---|---|
| A1 | `docs/Documento de Arquitectura — Hackathon Open Payments.md` | **Nueva § 3.6 «Despliegue y entornos»** con dos diagramas (Vercel + Supabase y desarrollo local), la tabla de entornos (local con PGlite, local con Supabase, Vercel preview y producción) y lo que cambia por correr en funciones (arranque perezoso, `waitUntil`, candado de renovación). **§ 3.5:** AD-05 (Supabase), AD-06 (Drizzle, decidido), AD-13 (módulo de la API en `/api/liquidacion`), AD-17 (Vercel para web y API, decidido) y AD-08 (nota sobre varias instancias); conteo de decididas actualizado. **§ 4.1:** los esquemas `piloto`, `piloto_gobierno` y `piloto_puente` en la base de Supabase del equipo. **§ 4.2:** filas de PostgreSQL y hosting. **§ 5:** P-02, P-03, P-14 y P-20 cerrados, con la referencia de dónde se resolvieron |
| A2 | `docs/Resumen para el equipo.md` | Aviso de arriba (ya no es la rama `piloto` con SQLite); § 2 (Supabase); § 4 punto 4 (la aprobación ya no vuelve a `localhost` en Vercel); **§ 5 «Cómo correr» reescrito** con pnpm y `server/`, más un apartado «Desplegado en Vercel» con el enlace; § 6 y § 7 con rutas `server/` |
| A3 | `README.md` (raíz) | Enlace al despliegue; tabla con `server/` en lugar de `api/`; ramas `piloto-v2` y `produccion` |
| A4 | `docs/README.md` | Estado de Arquitectura y de piloto/ (Supabase y Vercel, no SQLite); índice con los documentos que faltan: Historias y criterios de piloto-v2 (Pablo), Plan Supabase y pnpm, Plan identidad visual, Plan modo oscuro y este plan |
| A5 | `server/README.md` | `api/` → `server/` (PGlite en `server/data/pglite`, `server/.env`); **nueva sección «Despliegue en Vercel»**: cómo se arma el build, variables que hay que cargar en el proyecto, pooler 6543, migraciones en el primer pedido, renovación con candado y cómo ver los logs |
| A6 | `web/README.md` | `npm` → `pnpm`; puertos y proxy; el modo oscuro ya existe; `api/` → `server/`; en Vercel la web y `/api` comparten dominio, sin proxy |
| A7 | `.env.example` | `api/.env` → `server/.env`; nota de qué variables se completan solas en Vercel y de usar el pooler 6543 allá |
| A8 | `docs/piloto/README.md` | Línea de estado; § 11 «Despliegue en Vercel (pendiente)» pasa a «resuelto: camino 3 (PostgreSQL gestionado)» con remisión a Arquitectura § 3.6 |
| A9 | `docs/piloto/API del piloto.md` | URL base local y de Vercel; rutas `api/src/…` → `server/src/…` |

### 3.2 Documentos de producto (dueños: el equipo). Cambio mínimo

| # | Documento | Cambio |
|---|---|---|
| B1 | `docs/Documento Guía — Hackathon Open Payments.md` | Solo la fila «Despliegue» del stack: «Vercel para la web y la API (una función de Node)», con nota de que se resolvió en piloto-v2 |
| B2 | `docs/Historias de Usuario — Bonos con Destino.md` y `…piloto-v2.md` (Pablo) | HU-25 / CA-25.01: «La web y la API corren en Vercel con HTTPS» en lugar de «la API en Render/Railway» |

### 3.3 Históricos (solo una nota arriba)

`Plan backend.md`, `Plan Supabase y pnpm.md`, `Plan de ajustes.md`, `Plan frontend.md`,
`Resultados del piloto.md`, `Plan Bre-B.md`, `Plan identidad visual.md`, `Plan modo oscuro.md` y
`Estructura del proyecto.md` (diseño del repositorio del evento, que decide el Rol 1). Nota:

> **Nota (14 oct 2026):** en `piloto-v2` la carpeta `api/` ahora se llama `server/`, la base es
> Supabase y el despliegue es en Vercel. Lo vigente está en la Arquitectura, § 3.6.

### 3.4 Textos del código que repiten la ruta vieja (opcional)

Los mensajes «Falta … en api/.env» que ve el usuario (`server/src/openPaymentsService.ts` y la página
`/estado` en `web/src/vistas/Estado.tsx`) y los comentarios de `config.ts`, `web/src/api/tipos.ts` y
`server/config/puerto-3100.env`: decir `server/.env` en local o «las variables del proyecto» en Vercel.
No cambia comportamiento; se verifica con typecheck y pruebas.

## 4. Lo que no cambia

- La postura de que el piloto es desechable y no va a `main` (Guía): es una decisión del equipo, no
  de esta revisión.
- Los hallazgos D-xx y las verificaciones V-xx: son el registro del piloto.

## 5. Lo que necesito para ejecutar

Respondido el 14 de octubre: la URL es `https://test-openpayment.vercel.app`, se une `produccion`
primero, el alcance es todo el plan (§ 3.1 a § 3.4) y el pooler de Vercel es el 6543 (se leyó en
`GET /api/salud`).

## 6. Verificación al terminar

- Ninguna mención a `api/` como carpeta vigente ni a SQLite como base actual fuera de los documentos
  históricos (búsqueda con `grep`).
- Los enlaces relativos entre documentos siguen abriendo.
- Si se hace § 3.4: `pnpm typecheck` y `pnpm test` en verde.
- Un solo commit de documentación en `piloto-v2`, sin subirlo hasta que lo revises.

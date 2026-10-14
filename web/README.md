# web/ · Piloto 1 (frontend)

React 19, Vite 8, Tailwind 4 y shadcn/ui, construida a partir de las 19 pantallas del flujo principal
de `wireframe/Wireframes de la app.html`, según el [Plan frontend](../docs/piloto/Plan%20frontend.md).
Es parte del piloto **desechable**: vive en la rama `piloto-v2` (y `produccion`, que despliega Vercel) y no se
mezcla a `main`. En Vercel la web y la API comparten dominio: <https://test-openpayment.vercel.app>.

## Cómo se corre

| Comando (desde la raíz, con pnpm 12.9.1) | Qué hace |
|---|---|
| `pnpm dev` | API (puerto 3000) y web (5173) juntas, con `concurrently`. Se abre solo el 5173: Vite pasa `/api` a la API |
| `pnpm dev:web` | Solo la web; `/api` va por el proxy de Vite a `localhost:3000` |
| `pnpm --filter web dev:simulada` | Solo la web, con la **API simulada** en el navegador (sin backend ni Open Payments) |
| `$env:API_PROXY='http://localhost:3100'; pnpm dev:web` (PowerShell) | Solo la web, con el proxy hacia otra instancia de la API (por defecto va al 3000) |
| `pnpm --filter web dev:host` | La web abierta en la red local, para probar en celulares (§ 9 del plan) |
| `pnpm --filter web test` | Vitest: `formatMonto` y la elección de pantalla según el estado del cobro |
| `pnpm --filter web build` | `tsc` y el build de producción (`web/dist`, que Vercel publica como estático) |

En Vercel no hay proxy: la web y `/api` salen del mismo dominio, así que el código llama siempre a
`/api/…` sin cambiar nada. Cómo se arma el despliegue: [`server/README.md`](../server/README.md#despliegue-en-vercel).

## API simulada (modo `simulada`)

Como la API todavía no estaba lista, la web trae un doble de pruebas en `src/api/simulada/`: responde
en el navegador con el contrato del Plan backend § 7 e imita las reglas principales (liquidación de
4 cédulas, PIN de 4 dígitos con 3 intentos, 120 s para confirmar, tope del banco, doble cobro, pausa
y cierre). Guarda su estado en `localStorage` (`tatu.simulada`), así que varias pestañas ven lo mismo.
La «Test Wallet» es la pantalla `/simulada/banco`, que solo existe en este modo. En la entrada hay
botones para cargar el escenario de `db/002_datos_prueba.sql` y para reiniciar los datos.

Cédulas y PIN de prueba: 900000001 Ana (1111), 900000002 Luis (2222), 900000003 Jorge (3333) y
900000004 Rosa (4444, retroactivo de $460.000). **No es la fuente de verdad del negocio:** las reglas
reales son las de `server/`.

Con la API simulada se recorrieron los pasos 2 a 7 del guion y HU-07 (ver «Verificación» abajo).

## Estructura

Sigue el § 1 del plan: `contexto/Rol.tsx`, `api/` (`client.ts`, `tipos.ts`, `usePolling.ts`,
`config.ts`), `lib/` (`montos.ts`, `textos.ts`, `pantallas.ts`, `ventana.ts`, `utils.ts`),
`componentes/` (los del § 7 y `ui/` de shadcn) y `vistas/` por rol. `extras/` queda vacío (RNF-10).

## Decisiones y desviaciones del plan

| Tema | Decisión | Por qué |
|---|---|---|
| API simulada | Agregada en `src/api/simulada/` (no estaba en el plan) | Poder ver y recorrer las pantallas antes de que exista la API |
| `select` de shadcn | Instalado, pero la entrada usa `<select>` nativo | En el celular abre el selector del sistema; el wireframe 01 también es nativo |
| `cn()` | `clsx` + `tailwind-merge` en `lib/utils.ts` | El CLI 4.21 agrega el paquete `cn`; se quitó para seguir el plan |
| `shadcn` | Como devDependency, fijado en 4.21.0 | Solo se usa su `tailwind.css` al compilar; 4.21.4 tenía menos de dos semanas |
| `radix-ui` | 1.6.7 | La 1.7.0 (que agrega el CLI) salió el 5 de octubre: menos de dos semanas |
| Fuente Geist | Quitada | El preset la agrega; el plan usa Atkinson Hyperlegible e IBM Plex Mono |
| Modo oscuro | Desactivado al principio (los wireframes solo tienen tema claro); **desde el 13 de octubre existe**, con selector en `componentes/Tema.tsx` | [Plan modo oscuro](../docs/piloto/Plan%20modo%20oscuro.md) |
| Explicación de los rechazos | El título es `motivo.mensaje` de la API; la frase de apoyo («No se creó ningún pago») vive en `lib/textos.ts` por código | Los wireframes 17 a 19 la muestran y el contrato no la trae |
| Fechas de la vigencia | `<input type="date">` en lugar de texto `dd/mm/aaaa` | Teclado y validación del sistema; viaja como `YYYY-MM-DD` |
| «Conectar liquidación de prueba» | Primero guarda el borrador | La ruta de la liquidación necesita el id del programa |
| Pestaña de la Test Wallet | Se abre en el mismo clic; si el navegador la bloquea, se navega en la misma pestaña | Abrirla después de un `await` la bloquea |

## Formas JSON que la web espera (para comparar con `server/`)

El Plan backend § 7 define rutas y convenciones; estas formas concretas las fija `src/api/tipos.ts`.
Montos en texto y en unidades mínimas, con `moneda: { codigo, escala }`; fechas ISO 8601.

- **`GET /config`** → `{ pollIntervaloMs, confirmacionTtlSeg, extras: { bono, qr, pdf417, contrato, deploy } }`
- **`Programa`** → `{ id, nombre, entidad, tipo: "subsidio"|"bono", billetera, moneda, vigenciaInicio, vigenciaFin, estado, tope|null }`
  (`vigencia*` como `YYYY-MM-DD`). `POST /programas` y `PATCH` reciben `{ nombre, entidad, tipo, billetera, vigenciaInicio, vigenciaFin }`.
- **`GET /programas/:id/liquidacion`** → `{ cedulas, total, moneda }`
- **`POST /programas/:id/autorizar`** → `{ redirect }`
- **`GET /billeteras/resolver?direccion=`** → `{ id, moneda }`; 404 si no existe
- **`Punto`** → `{ id, nombre, direccion, billetera, billeteraCorta, moneda? }` (la BD no guarda la moneda); `POST /puntos` recibe `{ programaId?, nombre, direccion, billetera }`
- **`GET /beneficiarios/demo`** → `[{ documento, nombre, etiqueta }]` (la etiqueta es «C.C. de prueba N»; el selector muestra «nombre · etiqueta»)
- **`GET /beneficiarios/:documento/resumen`** → `{ persona: { nombre, documento }, pago: { programa: { id, nombre, estado }, monto, moneda, vigenciaFin } | null, cuenta: Cuenta | null, ultimoCobro: CobroResumen | null }`
- **`Cuenta`** → `{ id, documento, estado: "SinEnlazar"|"PorVerificar"|"Verificada", billetera, billeteraCorta }`;
  `POST /cuentas` → `{ cuenta, redirect | null }` (null en el plan B); `GET /cuentas/:documento` → `Cuenta` o 404 si no tiene
- **`Cobro`** → el ejemplo del § 7 más `cuenta: { billetera, billeteraCorta } | null`, `persona.novedad?`,
  `segundosHastaPagado` (del PIN, o de la solicitud en el canal cuenta, a Pagado), `creado` y `actualizado`.
  `CobroResumen` es el mismo sin `eventos`.
- **`POST /cobros`** con una cédula que no está en la liquidación → error 404 `{ codigo: "SinPagoDisponible", mensaje }` (no deja cobro, § 8.2)
- **`POST /cobros/:id/confirmar`** con PIN errado → 422 `{ codigo: "PinIncorrecto", mensaje: "PIN incorrecto, te quedan N intentos" }`
- **`GET /programas/:id/tablero`** → `{ programa, autorizado, cobrado, fuente: "banco"|"plataforma", noHaSalido, cobrosPagados,
  porCanal: { cuenta: { cobros, monto }, retiro: { cobros, monto } }, reembolsoSegundos|null, giradoPorAdelantado,
  sinCobrar: { cedulas, monto }, cobrosPagando, rechazadosYFallidos, cobros: CobroResumen[], cierre: { autorizado, cobrado, nuncaSalio, cerradoEn } | null }`
- **Regresos de la Test Wallet:** `/entidad/programas/:id/aprobar?resultado=aprobado|rechazado|invalido|vencido` y
  `/beneficiario/cuenta?resultado=verificada|rechazada|invalido`

## Verificación (10 de octubre de 2026)

| Qué | Resultado |
|---|---|
| `tsc` (65 archivos), `vite build`, Vitest (17 tests), `check:secretos` | ✅ |
| Guion 2 a 7 y HU-07 en modo simulado: conectar, rechazar y aprobar, Ana a su cuenta (con doble clic: 1 solo cobro), Jorge en el punto con un PIN errado y luego el correcto, Jorge otra vez, Rosa contra el tope, cierre con CERRAR, Luis después del cierre, Luis enlaza su cuenta | ✅ simulado; ⏳ contra la API real y la Test Wallet |
| Contra la API real con `db:semilla:ui` (token falso): entrada, tablero (fuente «plataforma»), detalle, inicio e historial de Ana, retiro hasta Fallido · ErrorPago y rechazo EnProceso | ✅ |
| HU-03: punto con wallet en USD en un programa COP → «no se guardó» | ✅ simulado |
| 375 px sin desplazamiento horizontal (entrada, beneficiario, punto) | ✅ |
| Sin backend: «No pudimos conectar con el servidor. Intenta de nuevo» | ✅ |
| Foco al título al cambiar de pantalla; `aria-live` en los cambios de estado; sin errores en la consola | ✅ |
| Lighthouse 13.5 (Accesibilidad, perfil móvil): `/punto`, `/punto/cobros/:id` en PIN, Pagado y Fallido, `/beneficiario`, `/beneficiario/cuenta`, `/` y el tablero | ✅ 100 en las 8 |
| 360 × 740: las 15 rutas sin desplazamiento horizontal | ✅ |
| Objetivos táctiles de 44 px o más | ✅ salvo los radios del tipo de programa (20 px), cuya etiqueta completa también los marca |
| Sin palabras técnicas (grant, token, wallet) en las vistas del beneficiario y del punto | ✅ solo queda el ejemplo de formato `$ilp…` del wireframe 09 |
| 1 Android + 1 iPhone reales (V-19) | ⏳ con `pnpm --filter web dev:host`, o directamente en la URL de Vercel |

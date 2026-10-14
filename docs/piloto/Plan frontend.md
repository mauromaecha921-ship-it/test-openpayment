# Piloto 1: plan del frontend

> **Nota (14 de octubre de 2026):** documento histórico; se conserva como se escribió. En `piloto-v2`
> la carpeta `api/` ahora se llama `server/`, la base es Supabase (PostgreSQL con Drizzle) y la web
> y la API están desplegadas juntas en Vercel (<https://test-openpayment.vercel.app>). Lo vigente:
> [Arquitectura, § 3.6](../Documento%20de%20Arquitectura%20—%20Hackathon%20Open%20Payments.md) y [`server/README.md`](../../server/README.md).

> Parte del [plan general](./README.md). Web en React, Vite, Tailwind CSS y shadcn/ui (AD-04),
> construida a partir de las 22 pantallas de `wireframe/Wireframes de la app.html` y conectada a la
> API del [Plan backend](./Plan%20backend.md). **Estado (12 de octubre de 2026): construido en
> `web/`, y corregido después de la primera corrida** (vistas para PC y celular, registro del equipo,
> varios subsidios por persona y la caja del punto): ver el [Plan de ajustes](./Plan%20de%20ajustes.md).
> Donde este plan dice «celular, 390 px», hoy significa «también en PC» (D-30).

Reglas que vienen de los documentos: cliente delgado sin secretos (el navegador solo habla con
nuestra API, nunca con el SDK), móvil primero desde 360 px, español sencillo y un rol que se elige
sin login (Arquitectura § 2.1, HU-19).

---

## 1. Estructura de `web/`

```text
web/
├── package.json · index.html (lang="es") · vite.config.ts · tsconfig*.json
├── components.json              # configuración de shadcn/ui
└── src/
    ├── main.tsx                 # fuentes, estilos y <BrowserRouter>
    ├── App.tsx                  # rutas (P-15) y RolProvider
    ├── index.css                # Tailwind 4, tokens de los wireframes y tema de shadcn
    ├── contexto/Rol.tsx         # rol, programa, cédula o punto en localStorage (D-20)
    ├── api/
    │   ├── client.ts            # fetch tipado a /api y manejo de errores
    │   ├── tipos.ts             # Programa, Cobro, Tablero… (copia del contrato del backend)
    │   └── usePolling.ts        # consulta periódica (AD-16)
    ├── lib/
    │   ├── montos.ts            # formatMonto("23000000", "COP", 2) → "$230.000"
    │   ├── textos.ts            # nombres de estados, fechas y horas en español
    │   └── utils.ts             # cn() de shadcn
    ├── componentes/
    │   ├── ui/                  # los de shadcn
    │   └── …                    # compartidos (§ 7)
    ├── vistas/
    │   ├── Entrada.tsx
    │   ├── entidad/             # ConectarPrograma · AprobarEnBanco · Tablero · DetalleCobro · CerrarPrograma · ProgramaCerrado
    │   ├── beneficiario/        # Inicio · EnlazarCuenta · CobrarCuenta · CobroPagado · DondeCobrar · Historial
    │   └── punto/               # NuevoCobro · ConfirmarPin · ResultadoCobro
    └── extras/                  # vacío: cada extra va detrás de su EXTRA_*
```

Los tipos se copian del contrato del backend en lugar de importarlos de `api/`: así la web se puede
desplegar sola en Vercel más adelante.

---

## 2. Instalación y arranque

Primero se crea `web/package.json` (`"type": "module"`), y luego, desde la raíz:

```bash
npm install -w web --save-exact react@19.3.0 react-dom@19.3.0 react-router@7.18.4 lucide-react@1.48.0 clsx@2.1.1 tailwind-merge@3.7.0 class-variance-authority@0.7.1 @fontsource/atkinson-hyperlegible@5.3.0 @fontsource/ibm-plex-mono@5.3.0
npm install -w web --save-exact -D vite@8.3.4 @vitejs/plugin-react@6.1.1 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 tw-animate-css@1.4.0 typescript@6.0.3 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@24.19.0 vitest@5.0.2
```

Después, dentro de `web/`, shadcn/ui con su CLI fijado:

```bash
npx shadcn@4.21.0 init
npx shadcn@4.21.0 add button card input label radio-group select badge table tabs alert alert-dialog progress separator
```

El CLI agrega las dependencias de cada componente; al terminar hay que revisar que queden con
versión exacta en `web/package.json`.

- **`vite.config.ts`:** los plugins de React y de Tailwind, el alias `@` hacia `src/` (lo pide
  shadcn), el puerto 5173 fijo y un proxy de `/api` hacia `http://localhost:3000`. La web y la API
  quedan en el mismo origen y no hace falta CORS; en Vercel, las rutas `/api` funcionarían igual.
- **Fuentes:** las de los wireframes, servidas en local con `@fontsource` (pesos 400 y 700), sin
  llamadas a Google Fonts.
- **Arranque:** `npm run dev` en la raíz levanta la API y la web juntas con `concurrently`.

---

## 3. Mapa de pantallas: wireframe → ruta → API

| # | Wireframe | Ruta | Vista | Endpoints | HU |
|---|---|---|---|---|---|
| 01 | Entrada · Elegir rol | `/` | `Entrada` | `GET /programas`, `GET /beneficiarios/demo`, `GET /puntos` | HU-19 |
| 02 | Entidad · 1 Conectar programa | `/entidad/programas/nuevo` y `/entidad/programas/:id/editar` | `ConectarPrograma` | `GET /billeteras/resolver`, `POST` y `PATCH /programas`, `GET /programas/:id/liquidacion`, `GET` y `POST /puntos` | HU-01 a HU-03 |
| 03 | Entidad · 2 Aprobar en el banco | `/entidad/programas/:id/aprobar` | `AprobarEnBanco` | `POST /programas/:id/autorizar`, `GET /programas/:id` cada 2 s, `POST /programas/:id/cancelar-aprobacion` | HU-04, HU-05 |
| 04 | Entidad · 3 Tablero | `/entidad/programas/:id` | `Tablero` | `GET /programas/:id/tablero` cada 5 s, `POST /pausar` y `/reanudar` | HU-15, HU-16, HU-18 |
| 05 | Entidad · 4 Detalle del cobro | `/entidad/cobros/:id` | `DetalleCobro` | `GET /cobros/:id` | HU-16 |
| 06 | Entidad · 5 Cerrar programa | `/entidad/programas/:id/cerrar` | `CerrarPrograma` | `POST /programas/:id/cerrar` | HU-17 |
| 07 | Entidad · 6 Programa cerrado | `/entidad/programas/:id`, cuando está Cerrado | `ProgramaCerrado` | `GET /programas/:id/tablero` | HU-17 |
| 08 | Beneficiaria · 1 Tienes $230.000 | `/beneficiario` | `Inicio` | `GET /beneficiarios/:documento/resumen` | HU-08 |
| 09 | Beneficiaria · 2 Enlazar cuenta | `/beneficiario/cuenta` | `EnlazarCuenta` | `POST /cuentas`, `GET /cuentas/:documento` cada 2 s | HU-07 |
| 10 | Beneficiaria · 3 Cobrar a mi cuenta | `/beneficiario/cobrar` | `CobrarCuenta` | `POST /cobros` (canal cuenta) | HU-09 |
| 11 | Beneficiaria · 4 Pagado | `/beneficiario/cobros/:id` | `CobroPagado` | `GET /cobros/:id` cada 1 s | HU-09 |
| 12 | Beneficiaria · 5 Dónde cobrar | `/beneficiario/puntos` | `DondeCobrar` | `GET /puntos` | HU-08 |
| 13 | Beneficiaria · 6 Ya cobrado | `/beneficiario/historial` | `Historial` | `GET /beneficiarios/:documento/resumen` | HU-08 |
| 14 | Punto · 1 Digitar cédula | `/punto` | `NuevoCobro` | `POST /cobros` (canal retiro), `GET /puntos/:id/cobros` | HU-10 |
| 15 | Punto · 2 Confirmar con PIN | `/punto/cobros/:id`, en PorConfirmar | `ConfirmarPin` | `POST /cobros/:id/confirmar`, `POST /cobros/:id/cancelar`, `GET /cobros/:id` | HU-11 |
| 16 | Punto · 3 Pagado y reembolso | `/punto/cobros/:id`, en Pagando o Pagado | `ResultadoCobro` | `GET /cobros/:id` cada 1 s | HU-12 |
| 17 | Punto · Rechazo: ya cobrado | `/punto/cobros/:id`, Rechazado | `ResultadoCobro` | El mismo | HU-13, HU-14 |
| 18 | Punto · Rechazo: tope del banco | `/punto/cobros/:id`, Fallido | `ResultadoCobro` | El mismo | HU-13 |
| 19 | Punto · Rechazo: programa cerrado | `/punto/cobros/:id`, Rechazado | `ResultadoCobro` | El mismo | HU-13, HU-17 |
| 20 | Extra 1 · Bono en comercio | `/punto/venta-bono` | `extras/` | — | HU-21 |
| 21 | Extra 2 · QR del beneficiario | `/beneficiario/qr` | `extras/` | — | HU-22 |
| 22 | Extra 4 · Contrato por hitos | `/contratos/:id` | `extras/` | — | HU-24 |

Las pantallas 15 a 19 son una sola ruta: la vista se elige según el estado del cobro. Así, un
recargo de página o un doble clic siempre muestran la verdad que tiene la API. Las pantallas 20 a
22 quedan fuera del piloto (§ 10).

---

## 4. Rol y navegación (HU-19)

- **`Entrada`** muestra las tres tarjetas del wireframe 01: Entidad con su programa, Beneficiario con
  la cédula de prueba («Ana · cuenta verificada», «[Persona 2] · con cuenta») y Punto de retiro
  («Tienda Marta — corresponsal»). Abajo, el texto «Jorge no usa la app: cobra en el punto solo con
  su cédula».
- **`contexto/Rol.tsx`** guarda `{ rol, programaId, documento, puntoId }` en `localStorage`
  (clave `tatu.rol`), sin datos sensibles, para cumplir «el rol elegido se recuerda al recargar».
  Se usa `localStorage` y no `sessionStorage` (D-20): la aprobación en la Test Wallet se abre en
  otra pestaña y vuelve a la app por el callback.
- **«Cambiar rol»**, en todos los encabezados, lleva a `/` con la selección anterior ya marcada.
- **Pantallas de regreso:** las que reciben el `?resultado=` del callback (`/entidad/programas/:id/aprobar`
  y `/beneficiario/cuenta`) cargan todo desde la URL y la API, y funcionan aunque la pestaña sea
  nueva.
- **Ir al equipo y volver al programa** (14 oct 2026): «Registrar personas» y «Registrar comercios»
  en «Conecta tu subsidio» llevan a `/equipo?volver=<ruta del programa>`. Antes, «Volver» en el
  equipo siempre iba a la entrada y lo escrito sin guardar se perdía. Ahora:
  - Lo escrito se deja en `sessionStorage` (`tatu.programa-pendiente`) y se recupera al volver,
    también con «Atrás» del navegador. Se vuelve a validar la wallet y se pide de nuevo el total,
    porque pudo cambiar.
  - En el equipo, «Volver al programa» y un aviso con «Volver a terminar el programa».
  - `volver` solo acepta rutas `/entidad/programas/…`. Con cualquier otro valor, el enlace sigue
    yendo a la entrada.
  - Los puntos de retiro no salen del formulario: se agregan en su sección 4 y quedan guardados en
    la API.
- **Encabezados:** en la entidad, «Tatú / Entidad de prueba · Entidad · Cambiar rol», con contenido
  de hasta 1200 px de ancho; en el celular, «Tatú · Ana» o «Tatú · Tienda Marta» y «Cambiar rol».
  El beneficiario tiene navegación inferior con «Inicio», «Mi cuenta» e «Historial».

---

## 5. Datos: cliente de la API y consulta periódica

- **`api/client.ts`:** `get` y `post` con JSON contra `/api`. Si la API responde
  `{ error: { codigo, mensaje } }`, lanza un `ErrorApi` con esos datos; si la API no responde,
  muestra «No pudimos conectar con el servidor. Intenta de nuevo».
- **Rechazos:** un cobro Rechazado o Fallido no es un error: llega como cobro con
  `motivo.mensaje`, y la pantalla muestra ese texto tal cual. Los textos viven en la API (P-16).
- **`llaveIdempotencia`:** un `crypto.randomUUID()` por intento de cobro. Se crea cuando se muestra
  el formulario y se reutiliza en el doble clic y en los reintentos (HU-10).
- **Montos:** siempre llegan como texto en unidades mínimas con su moneda. `formatMonto` usa la
  escala para formatear sin pasar por `float`: COP sin centavos («$230.000»), como en los
  wireframes. La web nunca envía montos para un cobro: los calcula el backend (RN-05 y RN-11).
- **`usePolling(fn, intervalo, activo)`:** consulta mientras la vista está abierta, se detiene en un
  estado final o al salir de la vista, y hace pausa si la pestaña está oculta.

| Qué se consulta | Cada cuánto | Hasta cuándo |
|---|---|---|
| Estado del cobro (punto y beneficiario) | `POLL_INTERVALO_MS` = 1 s, leído de `GET /config` | Pagado, Fallido o Rechazado |
| Tablero | 5 s, como dice el wireframe 04 (D-19) | Mientras la vista esté abierta |
| Programa esperando aprobación · cuenta por verificar | 2 s | Cambia de estado, o pasan 10 minutos |

---

## 6. Sistema visual (identidad de Tatú)

Los wireframes eran de baja fidelidad y en escala de grises. La identidad visual (P-17) ya está
aplicada: paleta, logo y tipografía salen del manual y del prototipo del equipo (detalle y hallazgos
en [Plan identidad visual](./Plan%20identidad%20visual.md)). Desde el 14 oct 2026 también hay modo
oscuro con la paleta del logo oscuro ([Plan modo oscuro](./Plan%20modo%20oscuro.md)).

| Uso | Valor | Variable del tema |
|---|---|---|
| Texto principal | Noche `#13203A` | `--foreground` |
| Botón primario, foco | Azul vivo `#2E5FE0` (texto blanco, 5,5:1); al pasar el mouse `#1E4FC8` | `--primary`, `--ring` |
| Fondo de las vistas | Arena `#F5F0E6` | `--background` |
| Tarjetas | `#FFFDF8` | `--card` |
| Avisos, teclas y fondos suaves | `#EDE5D3` | `--muted`, `--secondary` |
| Texto secundario | `#4A5468` y `#5A657A` | `--muted-foreground`, `--tenue` |
| Bordes | `#E2D8C4`; de controles `#847A66` | `--border`, `--input` |
| Enlaces | `#1E4FC8`; al pasar el mouse Noche | `--enlace` |
| Acentos de marca (íconos, no texto) | Noche, Ámbar `#F6A623`, Arcilla `#6E4630` | `--noche`, `--ambar`, `--arcilla` |
| Radios | 14 px en tarjetas y botones, 999 px en etiquetas | `--radius` |
| Tipografía | Archivo (variable, con eje de ancho; el logotipo en 800 al 125 %) y cifras tabulares; IBM Plex Mono en direcciones de wallet y referencias (`SUB-0002`) | `--font-sans`, `--font-mono`, utilidad `marca` |

Contrastes sobre arena / sobre `#EDE5D3`: `#4A5468` 6,7 / 6,1, `#5A657A` 5,2 / 4,7 y `#1E4FC8`
6,2 / 5,6, todos AA. `#847A66` da 3,7 / 3,4: sirve para bordes y controles (3:1), **nunca para
texto**.

Estados del cobro, siempre con ícono y texto, nunca solo color: **Pagado** sólido en `#1B7F4B` con
texto blanco (5,0:1; como texto verde se usa `#17703F`, 5,4:1); **Pagando** en Arcilla sobre
`#FCE3B4` (6,5:1); **Rechazado** y **Fallido** en `#A3261C` sobre `#F8E4DF` (6,0:1).

**Tamaños (RNF-04):** texto base de 16 px; montos principales de 36 a 40 px (nunca menos de 24 px);
botón primario de 19 px en negrita con 16 px de relleno; teclas del PIN de 60 px de alto; todo lo
que se toca, de 44 × 44 px o más.

---

## 7. Componentes compartidos

| Componente | Qué hace | Dónde |
|---|---|---|
| `Encabezado` | Logo (cuadro negro y «Tatú»), quién soy y «Cambiar rol»; variante de escritorio y de celular | Todas |
| `NavInferior` | Inicio, Mi cuenta e Historial | Beneficiario |
| `PasosPrograma` | Borrador → Esperando aprobación → Activo → Cerrado, con el paso actual resaltado | Entidad 1, 2 y 6 |
| `CifraGrande` | Etiqueta, monto grande y texto de apoyo | Tablero, cierre, «Tienes» |
| `Monto` | `formatMonto`, con la moneda visible cuando no es COP | Todas |
| `EstadoCobro` | Etiqueta con ícono y texto: Pagado, Pagando, Rechazado · motivo, Fallido · motivo | Tablero, detalle, punto |
| `PasosDelPago` | Solicitado → Pagando → Pagado · n s (o PIN confirmado → Pagando → Pagado) | Beneficiaria 4, Punto 3 |
| `LineaDeTiempo` | Eventos en orden, con hora (hh:mm:ss) y texto | Detalle del cobro |
| `TecladoPin` | Teclado de 3 × 4 (1 a 9, «Borrar», 0, «Limpiar»), 4 puntos con `aria-label` («2 de 4 dígitos»), etiquetas de voz por tecla, como el wireframe 15 | Punto 2 |
| `CuentaRegresiva` | Tiempo para confirmar el PIN (120 s), desde `confirmarAntesDe` | Punto 2 |
| `EsperaPagando` | «Pagando…»; pasados 10 s, «Está tardando más de lo normal. No entregues el efectivo todavía» (P-18) | Punto 3, Beneficiaria 4 |
| `TarjetaRechazo` | Título con el mensaje, explicación, «No entregues efectivo.» y los datos del intento | Punto, rechazos |
| `BilleteraCorta` | `https://ilp.interledger-test.dev/ana` → `…/ana`, en fuente mono | Varias |

---

## 8. Vistas: lo que no se puede perder

Los textos son los de los wireframes. Lo que va entre corchetes en ellos (fechas, montos, «[n] s»)
sale de la API.

### Entidad (escritorio)

- **Conectar programa (02):**
  - Cuatro secciones: datos del programa, cuenta del programa, liquidación y puntos de retiro, más
    un resumen a la derecha («Borrador · Todavía no se mueve dinero»).
  - La wallet acepta el formato `$…`; al salir del campo se valida con `GET /billeteras/resolver` y
    aparece «Cuenta encontrada» con la moneda y la escala, o «No encontramos esa cuenta» (HU-01).
  - El tipo «Bono con destino» aparece deshabilitado, con la marca «extra», mientras `EXTRA_BONO`
    esté apagado.
  - «Conectar liquidación de prueba» muestra «3 cédulas · $690.000» y el texto «Este total será el
    tope del permiso que apruebas en tu banco».
  - «Agregar punto» advierte cuando la moneda no coincide (HU-03).
  - «Guardar y seguir» crea el programa y lleva a Aprobar.
- **Aprobar en el banco (03):**
  - La tarjeta «El permiso que vas a aprobar» muestra el tope, la cuenta que paga, a quién puede
    pagar y la vigencia, y aclara que el permiso fija un límite y no reserva la plata.
  - «Aprobar en mi banco» abre la Test Wallet en otra pestaña y pasa a «Esperando tu aprobación en
    el banco…», con «Abrir mi banco otra vez» y «Cancelar».
  - Si se rechaza o vence: «No aprobaste el permiso; puedes intentarlo de nuevo». Cuando el programa
    queda Activo, se pasa al tablero.
- **Tablero (04):**
  - Arriba, «Activo · Se actualiza cada 5 s», con «Pausar» (o «Reanudar») y «Cerrar programa».
  - Tres cifras: Autorizado; Cobrado («Leído del permiso en tu banco · n cobros», o la aclaración de
    que lo calculó la plataforma si la API manda `fuente: "plataforma"`); y Todavía no ha salido.
  - La barra «Cobrado 67 % · Tope $690.000», los cobros por canal, el reembolso al punto en
    segundos, «Plata girada por adelantado $0» y las cédulas sin cobrar.
  - La tabla de cobros tiene los filtros Todos, Pagados y Rechazados y fallidos, y las columnas
    Referencia, Persona, Canal, Dónde, Monto, Estado, Hora y Detalle. Los rechazados muestran «—» en
    la referencia (D-04).
- **Detalle del cobro (05):** la línea de tiempo con cada transición y su texto, los datos del cobro
  y el reembolso al punto en segundos después del PIN.
- **Cerrar (06):** «¿Cerrar el programa?», lo cobrado y lo que se queda en la cuenta. El botón solo
  se habilita al escribir CERRAR: es la doble confirmación de HU-17. Si hay cobros en Pagando, se
  avisa y se espera.
- **Programa cerrado (07):** «Nunca salió de tu cuenta $230.000 · No hay nada que reintegrar», las
  cifras de autorizado, cobrado y girado por adelantado ($0), el resumen por resultado, y el aviso
  de que todo cobro nuevo se rechaza.

### Beneficiario (celular, 390 px)

- **Inicio (08):**
  - «Hola, Ana», «Tienes $230.000», el programa y «Puedes cobrarlo hasta el…».
  - Dos opciones: «A mi cuenta» (solo con la cuenta Verificada; si no, lleva a enlazarla) y «En un
    punto».
  - Debajo, «Tu cuenta …/ana está verificada · Cambiar». Si ya cobró, se muestra el historial.
- **Enlazar cuenta (09):**
  - Tres pasos: Tus datos, Tu billetera y Lista. La cédula viene del rol; se pide la dirección de la
    billetera y el PIN («Así nadie puede enlazar su cuenta a tu cédula»).
  - En PorVerificar: «Aprueba en tu billetera», con «Abrir mi billetera» e «Intentar de nuevo».
  - Al quedar Verificada: «Tu cuenta está lista para recibir pagos».
- **Cobrar a mi cuenta (10):** «Vas a recibir $230.000», de dónde y a qué cuenta, con «No necesitas
  PIN: tu cuenta ya probó ser tuya». Un solo botón, «Cobrar $230.000» (RNF-03), y «Prefiero cobrar en
  un punto».
- **Pagado (11):** «$230.000 llegaron a tu cuenta», Solicitado → Pagando → Pagado · n s, la
  referencia, la cuenta y cuándo, y «En tu billetera aparece como un ingreso con la referencia…».
- **Dónde cobrar (12):** los tres pasos («Lleva tu cédula original…») y la lista de puntos con «Entrega
  el valor completo».
- **Historial (13):** «Tu subsidio ya fue cobrado», con cuánto, cuándo, dónde y la referencia.

### Punto (celular de la caja)

- **Nuevo cobro (14):** un campo de cédula con teclado numérico (`inputmode="numeric"`), «Pide la
  cédula original y digita el número…», «Consultar», el recordatorio «Entrega el efectivo solo
  cuando veas «Pagado»» y la lista «Cobros de hoy».
- **Confirmar con PIN (15):**
  - «Pago disponible $230.000 · Jorge · C.C. de prueba 3 · se entrega el valor completo» y «Entrega
    el celular a Jorge».
  - «Digita tu PIN», los 4 puntos, «Te quedan 3 intentos · 01:54 para confirmar», el teclado,
    «Confirmar» y «Cancelar cobro».
  - Con un PIN errado: «PIN incorrecto, te quedan 2 intentos». El PIN solo vive en el estado del
    componente: se envía una vez y se borra.
- **Pagado (16):** mientras paga, «Pagando… no entregues el efectivo todavía». Al terminar:
  «Pagado · Entrega $230.000 a Jorge · Ref. SUB-0002», los pasos, «Tu reembolso ya llegó · Recibiste
  $230.000 en tu billetera n s después del PIN» y «Nuevo cobro».
- **Rechazos (17 a 19):** el título es el mensaje que manda la API; luego la explicación, «No
  entregues efectivo.», los datos del intento y «Nuevo cobro».

---

## 9. Móvil y accesibilidad (RNF-03, RNF-04 y RNF-08)

- Cada vista funciona a 360 px de ancho, sin desplazamiento horizontal.
- El punto resuelve un cobro en 3 pasos (cédula, PIN y resultado) y la cuenta, en un toque (RNF-03).
- En las vistas del punto y del beneficiario no aparecen palabras técnicas como grant, token o
  wallet address: se dice «billetera» o «cuenta». En la entidad sí se permite «wallet», como en el
  wireframe 02.
- Los cambios de estado (Pagando → Pagado) se anuncian con `aria-live="polite"`; al cambiar de
  pantalla, el foco va al título.
- Lighthouse de 90 o más en Accesibilidad en `/punto`, `/punto/cobros/:id` y `/beneficiario`.
- **Prueba en celulares reales** (1 Android y 1 iPhone): se abre la web por la IP local
  (`vite --host`). La aprobación en la Test Wallet vuelve a `API_BASE_URL`, que en local es
  `localhost`. Desde un celular eso no llega, así que la verificación de la cuenta (HU-07) se hace
  desde el computador, o se pone la IP local en `API_BASE_URL`. Es otra razón para el despliegue
  pendiente.

---

## 10. Extras

Quedan fuera del piloto. Si la Fase 8 pasa y se decide hacerlos, cada uno va en `src/extras/`
detrás de su bandera, leída de `GET /config`. Con todas apagadas no aparece ningún botón muerto
(RNF-10).

- HU-21, el bono en comercio (wireframe 20).
- HU-22, el QR con `qrcode.react` y `html5-qrcode` (wireframe 21). Necesita HTTPS o un túnel.
- HU-24, el contrato por hitos (wireframe 22).

Antes, el backend tiene que diseñar sus tablas (D-22).

---

## 11. Pruebas y verificación

- **Vitest** para lo puro: `formatMonto` (COP y USD, escalas 0 y 2, montos grandes) y la elección de
  pantalla según el estado del cobro.
- **Guion manual** contra la Test Wallet, con la API real:

| Paso del guion | Pantallas | Qué se mira |
|---|---|---|
| 2. La entidad conecta y aprueba | 01 → 02 → 03 → Test Wallet → 04 | El consentimiento muestra el tope de $690.000; el programa queda Activo |
| 3. Ana cobra a su cuenta | 08 → 10 → 11 | «Pagado» en 10 s o menos; el ingreso se ve en su Test Wallet con la referencia |
| 4. Jorge cobra en el punto | 14 → 15 → 16 | El reembolso llega a la wallet del punto |
| 5. Jorge otra vez | 14 → 17 | «Este subsidio ya fue cobrado» |
| 6. Rosa supera el tope | 14 → 15 → 18 | «El banco rechazó el pago: el programa llegó a su tope» |
| 7. Cierre y cobro después del cierre | 04 → 06 → 07, y luego 14 → 19 | «Nunca salió de tu cuenta $230.000»; Luis es rechazado |
| HU-07. Luis enlaza su cuenta | 09 → Test Wallet → 09 | Queda Verificada (o el plan B) |

- Además, en el modo «solo UI» (`npm run db:semilla:ui`) se revisan el tablero, el detalle y el
  cierre con datos falsos, sin depender de la Test Wallet.

---

## 12. Checklist por fase

**Fase 6: base**

- [ ] `web/` con Vite, React, Tailwind 4, alias `@` y proxy `/api` (§ 2).
- [ ] shadcn/ui iniciado y sus componentes agregados; tema con los tokens del § 6 y las fuentes.
- [ ] `Encabezado`, `NavInferior`, `contexto/Rol.tsx` y `Entrada` con datos reales de la API.
- [ ] `api/client.ts`, `usePolling`, `tipos.ts` y `formatMonto` con sus tests.
- **Hecho cuando:** se elige cualquiera de los tres roles, se recarga la página y el rol sigue ahí.

**Fase 7: vistas**

- [ ] Entidad: Conectar, Aprobar, Tablero, Detalle, Cerrar y Cerrado.
- [ ] Punto: Nuevo cobro, Confirmar con PIN y Resultado (Pagado y los 3 rechazos).
- [ ] Beneficiario: Inicio, Enlazar, Cobrar, Pagado, Dónde cobrar e Historial.
- **Hecho cuando:** los pasos 2 a 5 del guion pasan en la app contra la Test Wallet.

**Fase 8: verificación**

- [ ] El guion completo (§ 11) y los pasos 6 y 7.
- [ ] 360 px, Lighthouse de 90 o más, botones de 44 px, revisión de textos y prueba en 1 Android y
      1 iPhone (V-19).
- [ ] Resultados anotados en `docs/piloto/Resultados del piloto.md`.

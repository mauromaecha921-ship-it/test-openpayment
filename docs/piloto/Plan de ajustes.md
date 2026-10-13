# Piloto 1: plan de ajustes (probar de verdad y vistas que se adaptan)

> Parte del [plan general](./README.md). **Estado (12 de octubre de 2026): ejecutado y probado con
> pagos reales en la Test Wallet.** Resultado y evidencia en el § 7; después se agregaron la
> renovación del permiso (D-35), varios subsidios por persona y la caja del punto (§ 8, D-36).
> Responde a la primera corrida del 10 de octubre: el front quedó como una copia literal de los
> wireframes y de su guion, y no servía para lo que se quería probar: **enviar a otras wallets,
> registrar usuarios y ver que todo funcione**, en celular y en PC.

---

## 0. Diagnóstico: por qué no se pudo probar

| # | Problema | Causa | Dónde |
|---|---|---|---|
| 1 | En PC, el beneficiario y el punto se ven como un celular | `MarcoCelular` fija la columna en 480 px en **cualquier** pantalla. Medido: 480 px de ancho en una ventana de 1366 px. Se siguió al pie de la letra «Beneficiario (celular, 390 px)» del Plan frontend | `web/src/componentes/Marcos.tsx` |
| 2 | No sale ningún pago real | La API corre con la semilla `db:semilla:ui`, cuyo token es **falso** («nunca paga»), y en `api/.env` están vacías `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID`, la llave privada y las 4 `DEMO_WALLET_*`. Aunque el front estuviera perfecto, el dinero no saldría | `api/.env`, `api/src/db/semillas/solo-ui.sql` |
| 3 | No se pueden registrar usuarios | Las 4 personas (Ana, Luis, Jorge, Rosa) están fijas en la semilla, y la liquidación simulada tiene cédula, monto y PIN escritos en el código. No existe `POST /beneficiarios` | `api/src/db/semillas/base.ts`, `api/src/liquidacion/datos.ts` |
| 4 | No se puede enviar a una wallet distinta | Solo hay las wallets de la semilla (`…/ana`, `…/luis`, `…/punto-1`). Los puntos sí se pueden crear (`POST /puntos`), pero solo desde la pantalla de crear programa | `web/src/vistas/entidad/ConectarPrograma.tsx` |
| 5 | La app parece un guion, no una herramienta | La entrada lista personas fijas con textos del guion («Jorge no usa la app…») y no dice si los pagos son reales o simulados | `web/src/vistas/Entrada.tsx` |

Lo que **sí** está bien y se conserva: la API (120 pruebas), los flujos de cobro, rechazos, PIN,
pausa y cierre, y la vista de la entidad, que ya es de escritorio.

---

## 1. Lo que solo puedes hacer tú (bloquea los pagos reales)

Yo no puedo crear cuentas ni escribir llaves o contraseñas, así que este paso es tuyo. Sin él, el
plan deja todo listo y probado, pero los pagos siguen siendo simulados.

- [ ] En la [Test Wallet](https://wallet.interledger-test.dev) crear las wallets en **COP**: una del
      programa (la que paga), **al menos dos** para beneficiarios y una para el punto. Pueden ser más:
      con el registro (§ 2) cualquier wallet nueva se puede usar.
- [ ] Depositar saldo de prueba en la wallet del programa.
- [ ] Crear la llave de desarrollador de la wallet cliente y llenar `api/.env`: `OP_CLIENT_WALLET_ADDRESS`,
      `OP_KEY_ID`, `OP_PRIVATE_KEY_BASE64` (o `_PATH`) y las `DEMO_WALLET_*`.
- [ ] Con la API apagada, reiniciar la BD: `npm run db:reset -w api`. Ahora deja la BD **limpia**
      (el guion de Ana, Luis, Jorge y Rosa pasó a `db:reset:demo`); el equipo se registra en la app.

El panel de estado (§ 3, F3) te dirá en la app qué falta, sin tener que leer el `.env`.

---

## 2. Backend

| # | Cambio | Detalle |
|---|---|---|
| B1 | **Registrar beneficiarios:** `POST /beneficiarios` | Pide cédula, nombre, apellido, PIN (4 dígitos), monto y, si quieres, la wallet. Crea la persona y su fila en la liquidación. Los demás campos obligatorios del esquema (fechas, municipio, autorización de datos) se llenan con valores ficticios del piloto. Si llega wallet, se valida con `resolverWallet` y queda la cuenta lista para el flujo de enlace que ya existe (HU-07) |
| B2 | **La liquidación sale de la BD** | Nueva tabla `liquidacion_pago` (documento, monto, PIN con hash `scrypt`, novedad). El simulador lee de ahí en lugar de la lista fija; la semilla carga las 4 personas de siempre. Si el programa ya está aprobado, la persona nueva entra como **novedad** (RN-08): no cuenta para el tope, y el banco puede rechazarla si lo pasa. Eso también es algo que vale la pena probar |
| B3 | **Listar beneficiarios con su estado:** `GET /beneficiarios` | Cédula, nombre, cuenta (estado y wallet), monto y si ya cobró. `GET /beneficiarios/demo` sigue funcionando |
| B4 | **Modo de pagos en `/salud` y `/config`** | Agrega `pagosReales: true/false` y, cuando es `false`, la razón: «falta OP_KEY_ID», «la llave no coincide», «el programa tiene token falso»… |
| B5 | Pruebas | Pruebas nuevas para B1 a B4 (cédula repetida, PIN inválido, wallet que no existe, moneda distinta, novedad sobre el tope). Las 120 actuales deben seguir en verde |

---

## 3. Frontend

### F1. Vistas que se adaptan a celular y PC

Un solo marco, `MarcoApp`, reemplaza a `MarcoCelular` y cambia en **768 px** (`md:` de Tailwind):

| | Celular (< 768 px) | PC y tablet (≥ 768 px) |
|---|---|---|
| Encabezado | Logo, nombre y «Cambiar rol» | Barra completa como la de la entidad, con las secciones del rol |
| Navegación del beneficiario | Barra inferior (como hoy) | Pestañas en el encabezado; desaparece la barra inferior |
| Ancho | Toda la pantalla | Contenido de hasta 1200 px, en columnas |
| Beneficiario · Inicio | Una columna | Izquierda: saldo y cómo cobrarlo. Derecha: cuenta, último cobro e historial |
| Punto · Nuevo cobro | Una columna | Izquierda: cédula y «Consultar». Derecha: cobros de hoy |
| Punto · PIN | Teclado a todo el ancho | Teclado en una tarjeta centrada, más el teclado físico (ya lo soporta) |
| Entidad · Tablero | La tabla se convierte en tarjetas | Tabla, como hoy |

Se revisa en 375, 768, 1366 y 1920 px, sin scroll horizontal.

### F2. Registro y gestión (lo nuevo para probar)

- **Personas** (`/entidad/personas`): tabla de beneficiarios (B3) y el formulario «Registrar
  beneficiario» (B1). La wallet se valida al salir del campo, como en «Conectar programa».
- **Puntos** (`/entidad/puntos`): lista y «Agregar punto», con la wallet que quieras, sin tener que
  crear un programa.
- **Entrada:** el beneficiario y el punto se eligen de lo que hay en la BD (no de una lista del
  guion), con un buscador por cédula y un enlace «Registrar nuevo». Se quitan los textos del guion.

### F3. Panel de estado

En la entrada y en el encabezado: una etiqueta **«Pagos reales»** o **«Pagos simulados»** (B4). Al
abrirla, muestra qué falta: llave, wallets o token. Así, si algo no se mueve, sabes de inmediato si
es la configuración o un error.

### F4. La API simulada del navegador

Recibe los mismos endpoints nuevos (en memoria), para que `web-simulada` no se rompa. Sigue siendo
solo para ver pantallas.

---

## 4. Cómo lo verifico y cómo lo pruebas tú

**Yo, antes de entregarte** (sin credenciales, con la API real y el doble de Open Payments de las
pruebas): pruebas de la API en verde, tipos y build de la web, y en el navegador cada pantalla a
375 y a 1366 px, registrando una persona y un punto nuevos y cobrando de las dos formas. Te paso
capturas.

**Tú, con la Test Wallet** (después del § 1), en este orden:

1. El panel dice «Pagos reales».
2. Entidad: crear el programa con la wallet que paga y aprobarlo en la Test Wallet.
3. Registrar un beneficiario con **otra** wallet, enlazar la cuenta y cobrar a la cuenta. En la Test
   Wallet, el saldo llega a esa wallet.
4. Registrar un punto con **otra** wallet, cobrar en el punto con cédula y PIN. El reembolso llega
   a la wallet del punto.
5. Rechazos: cobrar dos veces, PIN errado tres veces, programa pausado y cerrado, y una persona
   nueva que pase el tope.
6. Lo mismo desde el celular, abriendo la web en la red local (`npm run dev:host -w web`).

---

## 5. Decisiones (tomadas el 10 de octubre)

1. **Registrar usuarios = la cédula y la wallet de la persona.** Sin login (HU-19). El nombre sale
   del nombre público de la wallet si no se escribe. El PIN es **opcional**: sin él la persona
   cobra a su cuenta, pero no en un punto (la API responde `SinPin`) ni lo necesita para cambiar su
   cuenta. La cuenta queda Verificada al registrarse: la registra el mismo equipo con su wallet.
2. **Enviar dinero entre el equipo, por el flujo real.** Un miembro crea un programa con **su**
   wallet (paga) y el **monto por persona**, lo aprueba en su Test Wallet, y los demás cobran a su
   wallet o en un punto. Cualquiera puede crear otro programa con su wallet, así que el dinero va en
   cualquier dirección. No hay «envío libre»: se saltaría las reglas y descuadraría el tablero.
3. **Preparar los pagos reales:** BD limpia por defecto, página «Estado de los pagos», lectura de
   wallets sin llave (es pública) y el arreglo de HTTPS de D-32.

---

## 6. Orden

| Paso | Qué | Resultado visible |
|---|---|---|
| 1 | F1: vistas que se adaptan | Ya puedes usar la app bien en PC |
| 2 | B1 a B5: registro, liquidación en BD y modo de pagos | API lista, con pruebas |
| 3 | F2 y F3: personas, puntos, entrada y panel de estado | Registras y ves si los pagos son reales |
| 4 | F4 y verificación (§ 4) | Te entrego con capturas |
| 5 | Tú llenas `api/.env` (§ 1) y probamos juntos los pagos reales | Dinero moviéndose entre wallets |

Hallazgos para `docs/` que salen de aquí, ya anotados en [Resultados](./Resultados%20del%20piloto.md):
**D-30** («móvil primero» se leyó como «solo móvil»), **D-31** (el mínimo para inscribir a alguien),
**D-32** (HTTPS bloqueado por el antivirus) y **D-33** (las wallets de la semilla «solo UI» son de
otras personas).

---

## 7. Resultado (10 de octubre de 2026)

| Parte | Estado | Evidencia |
|---|---|---|
| F1 · Vistas que se adaptan | ✅ | En 1366 px el beneficiario y el punto usan 1200 px en dos columnas y la barra de abajo pasa al encabezado; en 375 px, una columna, sin scroll horizontal. Medido en el navegador |
| B1 a B4 · Registro, liquidación en la BD, monto por persona, `/estado` | ✅ | `npm test -w api`: 133 pruebas en verde (13 nuevas en `beneficiarios/registro.test.ts` y `liquidacion/datos.test.ts`) |
| F2 y F3 · «Equipo de prueba», «Estado de los pagos», entrada sin guion | ✅ | Contra la API real: wallet inexistente → «No encontramos esa cuenta»; `/estado` lista lo que falta |
| F4 · API simulada | ✅ | En el navegador: registrar (con y sin PIN) → crear programa de $10.000 por persona (tope $50.000) → aprobar → cobrar a la cuenta (Pagado en 3,5 s) → retiro con PIN (Pagado en 2,6 s); sin PIN, «Esta persona no registró un PIN» |
| Pagos reales en la Test Wallet | ✅ | 10 a 12 de octubre, con wallets del equipo en COP: aprobación con callback real, cobro a la cuenta, retiro en el punto (reembolso en 3,9 s en promedio) y renovación del permiso |

---

## 8. La caja del punto (hallazgo D-36, 12 de octubre)

**Vacío en los documentos:** ninguna historia le da al punto una vista de cuánto entregó y cuánto le
reembolsaron. Las cifras «reembolso en segundos» y «plata girada por adelantado: $0» solo están en
el tablero de la **entidad** (HU-15), y HU-12 manda al punto a mirar su Test Wallet. Para el pitch es
justo lo que prueba el beneficio del punto. Historia propuesta para el equipo:

> **HU-26 · Ver mi caja (punto).** Como punto de retiro, quiero ver cuánto efectivo entregué y cuánto
> me reembolsaron, para saber que recuperé todo sin girar plata por adelantado.

| Parte | Qué |
|---|---|
| API | `GET /puntos/:id/resumen?desde=hoy\|7d\|todo`: entregado (retiros Pagados, que son a la vez lo reembolsado a su wallet), pendiente (en Pagando: todavía no se entrega), cobros pagados, rechazados y en curso, promedio de segundos del PIN al reembolso y girado por adelantado ($0). `GET /puntos/:id/cobros` acepta también `desde=7d` y `desde=todo` |
| Web | Navegación del punto (como la del beneficiario): **Nuevo cobro** y **Mi caja**. En «Nuevo cobro», una franja con lo de hoy. «Mi caja»: el resumen con filtro de periodo y el historial con filtro por estado; cada cobro abre su detalle (`/punto/cobros/:id`) con la referencia para buscarla en la Test Wallet |
| Pruebas | Un punto con un retiro pagado, uno rechazado y uno en curso: el resumen cuadra y los filtros funcionan |

---

## 9. Prueba del 13 de octubre: alguien que no cobra a tiempo

**Pregunta:** si una persona no cobra antes de que el programa cierre (o venza), ¿le sigue
apareciendo?, ¿la deja cobrar?, ¿lo puede cobrar en el próximo ciclo? Lo que hace la app hoy está
comprobado con pruebas automáticas (`api/src/programas/no-cobrado.test.ts`); mañana se confirma con
la Test Wallet.

**Preparación (hoy):** en «Equipo de prueba», **Poner PIN** a Juan Pablo (para probar el punto). Si
se quiere probar el caso B, crear hoy un programa «Prueba vencimiento» con **vigencia fin = hoy**,
$10.000 por persona, y aprobarlo; mañana ya estará vencido sin que nadie lo cierre.

| Caso | Pasos | Qué debería pasar (comportamiento actual) |
|---|---|---|
| **A · Se cierra sin que cobre** | Juan Pablo no cobra en «programa 4» ($20.000). La entidad lo cierra (escribe CERRAR) | Tablero: «Nunca salió de tu cuenta: $20.000». Juan Pablo **ya no lo ve** en su inicio (solo los programas abiertos). En el punto, «programa 4» ya no aparece; si no queda ningún programa abierto, el retiro sale rechazado: «El programa está cerrado y ya no recibe cobros» |
| **B · Vence la vigencia sin cerrar** | Al día siguiente de «Prueba vencimiento», Juan Pablo entra y el punto digita su cédula | Juan Pablo **todavía lo ve** («hasta el 12 de octubre»), pero al cobrar sale «El programa no está recibiendo cobros». El punto no lo ofrece |
| **C · Próximo ciclo** | Después del caso A, la entidad crea un programa nuevo (otro ciclo) | Juan Pablo solo ve el monto del ciclo nuevo: **lo no cobrado no se acumula**. Ese dinero nunca salió de la cuenta de la entidad |

**Vacíos y decisiones para el equipo (D-37):**

1. **Tras el cierre, la persona no recibe ninguna explicación:** el subsidio simplemente desaparece.
   Propuesta: en su historial, «No alcanzaste a cobrar $20.000 de programa 4: cerró el 13 de octubre».
2. **Con la vigencia vencida se muestra como si se pudiera cobrar.** Propuesta: mostrarlo como
   «venció» y no ofrecer «Cobrar», o cerrar el programa solo al vencer la vigencia.
3. **¿Lo no cobrado pasa al siguiente ciclo?** Los documentos no lo definen (la Guía solo menciona
   que hoy existen «prórrogas o ciclos acumulados»). Opciones: (a) no se acumula: lo no cobrado nunca
   salió y el ciclo nuevo trae su propio monto; (b) la entidad lo incluye en el siguiente ciclo como
   novedad, sumado al tope que aprueba; (c) prórroga: extender la vigencia del mismo programa. La app
   hoy hace (a). Es una decisión de negocio con la entidad, no técnica.

---

## 10. Pendiente (para no olvidar): bonos con destino y el punto más cercano

**Estado: sin empezar; solo anotado el 12 de octubre de 2026.** Los dos son extras: según la Guía,
solo se empiezan si el flujo principal pasa la puerta del viernes a las 17:15.

### A · Bonos con destino (HU-21, extra 1, wireframe 20)

**Qué es:** un programa tipo **bono** que no se cobra a la cuenta ni en efectivo: se **redime en
comercios autorizados** como parte del pago de una compra. Ejemplo de las Historias: compra de
$80.000, bono de $60.000 → el comercio recibe $60.000 del programa y el cliente paga $20.000.

| Ya existe en el piloto | Falta |
|---|---|
| Tipo `bono` y destino `restringido` en el programa (apagado con `EXTRA_BONO`) | **Elegir los comercios autorizados** al crear el bono: pantalla y endpoint para llenar `programa_punto` (hoy la tabla existe, pero nada la llena) |
| Canal `compra` en los cobros, con `totalCompra` | **Vista del comercio** (wireframe 20): total de la compra → cédula → «el bono cubre $60.000, cobra $20.000 al cliente» → PIN → Pagado |
| Regla RN-03: un bono solo se paga en un comercio autorizado, nunca a la cuenta ni en retiro | **Beneficiario:** «Dónde puedo usar mi bono», con la lista de comercios autorizados (no todos los puntos) |
| Regla RN-05: el bono paga `min(valor del bono, total de la compra)` | Registrar comercios como tipo `compra` en «Equipo de prueba» (el campo `tipo` ya existe) |
| Tabla `programa_punto` (comercios por programa) | Pruebas de punta a punta y el rechazo «Este comercio no acepta este bono» |

**Decisiones para el equipo:**

1. **¿Qué comercios?** Para la demo, uno o dos de prueba (por ejemplo, «Tienda de alimentos» y
   «Droguería») con wallets del equipo. En la historia real: ¿la entidad elige comercios uno por uno,
   o por categoría (alimentos, medicamentos, útiles)? Por categoría escala mejor, pero es más trabajo.
2. **¿Un bono se gasta de una vez o en varias compras?** Las Historias suponen una sola compra
   (`min(bono, total)`); si sobra, se pierde. Gastarlo por partes cambia el modelo (saldo por persona).
3. **¿Quién pone el resto de la compra?** El cliente, en efectivo o con su tarjeta, por fuera de Tatú.

**Esfuerzo estimado:** medio día (backend 2 a 3 h; vistas del comercio, del beneficiario y de la
entidad 4 a 5 h), porque las reglas ya están.

### B · «Activa tu ubicación» para ver el punto o comercio más cercano

**No está en los documentos** (la vista «Dónde cobrar» dice «Puntos cerca», pero solo es la lista de
todos). **No escapa al alcance: es un extra pequeño**, y queda bien en el pitch («Ana ve que el
punto más cercano está a 300 m»).

| Parte | Qué haría falta | Esfuerzo |
|---|---|---|
| Ubicación de cada punto | Dos columnas (`latitud`, `longitud`) en `punto`. Al registrar el punto, un botón «Usar mi ubicación actual» (el tendero está en su tienda). Sin servicios externos de mapas | 1 h |
| Ubicación de la persona | Botón «Activar mi ubicación» en «Dónde cobrar» (y en «Dónde usar mi bono»): la API de geolocalización del navegador, que pide permiso | 30 min |
| Ordenar por cercanía | La distancia se calcula **en el navegador** (fórmula de Haversine): «a 350 m», «a 2,1 km». La ubicación de la persona **nunca sale de su celular** ni se guarda | 1 h |
| Mapa (opcional) | Un mapa con los puntos (Leaflet con OpenStreetMap). Más vistoso, pero suma una dependencia externa | 2 a 3 h |

**Ojo:** el navegador solo da la ubicación en **HTTPS** o en `localhost`. En el PC funciona; en un
celular conectado por la red local (`http://192.168…`) no. Es el mismo requisito de la cámara para el
QR (HU-22), así que se resuelve igual: el despliegue público con HTTPS (HU-25) o un túnel.

**Sin la ubicación, nada se rompe:** si la persona no da permiso, la lista sale como hoy.

---

## 11. Bonos con destino y comercios verificados (fases 1 y 2, 12 de octubre)

**Estado: construido el 12 de octubre** (158 pruebas de la API en verde; falta probarlo con la Test Wallet). **Decidido:** fases 1 y 2 juntas; la ubicación (fase 3) queda para después. Con las recomendaciones:
el bono se gasta en **una sola compra** (Historias, RN-05) y el modelo es **comercio → sedes**
desde el inicio. Idea de Sebastián: el gobierno entrega los datos de los beneficiarios y **verifica
los comercios** cruzando lo que registran con el RUT (DIAN) y el RUES (Cámaras de Comercio). En el
piloto esa verificación se **simula** con un botón de la entidad: la DIAN no tiene una API abierta.

| Parte | Qué |
|---|---|
| Comercio | NIT, razón social y actividad económica (código CIIU del RUT) → **categoría** (alimentos, salud, educación…). Queda «por verificar» hasta que la entidad lo verifica |
| Sede | Cada tienda del comercio es un punto de tipo `compra`, con su nombre, su dirección y **su propia wallet**. Una cadena (Éxito) tiene varias sedes; en la Test Wallet sus wallets pueden estar en la misma cuenta, así el dinero de todas las tiendas llega a un solo saldo |
| Bono | Programa tipo `bono` con las **categorías** que acepta (por ejemplo, alimentos). Lo aceptan las sedes de comercios **verificados** de esas categorías. El monto por persona es el valor del bono |
| Compra | El comercio digita el total y la cédula → «el bono cubre $X, cobra $Y al cliente» → PIN → Pagado: el programa le paga $X a la wallet de la sede |
| Rechazos | «Este comercio no acepta este bono» (no verificado o de otra categoría) y «Este bono solo se usa en comercios autorizados» (a la cuenta o en retiro) |
| Beneficiario | En su inicio, el bono dice «Úsalo en un comercio autorizado» y lleva a la lista de sedes donde se acepta |
| API | `GET /categorias`, `GET` y `POST /comercios`, `POST /comercios/:id/sedes`, `POST /comercios/:id/verificar`, `GET /programas/:id/comercios`; `categorias` en el programa; el tablero cuenta el canal «compra» |

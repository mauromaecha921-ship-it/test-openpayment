# Tatú: resumen para el equipo

> **Léelo primero.** Este documento junta lo importante para el hackathon (Medellín, 16 y 17 de
> octubre de 2026): qué es Tatú, qué ya probamos con dinero de prueba real, qué aprendimos y qué
> decidir antes del evento. Los demás documentos de `docs/` son el detalle y el contexto para la IA;
> no hace falta leerlos para entender el proyecto. Actualizado el **14 de octubre de 2026** (despliegue
> en Vercel con Supabase, § 2 y § 5; cobro a la llave Bre-B, § 1).
>
> **Está basado en lo que se construyó y probó en el piloto** (10 a 14 de octubre): primero la rama
> `piloto` (SQLite, en local) y ahora **`piloto-v2`** (Supabase, desplegada en Vercel en
> <https://test-openpayment.vercel.app>). Es un piloto desechable con pagos reales en la Interledger
> Test Wallet. El código del evento se escribe desde cero.

---

## 1. Tatú en un minuto

Hoy el Estado le gira al operador todo el subsidio antes del ciclo, el operador lo reparte a sus
puntos (Efecty, Punto Red…), la gente tiene una ventana fija para cobrar y lo que no se cobra se
reintegra días después. **Tatú cambia eso con Open Payments (Interledger):**

1. **La entidad (el gobierno) aprueba una sola vez**, en su banco, un permiso con tope: «la app
   puede pagar hasta $X desde mi cuenta». Eso **no mueve dinero**.
2. **Cada beneficiario cobra cuando quiere:** a su propia wallet (llega en segundos) o en efectivo en
   un punto, con su cédula y su PIN.
3. **El punto entrega el efectivo y recibe el reembolso en segundos**, en el mismo momento. Nunca
   pone plata por adelantado.
4. Lo que nadie cobra **nunca salió** de la cuenta de la entidad: no hay reintegros.

| Rol | Quién es en la demo | Qué hace en la app |
|---|---|---|
| Entidad | El gobierno (la wallet que paga) | Crea el programa, aprueba el tope en su banco, ve el tablero, pausa, cierra |
| Beneficiario | Quien recibe el subsidio | Ve cuánto tiene, cobra a su llave Bre-B (o a su wallet) o va a un punto |
| Punto de pago | Un Efecty o Punto Red | Digita la cédula, la persona pone su PIN, entrega el efectivo y ve su caja |

Lo que el jurado debe recordar es **el movimiento de la plata**, no las pantallas.

### Lo nuevo (13 de octubre): cobrar a la llave Bre-B

Casi nadie en Colombia tiene una wallet Open Payments, pero 33,9 millones de clientes ya tienen una
**llave Bre-B** (cédula, celular, correo o @alias; documento técnico de Bre-B, febrero de 2026). La
lección de Bizum es que la gente adopta un medio de pago cuando no tiene que aprender nada nuevo.
Por eso:

- **El beneficiario cobra a la llave que ya tiene.** Si su cédula es llave Bre-B, pulsa «Cobrar» y
  ya: no enlaza nada. Sin cuenta, sigue cobrando en un punto con su cédula.
- **Tatú sigue hablando solo Open Payments.** Un **banco puente** (un banco o SEDPE en Bre-B con
  Rafiki) publica una wallet address por llave y entrega la plata por Bre-B. En la demo el puente
  es **simulado** y se dice así.
- **La plata sale de una wallet Open Payments y llega a una llave.** La cuenta de la entidad no
  puede ser una llave: Bre-B no da permisos con tope.
- **Para el jurado:** «Bre-B es la carretera; Tatú decide quién pasa, cuándo y cuánto» y «Tatú no le
  paga a un alias, le paga a una persona».

Reglas RN-14 a RN-18, HU-07 y HU-09 actualizadas, decisión AD-21 y respuestas ensayadas en la Guía.
Plan y diagrama: [`piloto/Plan Bre-B.md`](./piloto/Plan%20Bre-B.md).

---

## 2. Qué ya funciona con dinero de prueba real (piloto, 10 a 12 de octubre)

Armamos un **piloto desechable** (nunca se mezcla a `main`, porque la Guía descalifica el código
hecho antes del evento). La primera versión (rama `piloto`) usó SQLite en local; la actual
(**`piloto-v2`**) usa **Supabase** (PostgreSQL) y está **desplegada en Vercel**: la web y la API en
un solo dominio, sin instalar nada. Lo probamos contra la **Interledger Test Wallet** con wallets
del equipo, todas en **COP**:

| Rol | Persona |
|---|---|
| Entidad (paga, y su wallet es también la cliente de la app) | Sebastián |
| Beneficiario | Juan Pablo |
| Punto de pago | Fernando |

Las direcciones de las wallets y la llave quedan fuera del repo (convención del equipo); viven en
las variables del proyecto en Vercel (o en el `.env` de cada PC, en local) y en la app («Equipo de prueba»).

**Probado de punta a punta, con la plata moviéndose en la Test Wallet:**

- ✅ Registrar personas con **cédula y wallet** (el PIN es opcional) y puntos con cualquier wallet.
- ✅ Crear un programa con **monto por persona**; el tope es la suma de las personas registradas.
- ✅ La entidad aprueba **una vez** en su Test Wallet y vuelve sola a la app.
- ✅ **Cobro a la cuenta:** el dinero va de la wallet de Sebastián a la de Juan Pablo en segundos.
- ✅ **Retiro en el punto:** cédula → PIN → «Pagado» → reembolso a la wallet de Fernando en **3,9 s** en promedio.
- ✅ Una persona con **varios subsidios** (de varios programas) los ve todos y cobra cada uno por
  separado; el punto pregunta cuál pagar.
- ✅ **El permiso dura lo que dure el programa:** la app renueva el token sola (ver § 4).
- ✅ **«Mi caja» del punto:** «entregaste $110.000, te reembolsaron $110.000, pusiste por
  adelantado $0».
- ✅ Rechazos claros: ya cobrado, PIN errado, programa pausado o cerrado, permiso vencido.
- ✅ Vistas que se adaptan a **PC y celular**.
- ✅ **Bonos con destino** en comercios verificados por categoría (construido; falta probarlo con la Test Wallet).
- ✅ **Desplegado en Vercel** con la base en Supabase: <https://test-openpayment.vercel.app>. La
  entidad puede aprobar desde cualquier equipo, porque el banco devuelve a una URL pública.
- ✅ 185 pruebas automáticas de la API y 20 de la web, en verde (14 de octubre).

---

## 3. Cómo funciona el dinero (lo que hay que poder explicar)

```text
Entidad ── aprueba una vez un permiso con tope ($20.000) ──▶ su banco (Test Wallet)
                                                              │
Beneficiario pulsa «Cobrar» ─▶ la app crea un pago ─▶ sale de la wallet de la entidad
                                                    └─▶ llega a la wallet del beneficiario
Punto digita cédula + PIN ─▶ la app crea un pago ─▶ sale de la wallet de la entidad
                                                    └─▶ llega a la wallet del punto (reembolso)
```

- **Permiso con tope, sin destinatario fijo.** Un solo permiso sirve para pagarle a cualquier
  beneficiario o punto. Quién cobra y cuánto lo controla la app (con el registro); que no se pase
  del tope lo hace cumplir el **banco**.
- **El permiso no es el token.** El permiso lo aprueba la entidad y puede durar el mes. El **token**
  con el que la app lo usa dura **10 minutos** en la Test Wallet, y la app lo **renueva sola**.
- **«Pagado» quiere decir que el dinero ya llegó.** Por eso el punto solo entrega el efectivo
  cuando ve «Pagado», y por eso nunca pone plata por adelantado.
- **Un subsidio se cobra una sola vez por programa**, a la cuenta o en un punto, nunca los dos.

---

## 4. Lo que aprendimos (y hay que tener en cuenta en el evento)

Los cinco primeros pueden tumbar la demo si no se conocen.

1. **El token del permiso dura 10 minutos.** La app tiene que renovarlo antes de que venza. Si la
   API estuvo apagada mucho tiempo (un día), el banco ya no acepta renovarlo y hay que aprobar de
   nuevo. En local la API lo renueva cada 4 minutos; en Vercel no hay un proceso prendido, así que lo
   renueva cuando alguien usa la app. Si no puede, el tablero muestra **«Renovar permiso»**
   (aprobar otra vez por lo que falta del tope; lo cobrado se conserva). *(D-34, D-35)*
2. **Con el token vencido, la Test Wallet responde 403 «Inactive Token», no 401.** Si se toma como
   «se acabó el tope», la app muestra un error falso. Ya está corregido. *(D-34)*
3. **Un antivirus que inspecciona HTTPS bloquea a Node.** En un PC así, ninguna llamada a la Test
   Wallet sale y parece «sin respuesta». La API confía en los certificados de Windows
   (`server/src/certificados.ts`). Revisarlo en cada PC del equipo antes del evento. *(D-32)* En
   Vercel no pasa: la API corre en sus servidores.
4. **En local, la aprobación del banco vuelve a `localhost`.** Quien aprueba (la entidad) tiene que
   hacerlo en el navegador del PC donde corre la app. **En Vercel ya no pasa:** vuelve a
   `test-openpayment.vercel.app` y se puede aprobar desde cualquier equipo.
5. **Todas las wallets en la misma moneda (COP).** Una wallet en EUR o USD como entidad, beneficiario
   o punto hace que los cobros se rechacen. La Test Wallet deja tener varias wallets por cuenta.
6. **El tope se fija con las personas registradas al aprobar.** Quien se registre después queda por
   fuera del tope y su cobro puede ser rechazado por el banco: registrar a todos **antes** de aprobar.
7. **Las wallets de ejemplo de los documentos son de otras personas** (`…/ana`, `…/luis` existen,
   en EUR y USD). Nunca mandarles dinero; usar siempre las del equipo. *(D-14, D-33)*
8. **Los documentos se leyeron demasiado literal en el primer front.** «Móvil primero» no es «solo
   móvil»: todo se usa también en PC. Y para probar hacen falta pantallas que los wireframes no
   tienen: registrar al equipo, ver si los pagos son reales, la caja del punto. *(D-30, D-36)*
9. **Una persona puede tener subsidios en varios programas.** Los documentos suponen uno; la app
   ahora los muestra todos y el punto elige cuál pagar. *(D-21)*
10. **Faltaban rutas.** Las 9 rutas de la API de la Guía no alcanzan: el piloto usaba **43** (21 para
    las pantallas y 13 que salieron de probar) y hoy usa **52** (con Bre-B y el gobierno simulado). Lista completa, con qué hace cada una y de dónde salió:
    [API del piloto](./piloto/API%20del%20piloto.md). *(D-05)*

### Contradicciones en los documentos que conviene resolver

| Tema | Qué choca | Qué hizo el piloto |
|---|---|---|
| Datos personales | La BD guardaba nombres, fechas, celular… de los beneficiarios; la Arquitectura dice que no guardamos la base | **Resuelto en `main`** (12 oct): beneficiario mínimo, solo documento y wallet verificada («somos pasarela»). El piloto usó el esquema anterior *(D-01, D-31)* |
| PIN | La Guía dice «con hash»; la Arquitectura dice que no se guarda | Lo guarda la liquidación simulada, con hash *(D-07)* |
| Callback | ¿Vuelve a la web o a la API? | Vuelve a la API, que redirige a la web *(D-06)* |
| Datos de la demo | «Adulto mayor» en los wireframes, «jóvenes» de Colsubsidio en la BD | Se usó «adulto mayor» *(D-10)* |
| Cobro sin cuenta | La BD no deja guardar el rechazo «enlaza tu cuenta» si nunca tuvo una | Responde el error sin dejar cobro *(D-25)* |
| Pago completado | Open Payments no da un estado «completado» al pago saliente | Se compara lo enviado con lo debitado, o el pago entrante *(D-15)* |

---

## 5. Cómo usar y correr el piloto

### En Vercel (sin instalar nada)

1. Abrir **<https://test-openpayment.vercel.app>**.
2. **`/estado`** debe decir «Pagos reales». Si no, dice qué falta.
3. **«Equipo de prueba»** (`/equipo`): registrar a cada persona (cédula y wallet; PIN si va a cobrar
   en un punto) y los puntos.
4. **Entidad → Nuevo programa:** la wallet de quien paga y el monto por persona → aprobar en la Test
   Wallet (desde cualquier equipo).
5. Entrar como **beneficiario** y cobrar, o como **punto** y hacer un retiro.

Las llaves y la base viven en las variables del proyecto en Vercel. Cada push a la rama de producción
(`produccion`) despliega solo. Cómo funciona por dentro: Arquitectura, § 3.6.

### En local (para programar)

Requisitos: Node 24, pnpm 12.9.1 y una wallet en COP con llave de desarrollador en la Test Wallet.

1. `pnpm install` en la raíz.
2. Copiar `.env.example` a `.env` (en la raíz) y llenar `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID` y
   `OP_PRIVATE_KEY_PATH` (la llave privada va **fuera del repo**; nunca por chat).
3. **Sin `DATABASE_URL`** la API usa una base local (PGlite, en `server/data/`), separada de la de
   Vercel. Es lo recomendado para programar.
4. `pnpm --filter api db:reset` (base limpia; con la API apagada) y `pnpm dev`: API en el 3000 y
   web en el 5173. Abrir **http://localhost:5173** (la web pasa `/api` a la API, así que el
   navegador solo usa ese puerto).
5. Seguir los pasos 2 a 5 de arriba en `localhost:5173`.

> **Cuidado con la base de Vercel.** Si pones en tu `.env` la `DATABASE_URL` de Supabase, tu API
> local usa **la misma base que producción**. En ese caso, `db:reset` borra los datos de producción
> y, si las dos APIs renuevan el mismo permiso a la vez, el permiso puede quedar vencido. Usa la
> base local salvo que de verdad necesites los datos de producción.

Más detalle: [`server/README.md`](../server/README.md).

---

## 6. Qué decidir y preparar antes del evento

- [ ] **Cada persona del equipo tiene su wallet en COP** con llave de desarrollador, y quien hace de
      entidad tiene saldo de prueba.
- [ ] **Probar `pnpm dev` y `/estado` en el PC del evento** (antivirus y HTTPS, D-32), o usar la
      versión de Vercel, que no depende del PC.
- [ ] **Cambiar las llaves** que se compartieron por chat (también en las variables de Vercel).
      Nunca subir el `.env` ni la llave.
- [ ] **Decidir qué entra:** las 18 historias obligatorias ya se probaron en el piloto. Proponemos
      sumar al backlog **«Mi caja» del punto** (HU-26 propuesta), **varios subsidios por persona** y
      **«Renovar permiso»**, que salieron de probar.
- [ ] **Decidir qué pasa con quien no cobra a tiempo** (D-37): ¿se le explica que cerró?, ¿lo no
      cobrado pasa al siguiente ciclo o nunca sale? Hoy no se acumula. Prueba en
      `piloto/Plan de ajustes.md` § 9.
- [ ] **Base de datos:** el evento usa Supabase (PostgreSQL), como `piloto-v2`. El esquema está en
      `db/` de `main` (`001` a `003`: beneficiario mínimo, bloqueo por PIN y RLS). Falta sumar lo
      que el piloto necesitó: la liquidación con PIN opcional, el monto por persona, la renovación
      del permiso y la llave Bre-B (`server/src/db/migraciones/010` a `031` de `piloto-v2`).
- [ ] **Despliegue:** `piloto-v2` ya corre en Vercel (web y API en un solo dominio). Para el evento
      se puede repetir igual desde el viernes: es `vercel.json` más `scripts/build-vercel.mjs`
      (Arquitectura, AD-17 y § 3.6).
- [ ] **Actualizar la API de la Guía** con las rutas que de verdad hacen falta: la lista está en
      [API del piloto](./piloto/API%20del%20piloto.md) (§ 9: pendientes que tocan la API).
- [ ] **Reescribir en el evento** lo que haga falta: el piloto **no se copia** (regla de la Guía). Lo
      que se reutiliza son los aprendizajes de este documento.
- [ ] **Averiguar lo pendiente de Bre-B** antes del pitch (Arquitectura, P-26 a P-28): si solo el
      titular puede registrar su cédula como llave, si se puede confirmar «esta llave es de esta
      cédula» y cuándo entran los pagos de empresa a persona. No decir en el pitch nada de eso sin confirmarlo.
- [ ] **Extras** (solo si el flujo principal pasa el viernes a las 17:15): bono en comercio, QR del
      beneficiario, leer el código de barras de la cédula.
- [ ] **Bonos con destino** (extra 1): **ya construidos en el piloto**, falta probarlos con la Test
      Wallet. Un comercio se registra con su NIT y su actividad del RUT (que define la categoría:
      alimentos, salud, educación), la entidad lo verifica (en producción, con el RUT de la DIAN y el
      RUES) y cada sede tiene su wallet; una cadena como Éxito tiene varias sedes. El bono acepta
      **categorías**, se gasta en una sola compra y el cliente paga el resto. **Decidir con la
      entidad:** la lista de categorías y si el bono se puede gastar en varias compras. Detalle en
      `piloto/Plan de ajustes.md` § 11 (D-38).
- [ ] **«Activa tu ubicación» para el punto o comercio más cercano** (no está en los documentos):
      extra pequeño, de 2 a 3 h. Necesita HTTPS en el celular, como la cámara del QR. Mismo § 10.

---

## 7. Mapa de documentos (para cuando necesites el detalle)

| Si necesitas… | Lee |
|---|---|
| El producto, el alcance y el plan del evento | `Documento Guía — Hackathon Open Payments.md` |
| Las historias de usuario y sus criterios | `Historias de Usuario — Bonos con Destino.md` |
| Las reglas de negocio en corto | `Reglas de negocio.md` |
| Las decisiones técnicas | `Documento de Arquitectura — Hackathon Open Payments.md` |
| Cómo está desplegado (Vercel, Supabase, entornos y cuidados) | Arquitectura, § 3.6 |
| Cómo hablar con Open Payments | `Hallazgos — Investigación de Fuentes.md` y `ENDPOINTS.md` |
| Todos los endpoints de la API del piloto (52) y los pendientes que la tocan | [`piloto/API del piloto.md`](./piloto/API%20del%20piloto.md) · para probarlos, Swagger en <https://test-openpayment.vercel.app/api/docs> |
| Todo lo que hizo y encontró el piloto (D-01 a D-36) | `piloto/Resultados del piloto.md` y `piloto/Plan de ajustes.md` |
| Cobrar a la llave Bre-B: plan, diagrama y qué se simula | [`piloto/Plan Bre-B.md`](./piloto/Plan%20Bre-B.md) |
| Correr la API del piloto | [`server/README.md`](../server/README.md) |

**Glosario.** *Permiso (grant):* la autorización con tope que aprueba la entidad. *Token:* la llave
temporal (10 min) con la que la app usa el permiso. *Wallet address:* la «dirección» de una cuenta,
como `$ilp.interledger-test.dev/nombre`. *Novedad:* alguien que entró a la liquidación después de
fijar el tope. *Liquidación:* la lista de quién recibe cuánto (en el piloto, la llena el registro). *Llave Bre-B:* el
alias (cédula, celular, correo o @alias) con el que alguien recibe por Bre-B; apunta a una sola
cuenta. *Banco puente:* el banco con Rafiki que traduce una llave Bre-B a una wallet Open Payments.

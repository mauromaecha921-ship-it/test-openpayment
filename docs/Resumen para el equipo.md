# Tatú: resumen para el equipo

> **Léelo primero.** Este documento junta lo importante para el hackathon (Medellín, 16 y 17 de
> octubre de 2026): qué es Tatú, qué ya probamos con dinero de prueba real, qué aprendimos y qué
> decidir antes del evento. Los demás documentos de `docs/` son el detalle y el contexto para la IA;
> no hace falta leerlos para entender el proyecto. Actualizado el **12 de octubre de 2026**.
>
> **Está basado en lo que se construyó y probó en la rama `piloto`** (10 a 12 de octubre): un piloto
> desechable con pagos reales en la Interledger Test Wallet. El código del evento se escribe desde cero.

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
| Beneficiario | Quien recibe el subsidio | Ve cuánto tiene, cobra a su wallet o va a un punto |
| Punto de pago | Un Efecty o Punto Red | Digita la cédula, la persona pone su PIN, entrega el efectivo y ve su caja |

Lo que el jurado debe recordar es **el movimiento de la plata**, no las pantallas.

---

## 2. Qué ya funciona con dinero de prueba real (piloto, 10 a 12 de octubre)

Armamos un **piloto desechable** (rama `piloto`; nunca se mezcla a `main`, porque la Guía
descalifica el código hecho antes del evento) con SQLite en lugar de Supabase. Lo probamos contra la
**Interledger Test Wallet** con wallets del equipo, todas en **COP**:

| Rol | Persona |
|---|---|
| Entidad (paga, y su wallet es también la cliente de la app) | Sebastián |
| Beneficiario | Juan Pablo |
| Punto de pago | Fernando |

Las direcciones de las wallets y la llave quedan fuera del repo (convención del equipo); viven en
`api/.env` y en la app («Equipo de prueba»).

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
- ✅ 158 pruebas automáticas de la API y 20 de la web, en verde.

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
   nuevo. La app lo hace sola cada 4 minutos y, si no puede, el tablero muestra **«Renovar permiso»**
   (aprobar otra vez por lo que falta del tope; lo cobrado se conserva). *(D-34, D-35)*
2. **Con el token vencido, la Test Wallet responde 403 «Inactive Token», no 401.** Si se toma como
   «se acabó el tope», la app muestra un error falso. Ya está corregido. *(D-34)*
3. **Un antivirus que inspecciona HTTPS bloquea a Node.** En un PC así, ninguna llamada a la Test
   Wallet sale y parece «sin respuesta». La API confía en los certificados de Windows
   (`api/src/certificados.ts`). Revisarlo en cada PC del equipo antes del evento. *(D-32)*
4. **La aprobación del banco vuelve a `localhost`.** Quien aprueba (la entidad) tiene que hacerlo en
   el navegador del PC donde corre la app. Si aprueba desde otro computador, el regreso falla.
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
10. **Faltaban rutas.** Las 9 rutas de la API de la Guía no alcanzan: el piloto usa **43** (21 para
    las pantallas y 13 que salieron de probar). Lista completa, con qué hace cada una y de dónde salió:
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

## 5. Cómo correr el piloto

Requisitos: Node 24 y una wallet en COP con llave de desarrollador en la Test Wallet.

1. `npm install` en la raíz.
2. Copiar `api/.env.example` a `api/.env` y llenar `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID` y
   `OP_PRIVATE_KEY_PATH` (la llave privada va **fuera del repo**; nunca por chat).
3. `npm run db:reset -w api` (base de datos limpia; con la API apagada).
4. `npm run dev` (API y web). Abrir **http://localhost:5173**.
5. **`/estado`** debe decir «Pagos reales». Si no, dice qué falta.
6. **«Equipo de prueba»** (`/equipo`): registrar a cada persona (cédula y wallet; PIN si va a cobrar
   en un punto) y los puntos.
7. **Entidad → Nuevo programa:** la wallet de quien paga y el monto por persona → aprobar en la Test
   Wallet.
8. Entrar como **beneficiario** y cobrar, o como **punto** y hacer un retiro.

Más detalle: [`api/README.md`](../api/README.md).

---

## 6. Qué decidir y preparar antes del evento

- [ ] **Cada persona del equipo tiene su wallet en COP** con llave de desarrollador, y quien hace de
      entidad tiene saldo de prueba.
- [ ] **Probar `npm run dev` y `/estado` en el PC del evento** (antivirus y HTTPS, D-32).
- [ ] **Cambiar las llaves** que se compartieron por chat. Nunca subir `api/.env` ni la llave.
- [ ] **Decidir qué entra:** las 18 historias obligatorias ya se probaron en el piloto. Proponemos
      sumar al backlog **«Mi caja» del punto** (HU-26 propuesta), **varios subsidios por persona** y
      **«Renovar permiso»**, que salieron de probar.
- [ ] **Decidir qué pasa con quien no cobra a tiempo** (D-37): ¿se le explica que cerró?, ¿lo no
      cobrado pasa al siguiente ciclo o nunca sale? Hoy no se acumula. Prueba en
      `piloto/Plan de ajustes.md` § 9.
- [ ] **Base de datos:** el evento usa Supabase (PostgreSQL). El esquema está en `db/` de `main`
      (`001` a `003`: beneficiario mínimo, bloqueo por PIN y RLS). Falta sumar lo que el piloto
      necesitó: la liquidación con PIN opcional, el monto por persona y la renovación del permiso
      (`api/src/db/migraciones/003` y `004` de la rama `piloto`).
- [ ] **Actualizar la API de la Guía** con las rutas que de verdad hacen falta: la lista está en
      [API del piloto](./piloto/API%20del%20piloto.md) (§ 9: pendientes que tocan la API).
- [ ] **Reescribir en el evento** lo que haga falta: el piloto **no se copia** (regla de la Guía). Lo
      que se reutiliza son los aprendizajes de este documento.
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
| Cómo hablar con Open Payments | `Hallazgos — Investigación de Fuentes.md` y `ENDPOINTS.md` |
| Todos los endpoints de la API del piloto (43) y los pendientes que la tocan | [`piloto/API del piloto.md`](./piloto/API%20del%20piloto.md) · para probarlos, Swagger en `/api/docs` con la API prendida |
| Todo lo que hizo y encontró el piloto (D-01 a D-36) | `piloto/Resultados del piloto.md` y `piloto/Plan de ajustes.md` |
| Correr la API del piloto | `api/README.md` |

**Glosario.** *Permiso (grant):* la autorización con tope que aprueba la entidad. *Token:* la llave
temporal (10 min) con la que la app usa el permiso. *Wallet address:* la «dirección» de una cuenta,
como `$ilp.interledger-test.dev/nombre`. *Novedad:* alguien que entró a la liquidación después de
fijar el tope. *Liquidación:* la lista de quién recibe cuánto (en el piloto, la llena el registro).

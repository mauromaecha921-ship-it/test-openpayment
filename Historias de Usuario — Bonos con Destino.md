# Historias de Usuario — Entrega Justo a Tiempo

Sep 30, 2026 · @ITMuser

## Resumen y convenciones

El backlog tiene 25 historias en 7 épicas. Las 18 obligatorias (61 puntos) cubren un solo flujo, el del subsidio, que tiene que salir impecable; los 5 extras (25 puntos) solo se empiezan si ese flujo pasa la puerta del viernes a las 17:15. Está alineado con la revisión 83 del Documento Guía, del 2 de octubre.

**Qué somos.** La capa de distribución que convierte una liquidación ya aprobada en pagos bajo demanda. La entidad sigue decidiendo quién recibe y cuánto, y la plata sale de su cuenta solo cuando el beneficiario cobra.

**Tesis.** *La plata pública no debería salir porque llegó la fecha, sino cuando ocurre un evento válido.* Es el mismo motor con distinto evento: en un subsidio, que el beneficiario cobre; en un bono, una compra válida; en un contrato, un hito certificado.

**Qué cambió frente a la versión anterior**

- La demo es solo el subsidio: cobro a la cuenta del beneficiario y retiro en un punto con cédula digitada y PIN.
- Hay tres rechazos visibles: subsidio ya cobrado, tope superado (lo rechaza el banco) y programa cerrado.
- Bono con destino, QR con cámara, PDF417, contrato por hitos y despliegue público pasan a ser extras, en ese orden, y cada uno se puede apagar sin romper la demo.
- Las historias se renumeraron: HU-01 a HU-20 son el flujo principal y HU-21 a HU-25 los extras.
- El tablero muestra autorizado, cobrado y lo que nunca salió, y el lenguaje sigue las reglas de los datos verificados: «pendientes al cierre ordinario» (nunca «devueltos») y conciliación que «se reduce mucho» (nunca «desaparece»).
- Contexto 2026 verificado con el contrato del operador: el efectivo de Prosperidad Social lo paga la Unión Temporal de SuperGIROS y SuRed, con el ciclo abonado 3 días antes, una ventana fija de 17 días (Colombia Mayor) o 10 días, y reintegro en 3 días hábiles. El punto de la demo representa cualquier red de puntos, tipo Puntored.

**Alcance de la demo.** Un subsidio simulado de $230.000, como Colombia Mayor, con 3 beneficiarios de prueba: dos con cuenta y uno sin celular que cobra en el punto. El tope del permiso es la suma de los subsidios. Las cuentas de prueba son la del programa, las de los dos beneficiarios y la de un punto de retiro.

**Solo visión:** la huella validada por un operador autorizado por la Registraduría y la integración con SECOP II o SIIF. **No hace:** decidir beneficiarios, guardar la base de la entidad, validar huellas, manejar efectivo, integrarse con la caja del punto, usar dinero real, app nativa ni SMS.

| Elemento | Convención |
| --- | --- |
| Formato de historia | Como «actor», quiero «acción», para «beneficio» |
| Criterios de aceptación | Escenarios Dado / Cuando / Entonces; cada uno se vuelve una prueba manual o de Vitest |
| Prioridad (MoSCoW) | Must = flujo principal · Should = baja un riesgo del flujo principal · Could = extra, en el orden del Documento Guía · Won't = fuera del hackathon |
| Estimación | Puntos Fibonacci (1, 2, 3, 5, 8); referencia del equipo: 1 punto ≈ 30 min de una persona, ajustable tras el ensayo del 11 de octubre |
| Identificadores | E1–E7 épicas · HU-01 a HU-25 historias · RN reglas de negocio · RNF requisitos no funcionales |
| Roles del equipo | Rol 1 Open Payments · Rol 2 Backend · Rol 3 Punto y beneficiario · Rol 4 Entidad y diseño · Rol 5 Producto y pitch |
| Montos | Entero en unidades mínimas + `assetCode` + `assetScale`: $230.000,00 con escala 2 = `"23000000"` |

## Actores y personas

El flujo principal tiene tres actores humanos y tres sistemas, y en la demo comparten una sola web con selector de rol. El beneficiario sin celular no usa ninguna vista: le basta su cédula. Las personas son ficticias; los dolores salen de los datos verificados del Documento Guía.

| Actor | Persona de referencia | Qué necesita | Dolor hoy, con dato | Vista y dispositivo |
| --- | --- | --- | --- | --- |
| Entidad financiadora | Laura, coordinadora de un subsidio en una institución con cuenta propia | Pagar sin girar por adelantado y ver lo cobrado en tiempo real | En el ciclo 7 de Colombia Mayor de 2026, 241.830 de 2.788.074 personas seguían pendientes al cierre ordinario ([Infobae](https://www.infobae.com/colombia/2026/09/15/prosperidad-social-amplio-el-plazo-para-cobrar-los-pagos-del-septimo-ciclo-de-colombia-mayor-esta-es-la-nueva-fecha/)) | Vista Entidad en computador; aprueba el permiso en su banco (Test Wallet) |
| Beneficiaria con cuenta | Ana, 67 años, recibe un subsidio para adultos mayores y tiene billetera | Cobrar a su cuenta cuando quiera, sin ir a un punto | Menos del 1 % recibió en cuenta propia en ese ciclo; en Renta Joven 2025 se reversaron 10.000 de 160.000 abonos ([Prosperidad Social](https://prosperidadsocial.gov.co/Noticias/prosperidad-social-responde-a-inquietudes-sobre-renta-joven/)) | Vista Beneficiario en su celular: enlazar cuenta, ver «tengo $230.000» y cobrar |
| Beneficiario sin celular ni cuenta | Jorge, 72 años, recibe el mismo subsidio | Cobrar en efectivo cerca de su casa, solo con la cédula | Debe cobrar dentro de una ventana fija de 17 días; si no, el operador reintegra el giro a Prosperidad Social en 3 días hábiles (anexo técnico 2026; [El Tiempo](https://www.eltiempo.com/economia/finanzas-personales/ojo-lo-que-pasa-si-no-cobra-a-tiempo-el-giro-de-renta-ciudadana-y-devolucion-del-iva-por-hasta-500-banco-agrario-explica-3367437)) | Ninguna vista: cédula y PIN en el punto (huella en producción) |
| Punto de retiro | Marta, tendera de una red de puntos (tipo Puntored) | Entregar efectivo y recuperarlo de inmediato | Fondea su caja antes del ciclo y recibe el reembolso después | Vista Punto en el celular de la caja: cédula, monto, PIN y resultado |

En los extras aparecen tres actores más: el comercio autorizado y el no autorizado (bono con destino) y el supervisor de un contrato público que certifica hitos (contrato por hitos).

**Sistemas que participan**

- **Plataforma (nuestra API).** Aplica las reglas, guarda programas, cuentas enlazadas y cobros, y firma las peticiones Open Payments. Nunca custodia dinero ni guarda la base de beneficiarios.
- **Liquidación de la entidad (simulada).** Responde «¿esta cédula tiene un pago disponible y por cuánto?». En la demo también valida el PIN, en lugar del operador de huella.
- **ASE — Interledger Test Wallet.** Custodia la cuenta del programa y las de destino, muestra las pantallas de consentimiento, ejecuta los pagos y hace cumplir el tope del permiso (`InsufficientGrant`).

## Mapa de historias

El flujo principal atraviesa las cinco actividades con solo el subsidio, así que la demo cuenta la historia completa aunque no quede tiempo para ningún extra.

&#91;embedded content: mapa de historias · 5 actividades, 2 releases\]

Se lee de izquierda a derecha como el recorrido del dinero: la entidad conecta y autoriza, el beneficiario cobra a su cuenta o en un punto, y la entidad sigue y cierra. Debajo van las historias Should, los cinco extras numerados en el orden en que se construyen y la banda de lo que aplica a todo el flujo.

## Épicas y backlog

El cobro en el punto (E4) y el control con cierre (E5) suman 32 de los 61 puntos obligatorios. HU-04 y HU-12 forman el hito crítico del viernes 16 a las 14:00, y E7 solo se abre si el flujo principal pasa completo a las 17:15.

| Épica | Objetivo | Historias | Puntos Must / total |
| --- | --- | --- | --- |
| E1 Conexión del subsidio | La entidad conecta su subsidio sin entregarnos su base | HU-01 a HU-03 | 7 / 7 |
| E2 Autorización con Open Payments | Un solo permiso con tope, aprobado en el banco | HU-04 a HU-06 | 10 / 12 |
| E3 Cobro a la cuenta | Quien tiene cuenta cobra en segundos, cuando quiera | HU-07 a HU-09 | 10 / 10 |
| E4 Cobro en el punto | Quien no tiene celular cobra con su cédula y el punto recupera el efectivo al instante | HU-10 a HU-12 | 16 / 16 |
| E5 Control del cobro y cierre | Tres rechazos claros, nadie cobra dos veces y el cierre muestra lo que nunca salió | HU-13 a HU-18 | 16 / 17 |
| E6 Plataforma y entregables | Lo que la demo y la entrega exigen | HU-19 y HU-20 | 2 / 2 |
| E7 Extras | El mismo motor con otros eventos, solo si sobra tiempo | HU-21 a HU-25 | 0 / 25 |

### Backlog priorizado

El equipo actualiza la columna Estado durante el evento.

| ID | Historia | Épica | Prioridad | Puntos | Rol | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| HU-01 | Conectar un subsidio | E1 | Must | 3 | 4 y 2 | Por hacer |
| HU-02 | Consultar la liquidación de la entidad | E1 | Must | 3 | 2 | Por hacer |
| HU-03 | Registrar puntos de retiro | E1 | Must | 1 | 4 | Por hacer |
| HU-04 | Aprobar el permiso con tope en el banco | E2 | Must | 8 | 1 | Por hacer |
| HU-05 | Manejar una aprobación rechazada o vencida | E2 | Must | 2 | 1 | Por hacer |
| HU-06 | Rotar el token del permiso | E2 | Should | 2 | 1 | Por hacer |
| HU-07 | Enlazar y verificar mi cuenta | E3 | Must | 5 | 1 y 3 | Por hacer |
| HU-08 | Ver «tengo $230.000» | E3 | Must | 2 | 3 | Por hacer |
| HU-09 | Cobrar a mi cuenta | E3 | Must | 3 | 1 | Por hacer |
| HU-10 | Solicitar un cobro con la cédula digitada | E4 | Must | 5 | 3 y 2 | Por hacer |
| HU-11 | Confirmar con PIN | E4 | Must | 3 | 3 | Por hacer |
| HU-12 | Recibir el reembolso en segundos | E4 | Must | 8 | 1 | Por hacer |
| HU-13 | Ver los rechazos con claridad | E5 | Must | 3 | 2 | Por hacer |
| HU-14 | Impedir el doble cobro | E5 | Must | 3 | 2 | Por hacer |
| HU-15 | Ver autorizado, cobrado y lo que nunca salió | E5 | Must | 5 | 4 y 1 | Por hacer |
| HU-16 | Registro y línea de tiempo | E5 | Must | 2 | 2 | Por hacer |
| HU-17 | Cerrar el programa y revocar el permiso | E5 | Must | 3 | 1 | Por hacer |
| HU-18 | Pausar el programa | E5 | Should | 1 | 2 | Por hacer |
| HU-19 | Elegir mi rol sin login | E6 | Must | 1 | 4 | Por hacer |
| HU-20 | Entregables del hackathon | E6 | Must | 1 | 5 | Por hacer |
| HU-21 | Extra 1 · Bono con destino | E7 | Could | 5 | 2 | Por hacer |
| HU-22 | Extra 2 · QR del beneficiario y cámara | E7 | Could | 5 | 3 | Por hacer |
| HU-23 | Extra 3 · Leer el PDF417 de la cédula | E7 | Could | 5 | 3 | Por hacer |
| HU-24 | Extra 4 · Contrato público por hitos | E7 | Could | 8 | 1 y 4 | Por hacer |
| HU-25 | Extra 5 · Despliegue público | E7 | Could | 2 | 2 | Por hacer |

Fuera de alcance (Won't): decidir beneficiarios o montos, guardar la base de la entidad, validar huellas, manejar efectivo, integrarse con la caja del punto, dinero real, app nativa y SMS. Solo visión: huella con operador autorizado e integración con SECOP II o SIIF.

## Historias del flujo principal

Cada historia trae su enunciado, una línea de ficha (prioridad, puntos, rol, dependencias y API) y sus criterios de aceptación. Lo que el jurado debe recordar es el movimiento de la plata, no las pantallas.

### E1 · Conexión del subsidio

#### HU-01 · Conectar un subsidio

**Como** entidad financiadora, **quiero** conectar un programa de subsidio con su vigencia y la cuenta del programa, **para** que la plataforma pague cada cobro con mis reglas.

Must · 3 puntos · Rol 4 (vista) y Rol 2 (API) · Depende de HU-19 · `POST /programas` → `walletAddress.get`

- **Dado** que creo un subsidio, **cuando** guardo, **entonces** el destino queda libre y los canales permitidos son a la cuenta y retiro en un punto. El tipo bono queda para el extra HU-21.
- **Dado** un payment pointer con `$`, **cuando** guardo, **entonces** se convierte a `https://`; si la wallet no resuelve, veo «No encontramos esa cuenta» y no se guarda.
- **Dado** que la cuenta del programa no usa pesos, **cuando** guardo, **entonces** los montos usan su `assetCode` y `assetScale` y la pantalla muestra la moneda.
- El programa queda en Borrador y no se mueve dinero.

#### HU-02 · Consultar la liquidación de la entidad

**Como** entidad, **quiero** que la plataforma consulte mi liquidación en lugar de guardar mi base de beneficiarios, **para** seguir decidiendo quién recibe y cuánto sin entregar datos que no hacen falta.

Must · 3 puntos · Rol 2 · Depende de HU-01 · Servicio simulado en `LIQUIDACION_URL`

- **Dado** un programa en Borrador, **cuando** conecto la liquidación de prueba, **entonces** veo cuántas cédulas tiene y el total, que será el tope del permiso (RN-08). En la demo: 3 cédulas y $690.000.
- **Dado** una cédula, **cuando** la plataforma pregunta, **entonces** la liquidación responde solo si tiene un pago disponible y por cuánto.
- **Dado** una novedad cargada después de aprobar el permiso, **cuando** alguien la cobra, **entonces** la plataforma no la frena por el tope: lo decide el banco (RN-09). Así se muestra el rechazo por tope en la demo (propuesto).
- La plataforma no copia la lista: guarda solo las cuentas enlazadas (HU-07) y cada cobro.
- **Dado** que la liquidación no responde, **cuando** alguien intenta cobrar, **entonces** el cobro se rechaza con «No pudimos consultar tu pago; intenta en un momento» y queda un evento.

#### HU-03 · Registrar puntos de retiro

**Como** entidad, **quiero** registrar los puntos de retiro con su wallet, **para** que el beneficiario sin celular tenga dónde cobrar.

Must · 1 punto · Rol 4 · Depende de HU-01 · Tabla `punto` → `walletAddress.get`

- **Dado** un punto con nombre, dirección y wallet válida, **cuando** lo registro, **entonces** cualquier subsidio activo se puede cobrar allí.
- **Dado** una wallet con moneda distinta a la del programa, **cuando** la registro, **entonces** veo una advertencia y no se guarda.

### E2 · Autorización con Open Payments

#### HU-04 · Aprobar el permiso con tope en el banco

**Como** entidad, **quiero** aprobar una sola vez en mi banco un permiso con tope sobre la cuenta del programa, **para** que cada cobro se pague sin girar nada por adelantado.

Must · 8 puntos · Rol 1 · Depende de HU-01 y HU-02 · `POST /programas/:id/autorizar` y `GET /callback/:id`

Open Payments: `grant.request` de tipo `outgoing-payment` con acciones `create` y `read`, `limits.debitAmount` = tope total, sin receptor fijo e `interact.finish` con un `nonce` propio; luego `grant.continue`.

- **Dado** un programa en Borrador con su liquidación conectada, **cuando** pulso «Aprobar en mi banco», **entonces** pasa a EsperandoAprobacion y la Test Wallet me muestra la pantalla de consentimiento con el tope.
- **Dado** que apruebo, **cuando** llega el callback con `interact_ref` y `hash`, **entonces** la API verifica el hash, llama `grant.continue`, guarda el token solo en el backend y el programa pasa a Activo.
- **Dado** un callback con hash inválido, **cuando** llega, **entonces** se rechaza, se registra el evento y el programa no se activa.
- **Dado** el mismo callback dos veces, **cuando** llega el segundo, **entonces** no cambia nada.
- El mismo permiso paga a cuentas de beneficiarios y a puntos, porque no tiene receptor fijo (supuesto que se prueba el 8 de octubre). Fija un límite de desembolso; no reserva ni separa la plata.

#### HU-05 · Manejar una aprobación rechazada o vencida

**Como** entidad, **quiero** saber con claridad si rechacé o dejé vencer la aprobación, **para** volver a intentarlo sin perder la configuración.

Must · 2 puntos · Rol 1 · Depende de HU-04

- **Dado** que rechazo en la Test Wallet, **cuando** el callback llega con `result=grant_rejected`, **entonces** el programa vuelve a Borrador y veo «No aprobaste el permiso; puedes intentarlo de nuevo».
- **Dado** que pasan más de 10 minutos sin aprobar o llega `grant_invalid`, **cuando** vuelvo a la app, **entonces** el programa vuelve a Borrador con un mensaje claro.
- En ambos casos se conserva la configuración y queda un evento en la línea de tiempo.

#### HU-06 · Rotar el token del permiso (si sobra tiempo)

**Como** entidad, **quiero** que el permiso siga funcionando durante toda la vigencia, **para** que ningún cobro falle por un token vencido.

Should · 2 puntos · Rol 1 · Depende de HU-04 · `token.rotate`

- **Dado** un access token vencido, **cuando** la API recibe un 401 al crear un pago, **entonces** rota el token, guarda el nuevo y reintenta una sola vez.
- **Dado** que la rotación falla, **cuando** ocurre, **entonces** el cobro pasa a Fallido y la entidad ve «El permiso venció: apruébalo de nuevo».

### E3 · Cobro a la cuenta

#### HU-07 · Enlazar y verificar mi cuenta

**Como** beneficiaria con cuenta, **quiero** enlazar mi wallet a mi cédula y que se verifique que es mía, **para** recibir mi subsidio sin rechazos por cuenta inválida, como los 10.000 abonos reversados de Renta Joven en 2025.

Must · 5 puntos · Rol 1 (verificación) y Rol 3 (vista) · Depende de HU-19 · `POST /cuentas` → verificación de propiedad de la wallet address (grant interactivo)

- **Dado** mi cédula y mi wallet address, **cuando** pulso «Enlazar», **entonces** primero confirmo con mi PIN, para que nadie enlace su cuenta a una cédula ajena.
- **Dado** el PIN correcto, **cuando** continúo, **entonces** la app me lleva a mi wallet para aprobar y la cuenta queda PorVerificar.
- **Dado** que apruebo, **cuando** vuelve el callback con hash válido, **entonces** la cuenta queda Verificada y veo «Tu cuenta está lista para recibir pagos».
- **Dado** que rechazo o pasan 10 minutos, **cuando** vuelvo, **entonces** la cuenta queda SinEnlazar y puedo intentarlo de nuevo.
- La plataforma guarda solo la wallet address y el estado, nunca tokens de la cuenta del beneficiario.

#### HU-08 · Ver «tengo $230.000»

**Como** beneficiaria, **quiero** ver en una frase cuánto tengo disponible y cómo puedo cobrarlo, **para** decidir sin leer nada complicado.

Must · 2 puntos · Rol 3 · Depende de HU-02 · Consulta a la liquidación por cédula

- **Dado** mi cédula con un pago disponible, **cuando** abro la vista Beneficiario, **entonces** veo «Tienes $230.000», la vigencia y dos opciones: «A mi cuenta» (si está verificada) o «En un punto», con la lista de puntos.
- **Dado** un subsidio ya cobrado, **cuando** abro la vista, **entonces** veo cuándo, dónde y la referencia.
- La pantalla se lee completa en un celular de 360 px de ancho.

#### HU-09 · Cobrar a mi cuenta

**Como** beneficiaria con cuenta verificada, **quiero** cobrar mi subsidio con un toque, **para** tener la plata en segundos, sin filas ni ventanas de pago.

Must · 3 puntos · Rol 1 · Depende de HU-04, HU-07 y HU-12 (mismo adaptador de pago) · `POST /cobros` con canal cuenta

- **Dado** un subsidio disponible y mi cuenta Verificada, **cuando** pulso «Cobrar $230.000», **entonces** el cobro pasa de Solicitado a Pagando sin PIN, porque la cuenta ya probó ser mía.
- **Dado** que el pago se completa, **cuando** la app consulta, **entonces** veo «Pagado» y mi Test Wallet muestra el ingreso con la referencia.
- **Dado** una cuenta sin verificar, **cuando** intento cobrar, **entonces** veo «Primero enlaza y verifica tu cuenta».

### E4 · Cobro en el punto

#### HU-10 · Solicitar un cobro con la cédula digitada

**Como** punto de retiro, **quiero** digitar la cédula del beneficiario y ver al instante si tiene un pago disponible, **para** entregar el efectivo sin trámites ni fotos de documentos.

Must · 5 puntos · Rol 3 (vista) y Rol 2 (API) · Depende de HU-02 y HU-03 · `POST /cobros` con canal retiro

- **Dado** una cédula con subsidio disponible, **cuando** la digito, **entonces** veo «Pago disponible: $230.000» con el monto ya escrito y el cobro queda PorConfirmar.
- **Dado** que el cajero cambia el monto, **cuando** envía, **entonces** la API solo acepta el valor disponible: un retiro entrega el valor completo (RN-05, propuesto).
- **Dado** una cédula sin pago disponible o ya cobrada, **cuando** la digito, **entonces** veo el rechazo de HU-13 y no se crea ningún pago.
- **Dado** un doble clic, **cuando** llegan dos envíos con la misma `idempotency_key`, **entonces** se devuelve el mismo cobro.

#### HU-11 · Confirmar con PIN

**Como** beneficiario sin celular, **quiero** confirmar el cobro con mi PIN en el dispositivo del punto, **para** que nadie cobre mi subsidio solo con saber mi cédula.

Must · 3 puntos · Rol 3 · Depende de HU-10 · `POST /cobros/:id/confirmar`

- **Dado** un cobro PorConfirmar, **cuando** digito el PIN correcto, oculto con asteriscos, **entonces** el servicio simulado lo valida y el cobro pasa a Pagando.
- **Dado** un PIN incorrecto, **cuando** lo digito, **entonces** veo «PIN incorrecto, te quedan 2 intentos».
- **Dado** el tercer PIN incorrecto, **cuando** lo digito, **entonces** el cobro pasa a Rechazado y la cédula queda bloqueada 15 minutos en ese programa.
- **Dado** que nadie confirma en 120 segundos, **cuando** vence el plazo, **entonces** el cobro pasa a Rechazado por tiempo agotado y no se mueve dinero.
- La plataforma no guarda el PIN ni huellas. En producción este paso es la huella, validada por un operador autorizado por la Registraduría: el anexo técnico 2026 exige cédula original y validación biométrica facial o dactilar en el punto. En el pitch se dice que el PIN es una simplificación de la demo.

#### HU-12 · Recibir el reembolso en segundos

**Como** punto de retiro, **quiero** recibir en mi wallet el valor que entregué apenas el beneficiario confirma, **para** no fondear mi caja por adelantado ni esperar al cierre del ciclo.

Must · 8 puntos · Rol 1 · Depende de HU-04 y HU-11 · `GET /cobros/:id`

Open Payments: `grant.request` de tipo `incoming-payment` en el servidor de destino, `incomingPayment.create` por el monto con la referencia en `metadata`, `outgoingPayment.create` desde la cuenta del programa con el token del permiso (`incomingPayment` + `debitAmount`) y `outgoingPayment.get` hasta verlo completado. Este adaptador también paga el cobro a la cuenta (HU-09).

- **Dado** un cobro confirmado, **cuando** la API va a pagar, **entonces** guarda Pagando antes de llamar y luego las URLs de ambos pagos.
- **Dado** que el pago se completa, **cuando** el punto consulta, **entonces** el cobro pasa a Pagado y la caja muestra «Pagado · entrega $230.000 · Ref. SUB-0002».
- La Test Wallet del punto muestra el ingreso real con la referencia.
- **Dado** un error de red después de crear el pago saliente, **cuando** se reintenta, **entonces** la API consulta `outgoingPayment.get` y no crea un segundo pago.
- El punto entrega el efectivo solo cuando ve «Pagado».

### E5 · Control del cobro y cierre

#### HU-13 · Ver los rechazos con claridad

**Como** punto o beneficiario, **quiero** ver en palabras sencillas por qué no se puede pagar, **para** entender qué pasó sin llamar a nadie.

Must · 3 puntos · Rol 2 · Depende de HU-10 y HU-12

**Dado** cualquiera de estas causas, **cuando** ocurre, **entonces** la pantalla muestra el mensaje, no se mueve dinero y queda un evento. Los tres primeros se ven en el video.

| Causa | Se detecta | Mensaje | Estado del cobro | En el video |
| --- | --- | --- | --- | --- |
| Subsidio ya cobrado | Al solicitar | «Este subsidio ya fue cobrado» | Rechazado | Sí, paso 5 |
| Tope del programa superado | Al pagar: el banco devuelve `InsufficientGrant` | «El banco rechazó el pago: el programa llegó a su tope» | Fallido | Sí, paso 6 |
| Programa cerrado | Al solicitar | «El programa está cerrado y ya no recibe cobros» | Rechazado | Sí, paso 7 |
| Sin pago disponible en la liquidación | Al solicitar | «Esta cédula no tiene pagos disponibles en este programa» | Rechazado | No |
| Cuenta no verificada | Al solicitar | «Primero enlaza y verifica tu cuenta» | Rechazado | No |
| PIN errado 3 veces o tiempo agotado | Al confirmar | «No pudimos confirmar tu identidad» | Rechazado | No |
| Programa pausado o fuera de vigencia | Al solicitar | «El programa no está recibiendo cobros» | Rechazado | No |
| Fondos insuficientes en la cuenta del programa | Al pagar | «El programa no tiene fondos en este momento» | Fallido | No |

#### HU-14 · Impedir el doble cobro

**Como** entidad, **quiero** que una cédula no cobre dos veces el mismo subsidio, ni en dos puntos a la vez ni en un punto y en su cuenta al mismo tiempo, **para** que cada peso que sale corresponda a un cobro real.

Must · 3 puntos · Rol 2 · Depende de HU-10

- **Dado** dos puntos que envían la misma cédula a la vez, **cuando** ambos intentan, **entonces** un índice único parcial sobre programa y cédula deja ganar a uno; el otro ve «Este subsidio ya está en proceso o fue cobrado».
- **Dado** un cobro a la cuenta y un retiro al mismo tiempo, **cuando** llegan, **entonces** solo uno avanza.
- **Dado** una confirmación duplicada, **cuando** llega, **entonces** la `idempotency_key` y la `version` evitan un segundo pago.
- Un cobro Rechazado libera la cédula para intentarlo de nuevo.
- Un test de Vitest reproduce la carrera y pasa en cada commit a `main`.

#### HU-15 · Ver autorizado, cobrado y lo que nunca salió

**Como** entidad, **quiero** ver en tiempo real cuánto autoricé, cuánto se ha cobrado y cuánto nunca salió de mi cuenta, **para** dejar de esperar reportes del operador.

Must · 5 puntos · Rol 4 (vista) y Rol 1 (datos) · Depende de HU-04 y HU-12 · `GET /programas/:id/tablero` → `outgoingPayment.getGrantSpentAmounts`

- **Dado** un programa Activo, **cuando** abro el tablero, **entonces** veo tres cifras grandes: autorizado (el tope), cobrado (leído del permiso) y lo que todavía no ha salido, más los cobros por canal.
- **Dado** un cobro que acaba de pasar a Pagado, **cuando** el tablero se actualiza, **entonces** las cifras lo reflejan en 5 segundos o menos.
- Debajo, en pequeño: segundos entre cobro y reembolso al punto y «plata girada por adelantado: $0».
- Ningún token ni URL de gestión del permiso llega al navegador.

#### HU-16 · Registro y línea de tiempo

**Como** entidad, **quiero** que cada cobro quede registrado con quién, dónde, cuándo, cuánto y su referencia, **para** que la conciliación posterior se reduzca mucho.

Must · 2 puntos · Rol 2 · Depende de HU-01

- Cada cambio de estado de un programa, una cuenta o un cobro crea un evento con estado anterior, estado nuevo, detalle y fecha.
- **Dado** un cobro, **cuando** abro su detalle, **entonces** veo sus eventos en orden y la referencia del pago.
- Los eventos nunca guardan tokens, PIN ni llaves.

#### HU-17 · Cerrar el programa y revocar el permiso

**Como** entidad, **quiero** cerrar el programa revocando el permiso, **para** que nadie pueda volver a cobrar y ver cuánto dinero nunca salió de mi cuenta.

Must · 3 puntos · Rol 1 · Depende de HU-15 · `POST /programas/:id/cerrar` → `grant.cancel` o `token.revoke`

- **Dado** un programa Activo o Pausado, **cuando** confirmo «Cerrar programa», **entonces** la API revoca el permiso y el programa pasa a Cerrado.
- **Dado** un programa Cerrado, **cuando** un punto intenta un cobro, **entonces** se rechaza con «El programa está cerrado y ya no recibe cobros» (paso 7 del video).
- El tablero muestra «Nunca salió de tu cuenta: $230.000» en la demo, y no hay nada que reintegrar.
- Es irreversible: la app pide una segunda confirmación.

#### HU-18 · Pausar el programa (si sobra tiempo)

**Como** entidad, **quiero** pausar el programa, **para** dejar de aceptar cobros nuevos sin revocar el permiso.

Should · 1 punto · Rol 2 · Depende de HU-04

- **Dado** un programa Activo, **cuando** pulso «Pausar», **entonces** pasa a Pausado y todo cobro nuevo se rechaza con «El programa no está recibiendo cobros».
- Los cobros que ya están en Pagando terminan normalmente; «Reanudar» lo devuelve a Activo.

### E6 · Plataforma y entregables

#### HU-19 · Elegir mi rol sin login

**Como** jurado o integrante del equipo, **quiero** cambiar entre Entidad, Beneficiario y Punto con un selector, **para** recorrer la demo completa en un solo dispositivo.

Must · 1 punto · Rol 4

- **Dado** la web, **cuando** elijo un rol, **entonces** elijo también una cédula de prueba (beneficiario) o un punto de prueba y veo su vista sin contraseña.
- El rol elegido se recuerda al recargar la página.

#### HU-20 · Entregables del hackathon

**Como** equipo, **quiero** un repositorio público con todo en `main`, `AI_USAGE.md`, `/prompts` y un README con el video, **para** cumplir la entrega y no ser descalificados.

Must · 1 punto · Rol 5

- A las 11:00 del sábado 17: repo público, todo en `main`, `AI_USAGE.md` en la raíz y `/prompts/<rol>.md` con el texto real de los prompts.
- `.gitignore` con `.env` y `*.key` desde el primer commit; ningún secreto en el historial.
- README con cómo correrlo y enlace al video; video y slides a las 12:00.

## Historias de los extras

Los extras van en el orden del Documento Guía y solo se empiezan si el flujo principal pasa completo y sin fallos a las 17:15 del viernes. Cada uno se activa con su propia variable `EXTRA_*` y apagarlo no rompe la demo.

### E7 · Extras

#### HU-21 · Extra 1: bono con destino

**Como** entidad que entrega bonos, **quiero** un segundo programa restringido a ciertos comercios, **para** mostrar que el mismo motor paga contra otro evento: una compra válida.

Could · 5 puntos · Rol 2 · Depende de HU-01, HU-11 y HU-12 · `EXTRA_BONO` · tablas `programa_punto` y `POST /cobros` con canal compra

- **Dado** un programa de tipo bono, **cuando** lo creo, **entonces** el destino queda restringido y marco qué comercios lo aceptan.
- **Dado** un comercio autorizado, un total de $80.000 y un bono de $60.000, **cuando** digita la cédula y el cliente confirma con PIN, **entonces** se pagan $60.000 al comercio y el cliente paga $20.000 como siempre.
- **Dado** un comercio no autorizado, **cuando** digita la cédula, **entonces** ve «Este comercio no acepta este bono» y no se mueve dinero.
- **Dado** un bono, **cuando** alguien intenta cobrarlo a su cuenta o en retiro, **entonces** se rechaza: solo se usa en comercios autorizados.
- En el código es un campo (`destino`) y una validación más, no otro sistema.

#### HU-22 · Extra 2: QR del beneficiario y cámara

**Como** beneficiario con celular, **quiero** mostrar un QR temporal y que el punto lo lea con su cámara, **para** que el cajero no tenga que digitar mi cédula.

Could · 5 puntos · Rol 3 · Depende de HU-08, HU-10 y HU-25 (o un túnel con HTTPS) · `EXTRA_QR`

- **Dado** un pago disponible, **cuando** pulso «Mostrar QR», **entonces** veo un QR que vence en 60 segundos y solo lleva un token, sin datos personales.
- **Dado** el celular del punto servido por HTTPS, **cuando** el cajero escanea el QR, **entonces** el flujo sigue igual que con la cédula, incluido el PIN.
- Si la cámara no abre, digitar la cédula siempre funciona.

#### HU-23 · Extra 3: leer el PDF417 de la cédula

**Como** punto, **quiero** leer el código PDF417 de la cédula amarilla con la cámara o un lector 2D, **para** no digitar el número y evitar errores.

Could · 5 puntos · Rol 3 · Depende de HU-10 y HU-25 · `EXTRA_PDF417`

- **Dado** una cédula amarilla con holograma, **cuando** la paso por la cámara, **entonces** el campo cédula se llena solo.
- **Dado** un lector 2D que escribe como teclado, **cuando** lee el código, **entonces** el campo se llena y se envía.
- Si la lectura falla, digitar el número siempre funciona.

#### HU-24 · Extra 4: contrato público por hitos

**Como** entidad contratante, **quiero** que el pago de cada hito de un contrato se libere cuando el supervisor lo certifique, **para** pagar contra un evento y no contra una fecha, con trazabilidad pública del desembolso.

Could · 8 puntos · Rol 1 (pagos) y Rol 4 (tablero público) · Depende de HU-04 y HU-12 · `EXTRA_CONTRATO`

- **Dado** un contrato con tres hitos y su valor, **cuando** la entidad lo conecta, **entonces** aprueba un permiso con tope igual al valor del contrato. El permiso es un límite de desembolso: no reserva ni separa la plata.
- **Dado** un hito pendiente, **cuando** el supervisor lo certifica, **entonces** se paga ese hito a la wallet del contratista con su referencia.
- **Dado** un hito sin certificar, **cuando** alguien intenta pagarlo, **entonces** se rechaza; y ningún hito se paga dos veces.
- **Dado** el tablero público del contrato, **cuando** cualquiera lo abre, **entonces** ve los hitos certificados y lo pagado, nunca cuentas, tokens ni datos personales.
- En el pitch: los contratos ya se pagan contra actas de supervisión. Lo nuevo es la ejecución automática y la trazabilidad pública; Open Payments mueve el dinero y el supervisor certifica el cumplimiento.

#### HU-25 · Extra 5: despliegue público

**Como** jurado, **quiero** un enlace público a la app, **para** probarla por mi cuenta después de la presentación.

Could · 2 puntos · Rol 2 · `EXTRA_DEPLOY`

- La web corre en Vercel y la API en Render o Railway con HTTPS; el enlace va en el README y en las slides.
- Los callbacks del permiso y de la verificación de cuentas usan `API_BASE_URL`.
- La cámara de HU-22 y HU-23 solo funciona con HTTPS: sin este extra, esos dos necesitan un túnel.

## Diagramas de flujo y estados

La entidad interviene una sola vez con su banco; después, cada cobro consulta la liquidación y paga de wallet a wallet, sin que el dinero pase por la plataforma.

### Secuencia de punta a punta

&#91;embedded content: secuencia de punta a punta · 7 participantes, 29 mensajes\]

Solo los pasos 15 y 25 mueven dinero. Llamadas del SDK: 3 `grant.request` del permiso con tope · 6 `grant.continue` · 8 a 10 verificación de propiedad de la wallet address · 13 y 23 `grant.request` de pago entrante + `incomingPayment.create` en la wallet de destino · 14 y 24 `outgoingPayment.create` con el token del permiso · 28 `outgoingPayment.getGrantSpentAmounts` · 29 `grant.cancel` o `token.revoke`. La compra con bono (extra HU-21) sigue el flujo C con el total de la compra y la regla de destino.

### Estados del cobro, del programa y de la cuenta

&#91;embedded content: máquinas de estado · cobro, programa y cuenta\]

Las transiciones del cobro viven en `cobros/estados.ts` como función pura con tests; cada flecha crea un evento (HU-16). El canal a la cuenta salta PorConfirmar porque la cuenta ya probó ser del beneficiario.

## Modelo de datos y diccionario

Seis tablas propias sostienen todas las historias, y la lista de beneficiarios vive fuera: se consulta a la liquidación de la entidad. Frente al Documento Guía se agregan `asset_code`, `asset_scale`, `grant_url`, `total_compra`, `motivo_rechazo`, `intentos_pin` e `idempotency_key`, y la cuenta del beneficiario pasa de un booleano `verificada` a un estado con tres valores.

&#91;embedded content: modelo entidad-relación · 6 tablas y la liquidación externa\]

El programa es la raíz: sus cobros le pertenecen y, si es un bono, también la lista de comercios autorizados. Cada cobro apunta al punto donde se hizo, se une a la cuenta del beneficiario por la cédula, y la liquidación se consulta sin copiarse.

### Diccionario por tabla

**`programa`** — el programa y su permiso

| Campo | Tipo | Regla o validación | Ejemplo de la demo |
| --- | --- | --- | --- |
| `id` | uuid | Llave primaria | — |
| `entidad`, `nombre` | text | Requeridos, 3 a 80 caracteres | «Subsidio jóvenes (simulado)» |
| `tipo` | enum | subsidio o bono | subsidio |
| `destino` | enum | libre o restringido; en el MVP sale del tipo | libre |
| `wallet_programa` | text (URL) | `https://`, resuelve con `walletAddress.get`; una cuenta exclusiva por programa | `https://ilp.interledger-test.dev/programa-subsidio` |
| `asset_code`, `asset_scale` | text, int | Copiados de la wallet del programa | `COP` o `USD`, escala 2 |
| `vigencia_inicio`, `vigencia_fin` | timestamptz | El fin va después del inicio | — |
| `tope_total` | bigint | Suma de la liquidación al pedir la aprobación (RN-08) | `69000000` = 3 × $230.000 |
| `estado` | enum | Borrador, EsperandoAprobacion, Activo, Pausado, Cerrado | Activo |
| `access_token`, `manage_url` | text | Solo backend; salen de `grant.continue` | — |
| `continue_uri`, `continue_token` | text | Solo backend; para `grant.continue` | — |
| `nonce`, `finish_nonce`, `grant_url` | text | Verifican el hash del callback | — |

**`punto`** — puntos de retiro y comercios

| Campo | Tipo | Regla o validación | Ejemplo de la demo |
| --- | --- | --- | --- |
| `id` | uuid | Llave primaria | — |
| `nombre`, `direccion` | text | Requeridos | «Tienda Marta — corresponsal» |
| `wallet_address` | text (URL) | Misma moneda del programa; única | `https://ilp.interledger-test.dev/punto-1` |
| `tipo` | enum | retiro o compra | retiro |

**`programa_punto`** — comercios autorizados de un bono, solo para el extra HU-21

| Campo | Tipo | Regla o validación | Ejemplo de la demo |
| --- | --- | --- | --- |
| `programa_id`, `punto_id` | uuid | Llave primaria compuesta; solo para programas con destino restringido | El bono y la librería autorizada |

**`cuenta_beneficiario`** — cuenta enlazada por su dueño

| Campo | Tipo | Regla o validación | Ejemplo de la demo |
| --- | --- | --- | --- |
| `documento` | text | Llave primaria; la cédula | Cédula de prueba de Ana |
| `wallet_address` | text (URL) | Resuelve con `walletAddress.get` | `https://ilp.interledger-test.dev/ana` |
| `estado` | enum | SinEnlazar, PorVerificar, Verificada | Verificada |
| `nonce`, `finish_nonce` | text | Temporales, solo para verificar el hash de la verificación | — |
| `verificada_en` | timestamptz | Fecha de la verificación | — |

**`cobro`** — cada cobro, por cualquier canal

| Campo | Tipo | Regla o validación | Ejemplo de la demo |
| --- | --- | --- | --- |
| `id`, `programa_id` | uuid | Llave primaria y foránea | — |
| `documento` | text | Cédula que cobra; índice único parcial con `programa_id` en estados activos (RN-02) | — |
| `canal` | enum | cuenta, retiro o compra | retiro |
| `punto_id` | uuid | Nulo en el canal cuenta | — |
| `total_compra` | bigint | Solo en compra; lo digita el comercio | `8000000` = $80.000 |
| `monto` | bigint | Lo calcula el backend (RN-05) | `23000000` |
| `estado` | enum | Solicitado, PorConfirmar, Rechazado, Pagando, Pagado, Fallido | Pagado |
| `motivo_rechazo` | text | Una de las causas de HU-17 | — |
| `intentos_pin` | int | De 0 a `PIN_MAX_INTENTOS` | 0 |
| `referencia` | text | Única; viaja en el `metadata` del pago entrante | `SUB-0001` |
| `idempotency_key` | text | UNIQUE; evita el doble envío | — |
| `incoming_payment_url`, `outgoing_payment_url` | text | Se guardan al crear cada pago | — |
| `version`, `creado`, `actualizado` | int, timestamptz | Bloqueo optimista y auditoría | — |

**`evento`** — línea de tiempo y auditoría

| Campo | Tipo | Regla o validación | Ejemplo de la demo |
| --- | --- | --- | --- |
| `id` | bigserial | Llave primaria | — |
| `entidad`, `entidad_id` | text | programa, cuenta o cobro | cobro |
| `desde`, `hacia` | text | Estados de la transición | Pagando → Pagado |
| `detalle` | jsonb | Nunca tokens, PIN ni llaves | `{"referencia":"SUB-0001"}` |
| `creado` | timestamptz | Hora del servidor | — |

**Liquidación simulada (fuera de nuestra base).** Un servicio aparte responde por cédula: programa, nombre, monto y si ya fue pagado; en la demo también valida el PIN de prueba. Datos propuestos: el subsidio con 3 cédulas de $230.000 (Ana y otra persona con cuenta, y Jorge sin celular) y una cuarta cédula con un retroactivo de $460.000, cargado después de aprobar, para mostrar el rechazo por tope. El bono del extra HU-21 usa 2 cédulas de $60.000.

## Reglas, fórmulas y variables

Trece reglas de negocio gobiernan el flujo y los extras. La más importante para la demo es RN-09: la plataforma no frena los cobros por el tope; lo hace cumplir el banco, y eso es lo que el video debe mostrar.

### Reglas de negocio

| ID | Regla | Se valida | Historias |
| --- | --- | --- | --- |
| RN-01 | La cédula debe tener un pago disponible en la liquidación del programa; no hay base propia | Al solicitar | HU-02, HU-10 |
| RN-02 | Un solo cobro activo o pagado por cédula y programa: índice único parcial en Solicitado, PorConfirmar, Pagando y Pagado | Al solicitar | HU-14 |
| RN-03 | Destino libre (subsidio): canales a la cuenta y retiro. Destino restringido (bono, extra): solo compra en comercios de `programa_punto` | Al solicitar | HU-09, HU-21 |
| RN-04 | El canal a la cuenta exige una cuenta Verificada en la misma moneda del programa | Al solicitar | HU-07, HU-09 |
| RN-05 | Subsidio: se paga el valor completo disponible. Bono: el mínimo entre el valor y el total de la compra (propuesto) | Al solicitar | HU-10, HU-21 |
| RN-06 | El programa está Activo y dentro de su vigencia; uno Cerrado rechaza todo cobro | Al solicitar | HU-13, HU-17 |
| RN-07 | Retiro y compra exigen el PIN, validado por el servicio simulado; 3 fallos rechazan el cobro y bloquean la cédula 15 minutos (propuesto) | Al confirmar | HU-11 |
| RN-08 | El tope es la suma de la liquidación al pedir la aprobación y luego queda fijo | Al autorizar | HU-02, HU-04 |
| RN-09 | La plataforma no valida el tope antes de pagar: lo hace cumplir el banco con `InsufficientGrant` | Al pagar | HU-13 |
| RN-10 | Un cobro solo queda Pagado si el pago saliente se completa | Al consultar | HU-12 |
| RN-11 | Todo monto se valida y convierte en el backend con `assetScale`; nunca se confía en el navegador | Siempre | HU-10 |
| RN-12 | Un cobro PorConfirmar sin PIN en 120 segundos pasa a Rechazado (propuesto) | Al consultar | HU-11 |
| RN-13 | Un hito solo se paga si el supervisor lo certificó, y una sola vez | Al certificar | HU-24 |

### Fórmulas

Monto de cada cobro (RN-05):

```latex
\text{monto} = \begin{cases} \text{valor\_disponible} & \text{subsidio: a la cuenta o retiro} \\ \min(\text{valor\_disponible},\ \text{total\_compra}) & \text{bono (extra): compra en comercio autorizado} \end{cases}
```

Cifras del tablero (HU-15 y HU-17):

```latex
\begin{aligned} \text{autorizado} &= \text{tope\_total} = \textstyle\sum_{\text{liquidación}} \text{valor} \\ \text{cobrado} &= \text{gastado del permiso} \\ \text{nunca\_salió} &= \text{autorizado} - \text{cobrado} \\ \text{tiempo de reembolso} &= t_{\text{Pagado}} - t_{\text{confirmado}} \end{aligned}
```

Ejemplo de la demo (propuesto): el subsidio tiene 3 cédulas y un tope de $690.000. Ana cobra a su cuenta y Jorge retira en el punto: cobrado $460.000. Después de aprobar entra una novedad, un retroactivo de $460.000 para una cuarta cédula; como $460.000 + $460.000 superan el tope, el banco rechaza ese pago y el cobro queda Fallido sin mover dinero. La tercera persona no cobra, así que al cerrar $230.000 nunca salieron de la cuenta.

Verificación del hash de cada callback (permiso y verificación de cuenta), según la [documentación de Open Payments](https://openpayments.dev/es/identity/hash-verification/):

```text
hash = base64( SHA-256( nonce + "\n" + finish_nonce + "\n" + interact_ref + "\n" + grant_url ) )
```

### Variables de entorno

| Variable | Ejemplo | Para qué |
| --- | --- | --- |
| `OP_CLIENT_WALLET_ADDRESS` | `https://ilp.interledger-test.dev/entrega-app` | Identidad del cliente (`walletAddressUrl` del SDK) |
| `OP_KEY_ID` | uuid que entrega la Test Wallet | `keyId` de la llave del cliente |
| `OP_PRIVATE_KEY_PATH` | `./private.key`, fuera del repo | Llave Ed25519 con la que el SDK firma |
| `DATABASE_URL` | `postgres://…` de Supabase o Neon | Conexión a PostgreSQL |
| `LIQUIDACION_URL` | URL del servicio simulado | Consulta por cédula y validación del PIN de prueba |
| `APP_BASE_URL` | URL de la web | Volver a la app después de aprobar |
| `API_BASE_URL` | URL de la API | Callbacks: `{API_BASE_URL}/callback/:id` y de cuentas |
| `CONFIRMACION_TTL_SEG` | `120` (propuesto) | Plazo para el PIN antes de Rechazado |
| `PIN_MAX_INTENTOS` | `3` (propuesto) | Intentos antes del bloqueo |
| `PIN_BLOQUEO_MIN` | `15` (propuesto) | Duración del bloqueo de la cédula |
| `POLL_INTERVALO_MS` | `1000` (propuesto) | Cada cuánto el punto y la app consultan el estado |
| `EXTRA_BONO`, `EXTRA_QR`, `EXTRA_PDF417`, `EXTRA_CONTRATO`, `EXTRA_DEPLOY` | `false` | Enciende cada extra; apagado no rompe el flujo principal |
| `QR_TTL_SEG` | `60` | Vida del QR del extra HU-22 |

### Variables de Open Payments

| Variable | Sale de | Se guarda en | Se usa para |
| --- | --- | --- | --- |
| `interact.redirect` | `grant.request` del permiso o de la verificación | No se guarda | Llevar a la persona a su pantalla de consentimiento |
| `continue.uri`, `continue.access_token` | `grant.request` del permiso | `programa` | `grant.continue` |
| `interact.finish` | `grant.request` | `programa.finish_nonce` o `cuenta_beneficiario.finish_nonce` | Verificar el hash |
| `interact_ref`, `hash` | Parámetros del callback | Solo `interact_ref`, en el evento | Verificar el hash y `grant.continue` |
| `access_token.value`, `access_token.manage` | `grant.continue` del permiso | `programa` | Crear pagos, rotar y revocar |
| `incomingPayment.id` | `incomingPayment.create` en la wallet de destino | `cobro.incoming_payment_url` | Receptor del pago saliente |
| `outgoingPayment.id` | `outgoingPayment.create` en la cuenta del programa | `cobro.outgoing_payment_url` | Consultar si se completó |
| Monto gastado del permiso | `outgoingPayment.getGrantSpentAmounts` | No se guarda | Tablero: cobrado frente a lo autorizado |

## Requisitos no funcionales, riesgos y criterios de calidad

La auditoría externa con la rúbrica le dio 3,8 sobre 5 a la propuesta, con notas bajas en experiencia de usuario (3,2), calidad técnica (3,3) e impacto (3,5). Por eso los requisitos de abajo apuntan a esos tres criterios, y el alcance recortado es parte de la estrategia.

Cada requisito sigue ISO/IEC/IEEE 29148 y se clasifica con ISO/IEC 25010, pero aplica solo a lo que construimos y mostramos en la hackatón: dice qué se mide, cómo y en qué momento del evento. No son metas de un producto en producción.

### Requisitos no funcionales

| ID | Característica (ISO/IEC 25010) | Requisito medible | Cómo se verifica | Cuándo | Criterio que sube |
| --- | --- | --- | --- | --- | --- |
| RNF-01 | Seguridad | Llave privada, access tokens y continue tokens solo en el backend; `.gitignore` con `.env` y `*.key` en el primer commit; callback con `hash` y `nonce` verificados | Búsqueda de secretos en el repo (gitleaks o grep): 0 hallazgos; un test de Vitest rechaza un callback con `hash` alterado | Primer commit y sábado antes de las 11:00, cuando el repo se vuelve público | Calidad técnica |
| RNF-02 | Eficiencia de desempeño (tiempo de respuesta) | Del PIN correcto (o del «Cobrar») a «Pagado» en 10 s o menos en la Test Wallet | Marcas de tiempo de la tabla `evento` en 10 cobros de ensayo: 9 de 10 en 10 s o menos | Ensayo del viernes en la noche, antes de grabar | Experiencia de usuario, Impacto |
| RNF-03 | Usabilidad (operabilidad) | Cobro en el punto en 3 pasos (cédula, PIN, resultado) y a la cuenta en 1 toque; cada vista funciona a 360 px de ancho | 2 personas fuera del equipo (mentores u otros participantes) completan cada flujo sin ayuda en menos de 60 s; lo coordina el Rol 5 | Después de la puerta de las 17:15 | Experiencia de usuario |
| RNF-04 | Usabilidad (accesibilidad) | Texto base de 16 px como mínimo y montos de 24 px; contraste AA de WCAG 2.1 (4,5:1 en texto, 3:1 en controles); botones de 44 × 44 px como mínimo; español sencillo | Lighthouse Accesibilidad de 90 o más en las vistas del punto y del beneficiario; 0 palabras técnicas (grant, token, wallet address) en esas pantallas | Viernes, en el pulido móvil del plan de sprint | Experiencia de usuario, Inclusión |
| RNF-05 | Fiabilidad (tolerancia a fallos) | El estado se guarda antes de cada llamada a Open Payments; reiniciar la API no pierde ni duplica cobros | Se detiene la API con un cobro en Pagando y se reinicia: termina en Pagado o Rechazado, con 0 pagos duplicados en la Test Wallet (`outgoingPayment.get`) | Después de la puerta de las 14:00 y en el ensayo | Calidad técnica |
| RNF-06 | Seguridad (confidencialidad) | No guardamos la base de beneficiarios, ni PIN, ni huellas, ni fotos de documentos: solo cuentas enlazadas y cobros | Revisión del esquema: 0 columnas de PIN, huella o foto; la liquidación se consulta y no se copia | Al crear las tablas, en la revisión cruzada | Inclusión |
| RNF-07 | Mantenibilidad (capacidad de prueba) | Tests de Vitest para la máquina de estados, RN-01 a RN-12 y la carrera de doble cobro | Al menos 1 caso por regla y por transición; 100 % en verde | Antes de cada merge a `main` y al cierre de código del sábado | Calidad técnica |
| RNF-08 | Compatibilidad | Chrome en Android y Safari en iOS para punto y beneficiario; Chrome de escritorio para la entidad | Guion completo probado en 1 Android y 1 iPhone reales | Ensayo del viernes en la noche | Experiencia de usuario |
| RNF-09 | Seguridad (trazabilidad) | Cada transición crea un evento con fecha, actor y referencia; los logs nunca imprimen secretos | 100 % de las transiciones con evento (test); búsqueda en logs y en la tabla `evento`: 0 tokens o llaves | Antes de grabar y antes de las 11:00 del sábado | Calidad técnica |
| RNF-10 | Mantenibilidad (modularidad) | Cada extra se enciende con su variable `EXTRA_*` y apagarlo no rompe el flujo principal | Con todos los `EXTRA_*` en `false`, los pasos 1 a 7 del guion pasan | Antes de hacer merge de cualquier extra y antes de grabar | Calidad técnica |
| RNF-11 | Eficiencia de desempeño (capacidad) | Cobros simultáneos sin duplicados ni bloqueos | 10 solicitudes simultáneas con la misma cédula crean 1 solo cobro (Vitest); 3 cobros simultáneos de las 3 cédulas del subsidio terminan en Pagado en la Test Wallet | Con HU-14 y otra vez en el ensayo | Calidad técnica |
| RNF-12 | Fiabilidad (disponibilidad) | La web y la API responden durante la grabación y la presentación | 3 corridas seguidas del guion sin error antes de grabar; 0 caídas en la grabación y en la ronda 1; el video grabado es el respaldo | Viernes en la noche y ronda 1 | Calidad técnica, Presentación |

**Si el jurado pregunta por escala.** Se responde solo con lo medido: «la demo maneja cobros simultáneos sin duplicarlos». No se afirman cifras de usuarios o de cobros por minuto que no probamos.

### Riesgos

| Riesgo | Historias | Mitigación |
| --- | --- | --- |
| La Test Wallet no tiene pesos colombianos | HU-01, HU-15 | La demo usa dólares de prueba y la pantalla muestra la moneda |
| Un permiso sin receptor no paga a cuentas y puntos distintos | HU-04, HU-12 | Probarlo el 8 de octubre; plan B: un permiso por destino |
| La Test Wallet no devuelve `InsufficientGrant` | HU-13 | Probarlo el 8 de octubre; si no aparece, el paso 6 del video se cambia por un rechazo de la plataforma y se dice así |
| La verificación de propiedad de la cuenta no funciona en la Test Wallet | HU-07 | Probarla el 8 de octubre; plan B: enlazar sin verificar y mostrarlo como paso de producción |
| El token del permiso vence durante la demo | HU-06 | `token.rotate` y reintento único |
| La cuenta del programa se queda sin fondos | HU-12, HU-13 | Depositar dinero de prueba antes de grabar |
| Un extra rompe el flujo principal | HU-21 a HU-25 | No se empieza ninguno antes de la puerta de las 17:15 y todos se pueden apagar |
| La Test Wallet falla durante la presentación | HU-20 | Video grabado el viernes en la noche; la demo en vivo es opcional |
| El jurado confunde el producto con el Gestor de Información Financiera o con Bre-B | HU-09, HU-20 | Respuestas ensayadas: el Gestor dispersa por fecha y Bre-B es el riel; nosotros pagamos en el cobro contra un permiso con tope (Guía, § Preguntas del jurado) |
| El pitch suena contra los bancos o contra el operador de giros | HU-20 | Decir «sin adelantos», no «sin bancos»: la plata siempre vive en una entidad vigilada. No mencionar el oferente único ni las denuncias del contrato |

### Supuestos técnicos por probar el 8 de octubre

- [ ] ¿Qué monedas ofrece la Test Wallet? Define `asset_code` y los textos.
- [ ] ¿Un grant de pago saliente sin receptor paga a varias wallets distintas?
- [ ] ¿La Test Wallet devuelve `InsufficientGrant` al superar el tope?
- [ ] ¿Cómo funciona la verificación de propiedad de una wallet address en la Test Wallet, y cuánto tarda?
- [ ] ¿Cuánto dura el access token del permiso?

### Preguntas de producto abiertas

- [ ] ¿Cómo se muestra el rechazo por tope si el tope es la suma de la liquidación? Propuesto: una novedad de $460.000 cargada después de aprobar (ver Fórmulas).
- [ ] Retiro parcial: ¿el punto entrega siempre el valor completo (propuesto) o el beneficiario puede retirar una parte? El Documento Guía dice que el cajero digita el monto.
- [ ] Al enlazar la cuenta, ¿basta el PIN para probar que la cédula es de quien enlaza, o en producción se exige otra validación?
- [ ] ¿El PIN de la demo lo valida el servicio de liquidación simulado (propuesto) o un servicio de identidad aparte?
- [ ] Solo para el extra HU-21: si la compra es menor que el bono, ¿el resto se pierde (propuesto) o queda como saldo?
- [ ] ¿El rechazo por programa cerrado se llama «orden de no pago», como en el anexo técnico 2026, y la consulta «archivo de liquidación»? (Arquitectura, P-24)
- [ ] ¿El cierre de HU-17 exporta la conciliación con la estructura oficial (CODHOGAR, CODPERSONA, valor pagado, fecha de cobro, código DANE)? Sería un detalle opcional. (Arquitectura, P-23)
- [ ] En producción, ¿el retiro en el punto es un retiro en corresponsal bancario o un giro postal, y cuánto recibe hoy el punto por giro? Preguntar a Puntored en el evento. (Arquitectura, P-21 y P-25)

### Definition of Ready

Una historia entra al trabajo del evento cuando:

- [ ] Tiene actor, acción y beneficio, y criterios Dado / Cuando / Entonces
- [ ] Tiene prioridad, puntos y un rol responsable
- [ ] Sus dependencias están hechas o tienen datos falsos para avanzar
- [ ] Si usa Open Payments, la llamada del SDK ya se probó en un script antes del evento
- [ ] Si es un extra, el flujo principal ya pasó la puerta de las 17:15

### Definition of Done

Una historia está hecha cuando:

- [ ] Todos sus criterios de aceptación pasan en la Test Wallet, no solo con datos falsos
- [ ] El código está en `main`, revisado por la pareja de revisión cruzada
- [ ] Los estados nuevos tienen test en Vitest y crean su evento
- [ ] La vista cumple la columna Demo de los RNF que toca (como mínimo RNF-03, RNF-04 y RNF-08) y los errores se leen en español sencillo
- [ ] Ningún secreto quedó en el código, los logs ni la base de eventos
- [ ] Los prompts usados quedaron en `/prompts/<rol>.md`
- [ ] El Rol 5 la probó como usuario

## Plan de sprint para el hackathon

Hay dos puertas. A las 14:00 del viernes, HU-04 y HU-12 tienen que funcionar en un script; si no, todo el equipo se enfoca en ellas y el Rol 4 pide un mentor por Slack. A las 17:15, los pasos 2 a 5 del video tienen que pasar en la app; los extras solo empiezan en la noche, cuando también pasen los pasos 6 y 7.

### Historias por bloque y rol

| Bloque | Rol 1: Open Payments | Rol 2: Backend | Rol 3: Punto y beneficiario | Rol 4: Entidad y diseño | Rol 5: Producto y pitch |
| --- | --- | --- | --- | --- | --- |
| Sesión 1 (vie 10:30–14:00) | HU-04 y HU-12 en un script | Repo y tablas; HU-02 (liquidación simulada) y API de HU-01 | HU-10 y HU-08 con datos falsos | HU-19; vistas de HU-01 y HU-03; maqueta de HU-15 | Cuentas de demo con saldo; liquidación de prueba con la novedad; inicio de HU-20 |
| Sesión 2 (vie 15:00–17:15) | HU-04 con callback; HU-12 desde la API; HU-07 y HU-09 | HU-13, HU-14 y HU-16 | HU-11 conectada; vistas de HU-07 y HU-09 | HU-15 conectado; vista de HU-04 | Prueba de los pasos 2 a 5: puerta de las 17:15 |
| Noche (remota) | HU-17, dato de cobrado de HU-15, HU-05 y HU-06; después, HU-24 si pasó la puerta | HU-18 y tests de RNF-07; después, HU-21 y HU-25 | Estados de error; después, HU-22 o HU-23 | RNF-03 y RNF-04: pulido móvil y accesibilidad | Video v1 del flujo principal, README y slides |
| Sesión 3 (sáb 08:00–11:00) | Solo correcciones | Solo correcciones | Solo correcciones | Solo correcciones | HU-20 completa: video final y entrega |

### Trazabilidad con los criterios del jurado

| Criterio | Historias que lo demuestran | Paso del video |
| --- | --- | --- |
| Definición del problema | Datos de Colombia Mayor y HU-02: la misma liquidación que hoy se entrega al operador | 1 |
| Uso de Open Payments | HU-04, HU-07, HU-12, HU-13 (tope rechazado por el banco), HU-15 y HU-17 | 2 a 7 |
| Experiencia de usuario | HU-08, HU-09, HU-10 y HU-11 | 3 y 4 |
| Calidad técnica | HU-05, HU-14, HU-16 y RNF-10 | 5 y 6 |
| Presentación | HU-20 y la tesis del evento válido | Todo el video |
| Inclusión | HU-10 y HU-11: sin celular, sin app y sin cuenta, solo la cédula | 4 |
| Innovación | HU-04 y HU-17, y los extras HU-21 y HU-24: el mismo motor con distinto evento | 2, 7 y 8 |
| Impacto | HU-15: plata girada por adelantado en $0, reembolso en segundos y lo que nunca salió | 7 |

### Guion de la demo y sus historias

1. Contexto con un dato real: en el ciclo 7 de Colombia Mayor, 241.830 personas seguían pendientes al cierre ordinario.
2. La entidad conecta un subsidio de $230.000 y lo aprueba una vez en la Test Wallet, con la pantalla de consentimiento a la vista (HU-01, HU-02, HU-04).
3. Una beneficiaria ve «tengo $230.000», cobra y ve llegar el pago a su cuenta en segundos (HU-07, HU-08, HU-09).
4. Un beneficiario sin celular cobra en un punto: el cajero digita su cédula, él confirma con PIN y el punto ve «Pagado» y su reembolso en la Test Wallet (HU-10, HU-11, HU-12).
5. La misma cédula otra vez: «este subsidio ya fue cobrado» (HU-13, HU-14).
6. Un cobro que supera el tope: lo rechaza el banco, no nosotros (HU-02, HU-13).
7. La entidad cierra el programa: autorizado, cobrado y lo que nunca salió de la cuenta; un cobro después del cierre, rechazado (HU-15, HU-17).
8. Si están listos, los extras: un bono pagado con QR en un comercio autorizado y rechazado en uno no autorizado, y un contrato cuyo hito certificado libera su pago. Cierre con la tesis del evento válido (HU-21, HU-22, HU-24).

Nota de lenguaje: el paso 1 del Documento Guía agrega «lo no cobrado se devuelve». Según sus propias reglas, la cifra del ciclo 7 se dice «pendientes al cierre ordinario»; que los giros no cobrados en la ventana vuelven a Prosperidad Social conviene citarlo aparte, con su fuente de El Tiempo.

Fuente: Documento Guía — Hackathon Open Payments, revisión 66 del 1 de octubre de 2026.

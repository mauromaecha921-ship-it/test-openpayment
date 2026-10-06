# Documento Guía — Hackathon Open Payments

Sep 30, 2026 ·&#32;

## Resumen ejecutivo

Somos **la capa de distribución que convierte una liquidación ya aprobada en pagos bajo demanda**: la entidad sigue decidiendo quién recibe y cuánto, y la plata sale de su cuenta solo cuando el beneficiario cobra. Tesis del pitch: *la plata pública no debería salir porque llegó la fecha, sino cuando ocurre un evento válido.* Stack: TypeScript, Node.js 24, SDK oficial 7.4.0, Express, React y PostgreSQL.

- **Flujo principal de la demo:** solo el subsidio, de punta a punta: cobro a la cuenta del beneficiario, retiro en un punto con cédula digitada y PIN, doble cobro rechazado, tope superado rechazado por el banco y cierre con «lo que nunca salió».
- **Extras si sobra tiempo:** el mismo motor para bonos (evento: una compra válida) y contratos por hitos (evento: un hito certificado), con trazabilidad pública del desembolso.
- **Evidencia real:** en el ciclo 7 de Colombia Mayor de 2026, 241.830 de 2.788.074 personas no habían cobrado al cierre ordinario, y menos del 1 % recibió en cuenta propia.
- **Open Payments:** la entidad aprueba una sola vez un permiso con tope sobre la cuenta del programa; cada cobro es un pago a la cuenta del beneficiario o del punto; el tablero lee lo gastado y el cierre revoca el permiso.
- **Lo que ganamos:** sin fondeo previo, sin reintegro de lo no cobrado, reembolso al punto en segundos y una conciliación posterior mucho menor.
- **Inclusión:** quien no tiene celular ni cuenta cobra con su cédula en un punto. El MVP usa PIN; en producción, la huella la valida un operador autorizado.
- **Hito crítico:** el primer cobro de punta a punta funcionando el viernes 16 a las 14:00.
- **Equipo:** 5 roles, con dos personas en frontend y una dueña del producto, el pitch y el video.
- **Entregables:** repo público con todo en `main` a las 11:00 del sábado 17, `AI_USAGE.md` y `/prompts`, video y slides a las 12:00.

Riesgo principal: hoy ninguna entidad colombiana habla Open Payments. La demo corre en la Test Wallet y el pitch presenta una ruta de adopción: el piloto empieza con una sola entidad y una institución con cuenta propia.

## Contexto: cómo funciona Open Payments

Open Payments es una API estándar para que una app (el «cliente») pida a bancos y billeteras que muevan dinero, sin ver credenciales ni guardar fondos. Interledger (ILP) es la red por la que viaja el valor: Open Payments autoriza e instruye, el ASE ejecuta y liquida.

### Conceptos que todo el equipo debe dominar

| Concepto | Qué es | Dato clave para el código |
| --- | --- | --- |
| ASE | Banco o billetera que custodia la cuenta y ejecuta el pago | En el hackathon es la [Interledger Test Wallet](https://wallet.interledger-test.dev), con dinero de prueba |
| Wallet address | URL pública de una cuenta, como un correo para dinero | `https://ilp.interledger-test.dev/ana`; su alias es el payment pointer `$ilp.interledger-test.dev/ana` |
| Cliente | Nuestra app: se identifica con su propia wallet address, llave privada Ed25519 y keyId | La llave pública queda en `{wallet}/jwks.json`; el SDK firma cada petición |
| Grant (GNAP) | Permiso con recursos, acciones y límites; devuelve un access token | Pago entrante y cotización: no interactivos. Pago saliente: interactivo |
| Pago entrante | Recurso en la cuenta del receptor: «espero recibir X» | Puede tener monto o no, vence y se puede completar |
| Cotización (quote) | Cuánto se debita al pagador y cuánto recibe el receptor | Se crea en el servidor del pagador y vence (5 min por defecto en Rafiki) |
| Pago saliente | La orden que mueve el dinero desde la cuenta del pagador | Se crea con `quoteId` o con `incomingPayment` + `debitAmount` |
| Montos | Entero en texto + moneda + escala | USD 10,00 = `{"value":"1000","assetCode":"USD","assetScale":2}` |
| Rafiki | Software de referencia con el que un ASE ofrece Open Payments | La Test Wallet corre sobre Rafiki; no hay que instalarlo |

### El flujo de un pago, paso a paso

| # | Servidor | Llamada del SDK | ¿Participa el usuario? |
| --- | --- | --- | --- |
| 1 | Wallet address (público) de pagador y receptor | `walletAddress.get` | No |
| 2 | Autorización del receptor | `grant.request` tipo `incoming-payment` | No |
| 3 | Recursos del receptor | `incomingPayment.create` | No |
| 4 | Autorización del pagador | `grant.request` tipo `quote` | No |
| 5 | Recursos del pagador | `quote.create` con `receiver` = URL del pago entrante | No |
| 6 | Autorización del pagador | `grant.request` tipo `outgoing-payment` con `limits.debitAmount` e `interact` | Sí: aprueba en su billetera |
| 7 | Nuestro callback → autorización del pagador | Recibe `interact_ref` y `hash`, verifica el hash y llama `grant.continue` | No |
| 8 | Recursos del pagador | `outgoingPayment.create`: aquí se mueve el dinero | No |
| 9 | Recursos de ambos | `outgoingPayment.get` / `incomingPayment.get` hasta ver el pago completado | No |

Si el usuario rechaza, el callback llega con `?result=grant_rejected`; la ventana de aprobación dura 10 minutos por defecto en Rafiki. Open Payments no ejecuta el pago: el ASE del pagador lo liquida con el del receptor por Interledger.

### Correcciones a las notas del curso de Platzi

- El video 17 dice que la cotización vive en el servidor del receptor. Según la documentación oficial, se crea en el servidor del pagador.
- La Test Wallet está en `https://wallet.interledger-test.dev`, no en «wallet.interledger.testdev» ni en «wallet.interledger.com/testdev».
- «NAP» es GNAP, «EDSA/EPSA» son llaves Ed25519 y el «finalize outgoing payment» del video 17 es `grant.continue` en el SDK.

Fuentes: [Flujo de Open Payments](https://openpayments.dev/es/concepts/op-flow/) · [Montos](https://openpayments.dev/es/concepts/amounts/) · [Crear pago saliente](https://openpayments.dev/es/sdk/outgoing-create/) · [Grant de pago saliente](https://openpayments.dev/es/sdk/grant-create-outgoing/) · [IdP en Rafiki](https://rafiki.dev/integration/requirements/open-payments/idp/) · [Variables de Rafiki](https://rafiki.dev/integration/deployment/services/backend-service/)

## Reglas, criterios y entregables

Para competir necesitamos tres cosas: un pago Open Payments completo y grabado, un repositorio público con código escrito solo durante el evento y un pitch que responda a 8 criterios. Hay 4 premios de USD 5.000 y todos los equipos compiten por todos.

| Regla | Detalle |
| --- | --- |
| Fechas y lugar | Viernes 16 y sábado 17 de octubre de 2026, Ruta N (Calle 67 # 52-20, Piso 2, Torre A), Medellín |
| Inscripción | Se aplica como equipo y el plazo cierra dos semanas antes del evento (≈ 2 de octubre) |
| Equipo | 4 a 5 personas, mayores de 18, presenciales los dos días; el nuestro es de 5 |
| Código | Todo se escribe durante el evento; presentar código hecho antes es causal de descalificación |
| Requisito técnico | Integrar la API de Open Payments; sin ella el proyecto no se evalúa ni puede ganar |
| Preparación obligatoria | Curso de Open Payments en Platzi o Guía de supervivencia del hackatón, para cada integrante |
| IA | Permitida, pero se declara en `AI_USAGE.md` y los prompts reales se guardan en `/prompts` |
| Tiempo de hacking en sitio | Unas 8,75 h: vie 10:30–14:00 y 15:00–17:15, sáb 08:00–11:00; la noche del viernes es remota con mentores virtuales |

### Cómo nos evalúan

No hay pesos publicados: los 8 criterios se suman en la Ronda 1 y de ahí salen las 12 finalistas.

La [FAQ](https://interledger.org/es/hackathon/faq) usa además una escala de 0 a 5: 3 = la demo funciona y es estable; 4 = demo pulida, solución bien delimitada e impacto medible; 5 = demo excepcional, solución novedosa y técnicamente impresionante.

| Criterio | Pregunta del jurado | Qué debemos mostrar |
| --- | --- | --- |
| Definición del problema | ¿El reto es claro y relevante? | Un problema local, con una persona concreta y un dato verificable |
| Uso de Open Payments | ¿Hay un flujo de pago funcionando? | Pago real en la Test Wallet con consentimiento, más un uso no básico de grants |
| Experiencia de usuario | ¿Crea valor para el usuario? | Pocas pantallas, pensadas para móvil y en español sencillo |
| Calidad técnica | ¿El prototipo funciona de forma confiable? | Estados persistidos, manejo de rechazo y vencimiento, repo ordenado |
| Presentación | ¿Explican qué hicieron y por qué? | Pitch ensayado y video de demo impecable |
| Inclusión | ¿Es accesible para poblaciones desatendidas? | Funciona sin tarjeta de crédito y con lenguaje claro |
| Innovación | ¿Es creativo y original? | Un uso de Open Payments que otros equipos no harán |
| Impacto | ¿Qué diferencia hace para la comunidad? | Una métrica de impacto concreta y creíble |

### Premios (USD 5.000 cada uno, repartidos entre el equipo)

| Premio | Patrocinador | Qué premia |
| --- | --- | --- |
| Impacto | Ruta N | Mayor potencial de impacto real usando Open Payments |
| Inclusión | Puntored | Lo que más avance la inclusión financiera |
| Innovación | FIND EAFIT | Pensamiento más original y uso innovador de Open Payments |
| Comunidad | This Week in Fintech | Votado por todos los participantes |

### Entregables del sábado 17

- [ ] 11:00 — Repositorio público en GitHub, todo en `main`, enlace enviado por el Google Form que comparten en Slack
- [ ] 11:00 — `AI_USAGE.md` en la raíz y carpeta `/prompts` con el texto real de los prompts
- [ ] 12:00 — Video de demo con solicitud de pago, autorización, ejecución y finalización exitosa (en el repo o en Drive)
- [ ] 12:00 — Presentación con reto, usuario objetivo, solución, implementación de Open Payments y aprendizajes
- [ ] Opcional — diagramas de arquitectura, mockups y documentación técnica

Cada sala de presentación usa una sola laptop, así que el video de demo es lo que el jurado verá. Ronda 1: 12:00–13:00 en salas con al menos 2 jurados. Ronda 2: 14:30–15:30 en el auditorio; premiación a las 16:30.

Pregunta abierta: el tiempo del pitch no está publicado; hay que confirmarlo en Slack o con hackathon@interledger.org.

Fuentes: [Envío y evaluación](https://interledger.org/hackathon/submission-judging) · [Hackathon Medellín 2026](https://interledger.org/hackathon/2026-hackathon-medellin) · [Participación](https://interledger.org/hackathon/participation/) · PDF «Proceso de entrega y revisión» y agenda del evento (archivos del equipo).

## Revisión de la arquitectura propuesta

Veredicto: el diseño «Hexagonal + Saga» es técnicamente sólido y coincide con el SDK oficial, pero está dimensionado para producción y no para 8,75 horas, y no define el producto. De 17 decisiones, 7 se mantienen, 3 se simplifican, 2 se quitan, 4 se corrigen y 1 se agrega.

| Componente del documento | Decisión | Por qué | Qué hacer |
| --- | --- | --- | --- |
| La app no custodia dinero, solo coordina | Mantener | Así funciona Open Payments y evita temas regulatorios | Usarlo como frase del pitch |
| SDK oficial y flujo de 8 pasos | Mantener | Coincide con la documentación; la versión actual del SDK es 7.4.0 | Fijar la versión en `package.json` |
| Hexagonal en 3 capas, 3 puertos y `FabricaDePasarelas` | Simplificar | Un puerto de 10 métodos y una fábrica para un segundo método que no existe cuestan horas y no se ven en la demo | Dos fronteras: `openPaymentsService.ts` y reglas puras; sin fábrica |
| Saga orquestada con estados persistidos | Mantener | Es lo mejor del diseño: da estados visibles en la demo y maneja rechazo y vencimiento | 7 estados y transiciones en una función pura con tests |
| Worker con lease y `FOR UPDATE SKIP LOCKED` | Quitar | Con un solo proceso no hay competencia; es lo más caro de depurar | Avanzar por eventos: al crear, en el callback y al consultar el estado |
| Switches ACTIVO / PAUSADO / CORTADO en 3 alcances | Simplificar | Un interruptor interno no suma puntos; un botón para el usuario sí | En el producto: «Pausar programa» no acepta cobros nuevos; «Cerrar programa» llama `grant.cancel` o `token.revoke` |
| Búsqueda del pago saliente por `metadata.sagaId` | Quitar | En Rafiki el pago saliente toma el id de la cotización: una cotización no se paga dos veces y el grant limita el monto | Guardar `Ejecutando` antes de llamar; ante error, consultar con `outgoingPayment.get` |
| `idempotency_key` UNIQUE y columna `version` | Mantener | Evitan el doble clic, el doble callback y que un código se redima dos veces | Conservar |
| PostgreSQL | Mantener | Supabase o Neon: gratis, compartido y sin instalar nada | Dos tablas: `pago` y `pago_evento` |
| Historial `saga_evento` | Mantener | Alimenta la línea de tiempo de la demo y sirve de auditoría | Mostrarlo en la pantalla de estado |
| Callback con verificación de hash | Corregir | La tabla no guarda el nonce `finish` del servidor ni la URL del grant, necesarios para el hash | Agregar esas dos columnas; manejar `grant_rejected` y `grant_invalid` |
| Cotización vencida: cancelar | Corregir | La cotización dura 5 min y la aprobación hasta 10: un usuario lento pierde la compra | Tras `grant.continue`, crear el pago con `incomingPayment` + `debitAmount` (Rafiki recotiza) |
| Grant de pago saliente con `create`, `read`, `list` | Simplificar | `list` solo servía para la búsqueda por metadata | Pedir `create` y `read`: mínimo privilegio |
| Reparto: Dominio, Integración, Datos + worker, Front | Corregir | Nadie es dueño del producto, el pitch ni el video, que pesan en 5 de 8 criterios | Ver la sección de roles |
| Plan de \~1,5 días | Corregir | El tiempo real es \~8,75 h en sitio más la noche del viernes | Ver el plan de implementación |
| Producto: usuario, problema e impacto | Agregar | El documento no dice quién usa la app ni para qué | Ver la sección de producto y el alcance del MVP |
| Checklist antes de la demo | Mantener | Buenas pruebas de robustez | Añadir `AI_USAGE.md`, `/prompts` y el video |

Además faltan cuatro cosas: las pantallas y el flujo del usuario, los entregables del hackathon, qué cuentas de la Test Wallet se usan en la demo (quién paga y quién aprueba) y un plan B si la Test Wallet falla.

Fuentes: documento «Arquitectura de pagos con Open Payments v2» del equipo · [servicio de pagos salientes de Rafiki](https://github.com/interledger/rafiki/blob/main/packages/backend/src/open_payments/payment/outgoing/service.ts) · [IdP en Rafiki](https://rafiki.dev/integration/requirements/open-payments/idp/) · [Variables de Rafiki](https://rafiki.dev/integration/deployment/services/backend-service/) · [Verificación del hash](https://openpayments.dev/es/identity/hash-verification/)

## Arquitectura recomendada

Un monolito modular: una web con tres vistas (entidad, beneficiario y punto o comercio), una API Node con un único adaptador de Open Payments y PostgreSQL. La plataforma guarda programas, cobros y tokens de acceso, no la base de beneficiarios; el dinero solo se mueve entre cuentas de la Test Wallet.

&#91;embedded content: arquitectura recomendada · web, API, base de datos y Test Wallet\]

La entidad aprueba el programa una vez en su banco; después, cada cobro es un pago de la cuenta del programa a la del beneficiario o del punto, creado por el adaptador con peticiones firmadas.

### Estados de un cobro

| Estado | Qué significa | Lo mueve |
| --- | --- | --- |
| Solicitado | El punto envió cédula y monto, o el beneficiario reclamó a su cuenta; la plataforma consultó la liquidación | API |
| PorConfirmar | Falta la huella o el PIN del beneficiario (en el punto) | API |
| Rechazado | Sin pago disponible, ya cobrado, comercio no permitido por la regla de destino o cuenta no verificada | API, antes de pagar |
| Pagando | Pago entrante creado en la cuenta de destino y pago saliente desde la del programa: punto de no retorno | API |
| Pagado | El pago se completó | Consulta de estado |
| Fallido | El pago no se completó, por ejemplo por superar el tope del programa | Consulta de estado |

Antes de Pagando no se ha movido dinero. El programa tiene su propio ciclo: Borrador, EsperandoAprobacion (la entidad está en su banco), Activo y Cerrado (permiso revocado).

### Modelo de datos

| Tabla | Campos clave | Para qué |
| --- | --- | --- |
| `programa` | id, entidad, nombre, tipo (subsidio o bono), destino (libre o restringido), vigencia, tope\_total, estado, wallet\_programa, access\_token, manage\_url, continue\_uri, continue\_token, nonce, finish\_nonce | El programa y su permiso; los campos sensibles nunca salen del backend |
| `punto` | id, nombre, wallet\_address, tipo (retiro o compra), dirección | Puntos físicos y comercios |
| `programa_punto` | programa\_id, punto\_id | Comercios autorizados de un programa restringido |
| `cuenta_beneficiario` | documento, wallet\_address, verificada | Cuenta enlazada y verificada por su dueño |
| `cobro` | id, programa\_id, documento, canal, punto\_id, monto, incoming\_payment\_url, outgoing\_payment\_url, estado, referencia, version | Cada cobro; `version` y una restricción única por pago evitan cobrar dos veces |
| `evento` | id, entidad, entidad\_id, desde, hacia, detalle, creado | Línea de tiempo y auditoría |

La lista de beneficiarios no se guarda: se consulta a la entidad. En la demo, un servicio simulado con cédulas de prueba.

### API REST

| Ruta | Qué hace | Open Payments por debajo |
| --- | --- | --- |
| `POST /programas` | Conecta el programa con su tipo, destino y vigencia | `walletAddress.get` de la cuenta del programa |
| `POST /programas/:id/autorizar` | Devuelve la URL para que la entidad apruebe en su banco | `grant.request` interactivo de pago saliente, con tope y sin receptor fijo |
| `GET /callback/:id` | Recibe `interact_ref` y `hash` y activa el programa | Verificación del hash y `grant.continue` |
| `POST /cuentas` | El beneficiario enlaza su cuenta | Verificación de propiedad de la wallet address (grant interactivo) |
| `POST /cobros` | Solicitud de cobro desde el punto o desde la app | Ninguna: consulta la liquidación y aplica reglas |
| `POST /cobros/:id/confirmar` | Huella o PIN, y pago | `incomingPayment.create` en la cuenta de destino y `outgoingPayment.create` desde el programa |
| `GET /cobros/:id` | Estado para el punto y el beneficiario | `outgoingPayment.get` |
| `GET /programas/:id/tablero` | Cobrado, pendiente y lo que nunca salió | `outgoingPayment.getGrantSpentAmounts` |
| `POST /programas/:id/cerrar` | Cierra el programa | `token.revoke` o `grant.cancel` |

El callback puede apuntar a `localhost`; la cámara del punto, en cambio, exige HTTPS.

## Stack tecnológico

Recomendación: TypeScript de punta a punta, con Node.js 24 LTS y el SDK oficial en el backend, React en el frontend y PostgreSQL gestionado. Regla de oro: nada que el equipo no haya usado antes del 16 de octubre.

### Qué usar

| Capa | Usar | Por qué | Alternativa válida |
| --- | --- | --- | --- |
| Lenguaje | TypeScript | El SDK de Node es el más completo y trae tipos generados de la especificación | JavaScript, como en el curso de Platzi |
| Runtime | Node.js 24 LTS | Es la LTS activa en octubre de 2026 y la que usa el repo de la Test Wallet | Node.js 22 LTS |
| SDK | `@interledger/open-payments` 7.4.0 | Firma cada petición y cubre grants, pagos y tokens | SDK oficial de PHP o Go, solo si el equipo domina esos lenguajes |
| Backend | Express, con `tsx` para correr TypeScript sin compilar | Tiene más ejemplos y todos lo conocen | Fastify o Hono |
| Validación | Zod | Revisa montos, códigos y wallet addresses antes de llamar a Open Payments | Validación manual |
| Base de datos | PostgreSQL en Supabase o Neon | Gratis, en la nube y compartida por los 5 | SQLite, si todo corre en un solo proceso |
| Acceso a datos | `pg` con SQL directo, o Drizzle | Pocas tablas no justifican un ORM pesado | Prisma, si alguien ya lo domina |
| Frontend | React + Vite + Tailwind CSS + shadcn/ui | Tres vistas decentes en poco tiempo, pensadas para móvil | Next.js, solo si el equipo ya lo domina |
| Códigos QR | `qrcode.react` para generar y `html5-qrcode` para leer con la cámara | El comercio escanea desde el navegador, sin app nativa | Un lector 2D conectado al computador, que escribe el código como un teclado |
| Pruebas | Vitest para las reglas y los estados del cobro | Una tabla de casos demuestra calidad técnica en minutos | Jest |
| Repositorio | GitHub, ramas cortas y merge frecuente a `main` | La entrega exige repo público con todo en `main` | Ninguna: la entrega es en GitHub |
| Despliegue | Vercel para la web y Render o Railway para la API, desde el viernes | La cámara del navegador solo abre en HTTPS, y da un link para el jurado | Un túnel con HTTPS hacia el portátil |
| Video y slides | OBS o Loom; plantilla oficial de Google Slides | La organización entrega la plantilla | Grabador de pantalla del sistema |

### Qué no usar

| No usar | Por qué |
| --- | --- |
| Firmar peticiones HTTP a mano | El SDK ya firma con la llave Ed25519; hacerlo a mano es la fuente típica de errores 401 |
| Postman o Insomnia contra Open Payments | Las peticiones requieren firma; usen scripts con el SDK |
| El SDK en el navegador | Expondría la llave privada: todo lo de Open Payments va en el backend |
| Runtimes edge o serverless para el cliente de Open Payments | El SDK usa la criptografía de Node; usen un proceso Node normal |
| Rafiki en local con Docker | Levanta muchos servicios; la Test Wallet ya es un ASE completo |
| Blockchain, tokens o cripto | Interledger no es una criptomoneda; distrae al jurado y suma riesgo |
| Microservicios, colas (Kafka, RabbitMQ, Redis) o Kubernetes | Sobreingeniería: un solo proceso basta |
| App nativa (Flutter, React Native) | Compilar y firmar consume horas; una web móvil hace lo mismo |
| Login propio con contraseñas | No suma puntos: para la demo basta un selector de usuario; para identidad real existe la guía «verificar la propiedad de la wallet address» |
| Custodiar fondos en una cuenta de la app | Nos volvería un intermediario regulado; el dinero va de wallet a wallet |
| Herramientas nuevas para el equipo | El hackathon no es momento de aprender un framework |

### Estructura del repositorio

```text
/
├── AI_USAGE.md       obligatorio
├── prompts/          obligatorio: texto real de los prompts
├── README.md         qué es, cómo correrlo, link al video
├── .env.example      sin secretos
├── api/              Node + Express + SDK
│   └── src/
│       ├── openPaymentsService.ts   único archivo que habla con Open Payments
│       ├── programas/               regla de destino, permiso y tablero
│       ├── cobros/estados.ts        máquina de estados pura, con tests
│       ├── cobros/rutas.ts          API REST y callback
│       ├── liquidacion/             servicio simulado de la entidad
│       └── db/                      SQL y repositorio
└── web/              React + Vite + Tailwind
    └── src/vistas/   entidad · beneficiario · punto
```

`openPaymentsService.ts` debe escribirlo y entenderlo el equipo con poca IA: la guía de IA del hackathon lo pone como ejemplo y los mentores revisan ese código.

Fuentes: versión del SDK consultada en npm el 30 de septiembre de 2026 · [repo de la Test Wallet](https://github.com/interledger/testnet) · [SDK de PHP](https://interledger.org/es/blog/introducing-open-payments-php) · [SDK de Go](https://interledger.org/es/blog/go-further-with-open-payments) · [Verificar propiedad de la wallet address](https://openpayments.dev/es/guides/verify-wallet-address-ownership/)

## Entrega de subsidios hoy y dónde intervenimos

No cambiamos quién recibe ni cuánto: cambiamos cómo y cuándo sale la plata. Hoy Prosperidad Social abona el ciclo completo por adelantado en la cuenta del operador de giros (en 2026, SuperGIROS y SuRed), y después concilia y recibe de vuelta lo no cobrado; con la plataforma, cada peso sale de la cuenta del financiador en el instante en que alguien cobra.

### Datos verificados para el pitch

| Dato | Cifra | Fuente |
| --- | --- | --- |
| Colombia Mayor, ciclo 7 de 2026: personas programadas e inversión | 2.788.074 personas, $639.643 millones | [Infobae](https://www.infobae.com/colombia/2026/09/15/prosperidad-social-amplio-el-plazo-para-cobrar-los-pagos-del-septimo-ciclo-de-colombia-mayor-esta-es-la-nueva-fecha/) |
| Pendientes al cierre ordinario (13 de septiembre) | 241.830 personas (91 % entregado); plazo extendido al 20 de septiembre | [Infobae](https://www.infobae.com/colombia/2026/09/15/prosperidad-social-amplio-el-plazo-para-cobrar-los-pagos-del-septimo-ciclo-de-colombia-mayor-esta-es-la-nueva-fecha/) |
| Recibieron en cuenta propia registrada | 24.598, menos del 1 % | [Infobae](https://www.infobae.com/colombia/2026/09/15/prosperidad-social-amplio-el-plazo-para-cobrar-los-pagos-del-septimo-ciclo-de-colombia-mayor-esta-es-la-nueva-fecha/) |
| Colombia Mayor, ciclo 3: avance al 29 de abril | 84 % de 3 millones de personas; $230.000 por persona; más de 31.000 puntos de SuperGIROS y SuRed | [Prosperidad Social](https://prosperidadsocial.gov.co/Noticias/prosperidad-social-registra-un-84-de-avance-en-entregas-del-tercer-ciclo-de-colombia-mayor/) |
| Renta Joven, ciclo 5 de 2025: abonos reversados | 10.000 de 160.000 (6 %); la plata volvió a Hacienda y se volvió a pagar en enero de 2026 | [Prosperidad Social](https://prosperidadsocial.gov.co/Noticias/prosperidad-social-responde-a-inquietudes-sobre-renta-joven/) |
| Giros no cobrados en la ventana de pago | Vuelven a Prosperidad Social | [El Tiempo](https://www.eltiempo.com/economia/finanzas-personales/ojo-lo-que-pasa-si-no-cobra-a-tiempo-el-giro-de-renta-ciudadana-y-devolucion-del-iva-por-hasta-500-banco-agrario-explica-3367437) |

Cálculo aproximado: 241.830 personas × unos $230.000 ≈ $55.600 millones pendientes de cobro al cierre ordinario del ciclo 7.

Reglas para usar estos datos:

- Decir «pendientes al cierre ordinario», nunca «devueltos»: lo pendiente puede cobrarse en prórrogas o ciclos acumulados, y solo se reintegra tras la liquidación.
- No decir «inmovilizada en bancos»: la plata se abona 3 días antes en la cuenta del operador de giros, que no es un banco pagador (anexo técnico 2026). Decir «girada por adelantado al operador».
- La cifra oficial de lo reintegrado al Tesoro está pedida por derecho de petición. Si no llega antes del 16 de octubre, el pitch lo dice así.

### El modelo actual según el contrato de 2026

El contrato del operador confirma la tesis: Prosperidad Social adelanta el 100 % del ciclo, el beneficiario tiene una ventana fija y lo no cobrado vuelve después. Datos de los documentos del proceso IMYC 01 FIP de 2026, leídos el 2 de octubre de 2026.

| Dato | Cifra | Fuente |
| --- | --- | --- |
| Operador del efectivo | Unión Temporal de Pago Postal: SuperGIROS (Red Empresarial de Servicios) y SuRed (Matrix Giros y Servicios), 50 % cada una | Recomendación de adjudicación |
| Contrato 780-FIP-2026 | $170.878 millones (adjudicado por $168.263 millones), del 27 de febrero al 31 de diciembre de 2026 | [SECOP, datos abiertos](https://www.datos.gov.co/resource/jbjy-vk9h.json?nit_entidad=900039533&proveedor_adjudicado=UNI%C3%93N%20TEMPORAL%20DE%20PAGO%20POSTAL) |
| Fondeo | El ciclo completo se abona en la cuenta dispersora del operador 3 días calendario antes del pago | Anexo técnico 2026, 2.4.2 |
| Ventana de cobro | 17 días en Colombia Mayor; 10 días en Renta Ciudadana, IVA y Renta Joven | Anexo técnico 2026, 2.3.1 |
| Reintegro de lo no cobrado | 3 días hábiles después de la ventana | Anexo técnico 2026, 2.4.5 |
| Conciliación | Archivo plano 2 días hábiles después del cierre; Prosperidad Social lo revisa en 3 | Anexo técnico 2026, 2.4.5 |
| Pago al operador | Solo por giro efectivamente entregado, por la tarifa del programa | Anexo técnico 2026, § 10 |
| Tarifa techo por giro | $4.275 en Colombia Mayor; $4.125 en Renta Ciudadana, IVA y Renta Joven; $5.796 en ciclos dobles | Análisis del sector, § 8 |
| Colombia Mayor 2026 | 28,4 millones de giros y $7,28 billones, indicativos y a la baja por la bancarización vía SIIF | Anexo técnico 2026, 2.3.2.2 |

Los documentos están en la carpeta Anexos tecnicos del equipo y en el [proceso en SECOP](https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9985848). No van al pitch: que hubo un solo oferente, que la tarifa parece quedar en el techo, las denuncias sobre el contrato ni que muchos puntos son de chance y apuestas.

### El ciclo actual, etapa por etapa

| # | Etapa | Hoy | Con la plataforma | ¿La tocamos? |
| --- | --- | --- | --- | --- |
| 1 | Registro, validación y priorización de beneficiarios | La entidad cruza bases (Sisbén, Registraduría, IES y SENA) y decide quién entra | Igual | No |
| 2 | Liquidación del ciclo | Lista de documentos, valores y modalidad | La misma lista se carga a la plataforma | Solo el formato de entrega |
| 3 | Resolución que reconoce y ordena el pago | Acto administrativo por ciclo | Igual | No |
| 4 | Orden de pago y Tesorería | Se ejecuta la cadena presupuestal y la plata se dispersa | Se aprueba un permiso con tope sobre la cuenta del programa; no se dispersa nada | Sí |
| 5 | Fondeo a operadores y puntos | Prosperidad Social abona el ciclo completo en la cuenta del operador 3 días antes; el operador lo reparte a sus puntos en máximo 3 días | Desaparece: el punto recibe su reembolso en segundos, en cada cobro | Sí: se elimina |
| 6 | Ventana de cobro | Ventanas fijas: 17 días en Colombia Mayor y 10 en los demás programas | Puede durar lo que el programa quiera, porque la plata no está inmovilizada | Sí |
| 7 | Cobro | Cédula en el punto o abono a cuenta | Cédula y huella (o PIN) en el punto, compra en comercio autorizado o pago a la cuenta del beneficiario | Sí: misma experiencia, pago inmediato al punto |
| 8 | Reporte del operador | Archivo de conciliación 2 días hábiles después del cierre; Prosperidad Social lo revisa en 3 | Cada cobro queda registrado en el momento, con su referencia | Sí: en tiempo real |
| 9 | Conciliación | Se cruzan base, liquidación, órdenes, reportes y contabilidad | Cada pago trae su referencia: la conciliación posterior se reduce mucho, aunque siguen existiendo reversos y excepciones | Sí: se simplifica |
| 10 | Reintegro de no cobrados | El operador reintegra lo no cobrado a Prosperidad Social en 3 días hábiles | Desaparece: lo no cobrado nunca salió | Sí: se elimina |

### Qué nos ahorramos

- **Fondeo previo:** la plata no se gira semanas antes ni queda en manos de intermediarios durante la ventana.
- **Reintegros:** no hay que pedir la devolución de lo no cobrado.
- **Conciliación manual:** cada pago trae su referencia, así que la conciliación posterior se reduce mucho, aunque no desaparece.
- **Espera de los puntos:** el comercio o corresponsal recibe su reembolso al instante, no al cierre del ciclo.
- **Rechazos por cuenta inválida:** la cuenta del beneficiario se verifica cuando la enlaza, antes de pagar.

### Cómo lo medimos

| Indicador | Hoy | Con la plataforma |
| --- | --- | --- |
| Tiempo entre cobro y reembolso al punto | Hasta el cierre y la conciliación | Segundos |
| Plata girada por adelantado | El valor del ciclo | $0 |
| Plata que hay que reintegrar | Lo no cobrado | $0 |
| Conciliación | Cruces de varias fuentes al cierre | Mucho menor: cada cobro trae su referencia |
| Porcentaje cobrado sin efectivo | Lo que hoy entra por abono | Se mide por canal en el tablero |

### Qué no tocamos

- Quién es beneficiario, cuánto recibe y las reglas de cada programa.
- La resolución y la decisión de gasto de la entidad.
- La verificación de identidad oficial: la huella la valida un operador autorizado por la Registraduría.
- El efectivo: los puntos físicos lo siguen entregando, porque la plataforma no maneja billetes.

### Tres canales de cobro

| Canal | Para quién | Cómo funciona |
| --- | --- | --- |
| A su cuenta | Quien tiene cuenta en una entidad con Open Payments | Enlaza su cuenta en la app (Open Payments permite verificar que es suya) y, al reclamar, recibe el pago en segundos |
| Retiro en un punto | Quien no tiene cuenta o prefiere efectivo | Cédula y huella (o PIN) en un punto de cualquier red (en la demo, Puntored); el punto entrega el efectivo y recibe su reembolso al instante |
| Compra en un comercio | Bonos con destino | Cédula o QR en un comercio autorizado; la plata va directo al comercio |

En la demo: el canal a la cuenta y el retiro o la compra en el punto. El tercero va en la diapositiva.

Precisiones: el piloto realista no es la Tesorería sino una institución con cuenta propia (caja de compensación, alcaldía, fundación); los puntos siguen necesitando un acuerdo para entregar efectivo; y los datos de esta sección vienen de la investigación del equipo, salvo el reintegro de giros no cobrados, que confirmó [El Tiempo con el Banco Agrario](https://www.eltiempo.com/economia/finanzas-personales/ojo-lo-que-pasa-si-no-cobra-a-tiempo-el-giro-de-renta-ciudadana-y-devolucion-del-iva-por-hasta-500-banco-agrario-explica-3367437).

## Producto: programas de entrega justo a tiempo

Una plataforma que conecta la cuenta de una entidad con el ciudadano. La entidad sigue decidiendo quién recibe y cuánto; nosotros hacemos que cada peso salga de su cuenta solo cuando alguien cobra, a la cuenta del beneficiario o a la de un punto físico.

### Un programa, dos tipos

|  | Subsidio | Bono |
| --- | --- | --- |
| Quién financia | Gobierno nacional o local | Gobierno, caja de compensación o empresa |
| Regla de destino | Libre | Restringido a comercios autorizados |
| Canales permitidos | A su cuenta o retiro en un punto | Compra en un comercio autorizado |
| Ejemplo real | Renta Ciudadana, Colombia Mayor, Renta Joven | Bono de Lectura 2026, bonos de alimentación |

Todo lo demás es igual: lista de beneficiarios de la entidad, permiso con tope, cobro con cédula y segundo paso, pago justo a tiempo y registro de cada cobro. En el código es un campo (`destino`) y una validación más.

### Cómo funciona

1. La entidad conecta su programa: lista de cédulas con montos (en la demo, un archivo o un servicio simulado), regla de destino y vigencia.
2. Aprueba una sola vez, en su banco, un permiso con tope sobre la cuenta del programa. No se mueve plata.
3. El beneficiario cobra por uno de los tres canales:
   - **A su cuenta:** enlaza su cuenta en la app (Open Payments verifica que es suya) y reclama; el pago llega en segundos.
   - **Retiro en un punto:** muestra su cédula y confirma con PIN (en producción, con huella validada por un operador autorizado); el punto entrega el efectivo y recibe su reembolso al instante.
   - **Compra en un comercio:** el cajero digita el total y lee la cédula o el QR; la plata va directo al comercio.
4. Cada cobro queda registrado: quién, dónde, cuándo y cuánto.
5. Al cierre, la entidad revoca el permiso. Lo no cobrado nunca salió de su cuenta.

El flujo principal del hackatón es el cobro a la cuenta y el retiro en un punto, con la cédula digitada. La compra en comercio, el QR, la cámara, los bonos y los contratos son extras: muy buenos si se logran, pero nunca a costa de que el flujo principal falle.

### La tesis que une todo

*La plata pública no debería salir porque llegó la fecha, sino cuando ocurre un evento válido.* Es el mismo motor con distinto evento:

| Caso | Evento que libera el pago | En el hackatón |
| --- | --- | --- |
| Subsidio | El beneficiario cobra | Flujo principal |
| Bono | Una compra válida en un comercio autorizado | Extra 1 |
| Contrato público por hitos | El supervisor certifica un hito | Extra 4 |

Cuidados con los contratos: ya se pagan contra actas de supervisión, así que lo nuevo es la ejecución automática y la trazabilidad pública, no «no pagar antes». El permiso fija un límite de desembolso, no reserva ni segrega la plata. Y Open Payments mueve el dinero, pero el cumplimiento lo certifica el supervisor. El tablero público muestra datos contractuales, nunca cuentas, tokens ni datos personales.

### Qué hacemos y qué no

| No hacemos | Sí construimos |
| --- | --- |
| Decidir quién es beneficiario y cuánto recibe | El permiso con tope sobre la cuenta del programa |
| Validar requisitos o guardar la base de la entidad | La consulta a la liquidación: «¿esta cédula tiene un pago disponible?» |
| Validar huellas nosotros mismos | El pago en cada cobro, de punta a punta |
| Manejar efectivo | Que nadie cobre dos veces, ni en dos puntos a la vez |
|  | La verificación de la cuenta del beneficiario antes de pagarle |
|  | El registro de cada cobro, que reduce la conciliación posterior y elimina el reintegro de lo no cobrado |

### Las vistas

| Quién | Vistas |
| --- | --- |
| Entidad | Conectar programa, aprobar el permiso, tablero (cobrado, pendiente y lo que nunca salió) y cerrar |
| Punto o comercio | Validador: total, cédula o QR, PIN y resultado |
| Beneficiario | Enlazar su cuenta, ver subsidios y bonos asignados, reclamar a su cuenta, ver dónde cobrar o gastar, historial |

Unas 8 vistas en total. El beneficiario sin celular no necesita ninguna: le basta su cédula en un punto.

### El ángulo de Puntored

Puntored ofrece «pagos masivos» que dispersan dinero a hogares que reciben subsidios, y según El Colombiano solo entre el 30 % y el 35 % de su volumen ya no toca efectivo. Sus puntos encajan como lugares de retiro y de compra con cédula, reembolsados justo a tiempo. La compra con cédula es la que sube su porcentaje digital, porque la plata nunca pasa a efectivo. Hipótesis para validar con su gente en el evento.

Contexto verificado: en 2025 PuntoRed fue punto aliado del Banco Agrario para cobrar subsidios. Desde 2026 el efectivo de Prosperidad Social lo paga la Unión Temporal de SuperGIROS y SuRed, y no encontramos a Puntored como aliada. Puntored tampoco es operador postal de pago, así que no podía licitar. El argumento para Puntored es «cualquier red de puntos puede ser canal de cobro», no «reemplazamos al operador».

### Frente a lo que ya existe

- **Operador de giros (2026: SuperGIROS y SuRed; 2025: Banco Agrario):** paga en efectivo con fondeo previo, ventana fija y reintegro de lo no cobrado.
- **Pluxee y Edenred:** bonos de alimentación con saldos asignados en una tarjeta o QR del operador y red cerrada de comercios. Aquí no hay saldo en un operador: la plata sigue en la cuenta del financiador.
- **Bono de Lectura 2026:** la librería fotografía cédula y certificado del Sisbén y cobra al mes siguiente; aquí, cédula y segundo paso, y cobro en segundos.
- **Gestor de Información Financiera (julio de 2026):** Prosperidad Social paga directo desde el SIIF a cuentas verificadas, pero sigue siendo una dispersión masiva por fecha. Nosotros pagamos cuando alguien cobra y cubrimos también a quien sigue en efectivo.
- **Bre-B:** el riel de pagos inmediatos del Banco de la República hoy solo hace pagos entre personas y a comercios; la dispersión masiva llegaría en 2027. Open Payments no compite con él: define quién puede ordenar el pago y con qué tope.

### Viabilidad frente a la rúbrica

| Requisito obligatorio | ¿Cumple? |
| --- | --- |
| Integrar Open Payments | Sí: permiso con tope, pagos entrantes y salientes, verificación de cuenta, monto gastado y revocación |
| Demo con solicitud, autorización, ejecución y finalización | Sí: el cobro crea la solicitud, la entidad ya autorizó en su banco y el pago se completa; el video muestra la pantalla de consentimiento |
| Código escrito en el evento, repo público, `AI_USAGE.md` y `/prompts` | Sí: depende del proceso del equipo |
| Presentación con reto, usuario, solución, Open Payments y aprendizajes | Sí |

| Criterio | Cómo lo cumple | Estimado | Qué falta para subir |
| --- | --- | --- | --- |
| Definición del problema | Ciclo real de subsidios con fondeo previo, reintegros y conciliación | 4 | Citar datos verificados y una o dos entrevistas |
| Uso de Open Payments | Permiso con tope, pagos justo a tiempo, verificación de cuenta y revocación | 4 | Mostrar que el banco rechaza un pago que supera el tope |
| Experiencia de usuario | Cédula en el punto o reclamo en la app | 3 | Vistas móviles con textos sencillos |
| Calidad técnica | Sin cobros dobles, estados y registro | 3 | Demo sin fallos y flujo completo probado |
| Presentación | «La plata sale solo cuando alguien cobra» | 3–4 | Ensayo y video impecable |
| Inclusión | Sin celular, sin app y sin cuenta: solo la cédula | 4 | La huella como paso de producción en el pitch |
| Innovación | Pago justo a tiempo con un estándar abierto | 4 | Explicar la diferencia con giros y Pluxee |
| Impacto | Fondeo previo y reintegros en cero, reembolso en segundos | 4 | Esos indicadores en el tablero de la demo |

Los estimados son nuestros, no del jurado.

Una auditoría externa con la rúbrica dio 3,8 sobre 5 a la propuesta en papel, con potencial de 4,5. La diferencia no está en agregar funciones, sino en tres cosas: evidencia del problema con cifras, menos alcance visible y un flujo de dinero impecable. Sus puntos débiles fueron experiencia de usuario (3,2), calidad técnica (3,3) e impacto (3,5).

Fuentes: [giros no cobrados, El Tiempo](https://www.eltiempo.com/economia/finanzas-personales/ojo-lo-que-pasa-si-no-cobra-a-tiempo-el-giro-de-renta-ciudadana-y-devolucion-del-iva-por-hasta-500-banco-agrario-explica-3367437) · [Banco Agrario como operador, El Colombiano](https://www.elcolombiano.com/negocios/subsidios-colombia-mayo-2025-banco-agrario-operador-renta-devolucion-iva-colombia-mayor-IA27276860) · [Pagos masivos de Puntored](https://puntored.co/pagos-masivos-en-servicios-publicos-puntored/) · [Puntored en El Colombiano](https://www.elcolombiano.com/inicio/puntored-fintech-paisa-pagos-estadio-azteca-mundial-2026-EP38046406) · [Términos del Bono de Lectura 2026](https://www.mincultura.gov.co/noticias/Documents/2026/Bases%20para%20libreri%CC%81as%20-%20Bono%20de%20Lectura.pdf) · [Edenred Alimenticio](https://edenred.co/alimenticio/) · [Verificar la propiedad de una wallet address](https://openpayments.dev/es/guides/verify-wallet-address-ownership/)

Fuentes del contexto 2026: [Prosperidad Social: nuevos operadores](https://prosperidadsocial.gov.co/Noticias/transferencias-monetarias-sured-y-supergiros-son-los-nuevos-operadores-para-la-entrega-de-recursos/) · [Puntos aliados en 2025, El Colombiano](https://www.elcolombiano.com/negocios/subsidios-colombia-mayo-2025-banco-agrario-operador-renta-devolucion-iva-colombia-mayor-IA27276860) · [Operadores de giros habilitados, MinTIC](https://www.mintic.gov.co/portal/715/w3-article-126156.html) · [Corresponsales del Banco Agrario](https://www.bancoagrario.gov.co/canales-de-atencion/corresponsales) · [Gestor de Información Financiera, Infobae](https://www.infobae.com/colombia/2026/07/03/prosperidad-social-habilito-esta-plataforma-para-transferir-subsidios-directamente-a-cuentas-bancarias-de-beneficiarios/) · [Bre-B, documento técnico](https://d1b4gd4m8561gs.cloudfront.net/sites/default/files/publicaciones/archivos/documento-tecnico-bre-b-febrero-2026.pdf) · [Bre-B: nómina y recaudos, Valora Analitik](https://www.valoraanalitik.com/regulacion-para-pagos-de-nomina-y-recaudos-por-bre-b-quedaria-habilitada-desde-finales-de-2026/)

## Alcance del MVP

El MVP hace una sola cosa, impecable: una entidad aprueba un subsidio una vez y sus beneficiarios cobran justo a tiempo, a su cuenta o en un punto, con pagos reales en la Test Wallet. Lo que el jurado debe recordar es el movimiento de la plata, no las pantallas.

### Hará (obligatorio para la demo)

- [ ] Una web con tres vistas, elegidas con un selector de rol: entidad, beneficiario y punto
- [ ] Conectar un programa de subsidio con su liquidación de prueba (servicio simulado con cédulas)
- [ ] Aprobación única de la entidad: redirect a la Test Wallet, callback con verificación de hash y `grant.continue`
- [ ] Beneficiario: enlazar y verificar su cuenta, ver «tengo $230.000» y cobrar a su cuenta
- [ ] Punto: digitar la cédula y el monto, confirmar con PIN y ver «Pagado» con su reembolso
- [ ] Pago real de la cuenta del programa a la cuenta de destino en cada cobro
- [ ] Tres rechazos visibles: subsidio ya cobrado, tope del programa superado (lo rechaza el banco) y programa cerrado
- [ ] Tablero de la entidad: autorizado, cobrado y lo que nunca salió
- [ ] Cerrar el programa revocando el permiso

### Extras si sobra tiempo, en este orden

Solo se empiezan cuando el flujo principal pasa completo y sin fallos (puerta del viernes 17:15). Cada uno debe poder apagarse sin romper la demo.

1. Bono con destino: segundo programa «restringido», compra en un comercio autorizado y rechazo en uno no autorizado. Es casi gratis: un campo y una validación.
2. QR del beneficiario y lectura con la cámara del celular del punto (exige HTTPS).
3. Lectura del PDF417 de la cédula amarilla con cámara o lector 2D.
4. Contrato público por hitos: un contrato con tres hitos, el supervisor certifica uno y se libera su pago, con un tablero público del avance.
5. Despliegue público con link para el jurado.

### Solo visión

- Huella validada por un operador autorizado por la Registraduría
- Integración con SECOP II o SIIF para los contratos

### No hará

- Decidir beneficiarios, validar requisitos o guardar la base de la entidad
- Validar huellas, manejar efectivo o integrarse con el sistema de caja del punto
- Dinero real, bancos reales o billeteras distintas de la Test Wallet
- App nativa o notificaciones por SMS

### Programa de la demo

| Regla | Valor |
| --- | --- |
| Programa | Subsidio simulado de $230.000, como Colombia Mayor |
| Beneficiarios | 3 de prueba: dos con cuenta y uno sin celular que cobra en el punto |
| Tope del permiso | La suma de los subsidios del programa |
| Cuentas de prueba | Programa, dos beneficiarios y un punto de retiro |

### Riesgos técnicos que hay que probar antes del 16 de octubre

1. Monedas de la Test Wallet: si no hay pesos colombianos, se usan dólares de prueba y la pantalla lo dice.
2. Un permiso sin receptor que paga a varias cuentas distintas, y el rechazo al superar el tope (`InsufficientGrant` en Rafiki).
3. La verificación de propiedad de la cuenta del beneficiario en la Test Wallet.
4. El token del permiso vence: rotarlo con `token.rotate` si la demo dura horas.

## Plan de implementación

El plan tiene una sola prioridad hasta el viernes a las 14:00: un pago completo contra la Test Wallet. Todo lo demás se construye encima; el tiempo real en Ruta N son unas 8,75 horas más la noche del viernes.

&#91;embedded content: plan de implementación · 6 fases y 5 puertas de control\]

Cada puerta es un control: si no se cumple, el equipo no avanza a la fase siguiente. Si a las 14:00 no hay pago completo, los cuatro se enfocan en eso y el rol 4 pide un mentor por Slack.

### Tareas por bloque y rol

| Bloque | Rol 1: Open Payments | Rol 2: Backend | Rol 3: Punto y beneficiario | Rol 4: Entidad y diseño | Rol 5: Producto y pitch |
| --- | --- | --- | --- | --- | --- |
| Sesión 1 (vie 10:30–14:00) | Cliente autenticado, permiso del programa y primer cobro en un script | Repo, `.gitignore`, esqueleto de la API, tablas y liquidación simulada | Validador del punto y vista del beneficiario con datos falsos | Conectar programa y tablero con datos falsos; estilo visual | Cuentas de demo con saldo, estructura de slides y `AI_USAGE.md` |
| Sesión 2 (vie 15:00–17:15) | Callback con hash, `grant.continue` y cobro desde la API | Reglas, regla de destino, estados del cobro, eventos y rutas REST | Vistas conectadas a la API; confirmación con PIN | Tablero conectado y aprobación de la entidad | Pruebas de punta a punta y guion del video |
| Noche (remota) | Verificación de cuenta del beneficiario, monto gastado y revocación | Rechazos, cobros dobles y tests de estados | Enlace de cuenta, historial y estados de error | Pulido móvil, textos sencillos y accesibilidad | Video v1, README y slides completas |
| Sesión 3 (sáb 08:00–11:00) | Solo correcciones | Solo correcciones y despliegue | Solo correcciones | Solo correcciones | Video final, repo público y entregables |

## Roles del equipo

Cinco roles, cada uno dueño de una parte del producto y de los criterios del jurado que esa parte gana. Como hay tres vistas que construir, la quinta persona refuerza el frontend: una hace el punto y el beneficiario, y otra la vista de la entidad.

| Rol | Responsable de | Criterios que cuida | Entrega mínima | Perfil ideal |
| --- | --- | --- | --- | --- |
| 1. Líder técnico e integración Open Payments | `openPaymentsService.ts`, permiso del programa, callback con hash, pagos de cada cobro, verificación de cuentas, monto gastado y revocación | Uso de Open Payments, Innovación | Primer cobro contra la Test Wallet desde un script, viernes 14:00 | Backend fuerte, lee documentación con calma |
| 2. Backend y datos | API REST, tablas, liquidación simulada, reglas y regla de destino, estados del cobro con tests, cobros dobles y despliegue | Calidad técnica | API que valida reglas, registra cobros y guarda eventos | Backend o full stack, SQL |
| 3. Frontend del punto y del beneficiario | Validador del punto (monto, cédula, PIN, resultado) y vistas del beneficiario (enlazar cuenta, asignados, reclamar, historial) | Experiencia de usuario, Inclusión | Un cobro en el punto y otro a la cuenta, de punta a punta | React y cámara del navegador |
| 4. Frontend de la entidad y diseño | Conectar programa, aprobación en el banco y tablero; estilo visual y accesibilidad | Experiencia de usuario, Impacto | Tablero con cobrado, pendiente y lo que nunca salió | React y buen ojo de diseño |
| 5. Producto, pitch y calidad | Problema, datos verificados, entrevistas, slides, video, README, `AI_USAGE.md`, `/prompts`, pruebas, reloj del equipo y contacto con mentores y con Puntored | Definición del problema, Presentación, Impacto | Slides, video y entregables listos a las 12:00 del sábado | Comunicación clara; puede probar y escribir |

### Reglas de trabajo

- Todos completan el curso de Platzi o la Guía de supervivencia: es obligatorio por persona.
- Todos corren al menos una vez el flujo de pago del curso (videos 14 a 17) antes del evento, en un script desechable.
- Revisión cruzada: roles 1 y 2 entre sí, roles 3 y 4 entre sí; el rol 5 prueba cada entrega como usuario.
- Cada persona guarda sus prompts en `/prompts/<rol>.md` mientras trabaja, no al final.
- Decisiones: el rol 1 decide lo técnico y el rol 5 el alcance; en empate gana lo que mejore la demo.
- Si la quinta persona no programa, el rol 4 pasa a diseño e investigación con usuarios, y la vista de la institución la arma el rol 3 con componentes de shadcn/ui.

## Seguridad, errores comunes y qué no hacer

Los tres errores más caros: una llave privada subida a un repo que será público, un grant pedido al servidor equivocado y un video grabado a última hora.

### Seguridad mínima

- [ ] `.gitignore` con `.env`, `*.key` y `private.key` en el primer commit, antes que cualquier otro archivo
- [ ] Si una llave llega a git, revocarla en la Test Wallet y generar otra: borrarla del historial no basta porque el repo será público
- [ ] Llave privada, access tokens y continue tokens solo en el backend: nunca en el frontend, en logs ni en la tabla de eventos
- [ ] Verificar el `hash` del callback y usar un `nonce` aleatorio por grant (`crypto.randomUUID()`)
- [ ] Permiso del programa con límites: `debitAmount` siempre, `interval` cuando aplique
- [ ] Montos validados y convertidos en el backend con `assetScale`; nunca confiar en el monto que manda el navegador
- [ ] El QR lleva solo un código temporal de un minuto, sin montos ni datos personales
- [ ] El código se valida y se marca como usado en una sola operación de la base de datos
- [ ] El PIN se guarda con hash y se bloquea tras varios intentos fallidos
- [ ] La plataforma no guarda fotos de documentos de los beneficiarios
- [ ] Revocar el permiso al cerrar el programa

### Errores típicos de Open Payments

| Error | Síntoma | Cómo evitarlo |
| --- | --- | --- |
| `keyId` que no corresponde a la llave o a la wallet address del cliente | 401 o firma inválida en todas las llamadas | Generar las llaves en la misma wallet address que se pasa en `walletAddressUrl` |
| Usar el payment pointer tal cual | Error al resolver la wallet | Convertir `$ilp.interledger-test.dev/ana` en `https://ilp.interledger-test.dev/ana` |
| Pedir el grant al servidor equivocado | 401 o recurso no encontrado | Pago entrante en el servidor del comercio; pago saliente en el de la cuenta del programa |
| No revisar si el grant está finalizado | Token indefinido al crear el recurso | Usar `isFinalizedGrant` e `isPendingGrant` del SDK |
| Montos con decimales | Montos 100 veces mayores o menores | `"1000"` con `assetScale` 2 es 10,00; convertir en un solo lugar |
| Moneda del pago entrante distinta a la de la wallet | Error al crear el pago entrante | Leer `assetCode` y `assetScale` con `walletAddress.get` |
| Aprobación rechazada o vencida (10 min) | Callback con `result=grant_rejected` | Programa en Borrador y mensaje claro a la institución |
| Tope del programa superado | `InsufficientGrant` al crear el pago saliente | Mostrar el rechazo en la caja; es parte de la demo |
| Fondos insuficientes en la cuenta del programa | Pago saliente fallido | Depositar dinero de prueba antes de grabar y mostrar el error en la UI |
| Aprobar con la cuenta equivocada | La Test Wallet no muestra la solicitud esperada | Un perfil de navegador para la institución, con su sesión abierta |
| Token del permiso vencido | 401 después de horas de demo | Rotar con `token.rotate` y guardar el nuevo token |
| Cámara que no abre en el celular | El escáner queda en negro | Servir la web por HTTPS: Vercel o un túnel |
| El mismo código en dos cajas a la vez | Riesgo de doble cobro | `UPDATE` condicionado al estado y a la versión: solo una caja gana |
| Código de IA con métodos inventados | Errores de tipos o 404 | Contrastar con openpayments.dev y con los tipos del SDK |

### Qué no hacer en el hackathon

- No construir infraestructura antes de tener un pago de punta a punta funcionando.
- No dejar la integración entre frontend y backend para el sábado.
- No llegar con código del proyecto: el código del documento de arquitectura es referencia de diseño y se escribe de nuevo en el evento.
- No grabar el video a última hora: la primera versión se graba el viernes en la noche.
- No dejar ramas sin mezclar: la entrega solo mira `main`.
- No olvidar `AI_USAGE.md` y `/prompts`: son obligatorios.
- No depender de la demo en vivo: cada sala usa una sola laptop.
- No cambiar de idea después del viernes a mediodía.

Fuentes: [Verificación del hash](https://openpayments.dev/es/identity/hash-verification/) · [Montos](https://openpayments.dev/es/concepts/amounts/) · [IdP en Rafiki](https://rafiki.dev/integration/requirements/open-payments/idp/) · [Rotar token](https://openpayments.dev/es/sdk/token-rotate/) · notas del curso de Platzi, video 16

## Demo y pitch

El video de demo debe mostrar en 2 a 3 minutos la solicitud, la autorización, la ejecución y el pago completado, más un momento «wow». El pitch cubre los 5 puntos obligatorios (reto, usuario, solución, implementación de Open Payments y aprendizajes) sobre la plantilla oficial de Google Slides.

### Estructura del pitch (ajustar al tiempo que confirme la organización)

| Bloque | Duración | Contenido | Criterio que gana |
| --- | --- | --- | --- |
| Gancho | 20 s | Una persona real y su problema, con nombre y barrio | Definición del problema |
| Problema | 40 s | Un dato verificable y el dolor concreto | Definición del problema, Impacto |
| Solución | 30 s | La app en una frase: el dinero va de wallet a wallet y nunca pasa por nosotros | Experiencia de usuario |
| Demo | 90 s | El video: solicitud, autorización, ejecución, completado y momento wow | Uso de Open Payments, Calidad técnica |
| Cómo usamos Open Payments | 40 s | Qué grants pide la app, qué aprueba el usuario y con qué límites | Uso de Open Payments, Innovación |
| Inclusión e impacto | 30 s | A quién llega, qué cambia y una métrica | Inclusión, Impacto |
| Aprendizajes y siguiente paso | 20 s | Qué aprendimos y qué sigue | Presentación |

### Guion del video

1. Contexto con un dato real: «en el ciclo 7 de Colombia Mayor, 241.830 personas no habían cobrado al cierre ordinario; lo no cobrado se devuelve».
2. La entidad conecta un subsidio de $230.000 y lo aprueba una vez en la Test Wallet: se ve la pantalla de consentimiento.
3. Una beneficiaria ve «tengo $230.000», cobra y ve el pago llegar a su cuenta en segundos.
4. Un beneficiario sin celular cobra en un punto: el cajero digita su cédula, él confirma con PIN y el punto ve «Pagado» y su reembolso en la Test Wallet.
5. La misma cédula otra vez: «este subsidio ya fue cobrado».
6. Un cobro que supera el tope: lo rechaza el banco, no nosotros.
7. La entidad cierra el programa: autorizado, cobrado y lo que nunca salió de la cuenta. Un cobro después del cierre: rechazado.
8. Si están listos, los extras: un bono pagado con QR en un comercio autorizado y rechazado en uno no autorizado, y un contrato cuyo hito certificado libera su pago. Cierre con la tesis del evento válido.

### Reglas de grabación

- Primera versión el viernes en la noche; versión final el sábado entre 09:30 y 10:30.
- Datos limpios, wallets con saldo y un perfil de navegador por persona.
- Pantalla a 1080p, zoom del navegador al 125 % y sin pestañas ni marcadores personales.
- Video en el repo o en Drive, enlazado desde el README y desde las slides.
- Si hay jurados que no hablan español, subtítulos en inglés.

### Preguntas del jurado que hay que ensayar

- ¿Quién custodia el dinero? El banco de la entidad, hasta el instante del cobro; la plataforma solo coordina.
- ¿Qué pasa con lo que nadie cobra? Nunca sale de la cuenta del programa: no hay reintegro.
- ¿Cuánto se devuelve hoy? Lo pedimos por derecho de petición; lo verificado es que en el ciclo 7 quedaron 241.830 personas pendientes al cierre ordinario.
- ¿Eliminan la conciliación? No: la reducen mucho, porque cada pago trae su referencia; siguen existiendo reversos y excepciones.
- ¿Tienen biometría? El MVP usa PIN; en producción, el segundo paso lo valida un operador autorizado por la Registraduría.
- ¿Guardan la base de beneficiarios? No: la consultamos a la entidad y solo registramos cada cobro.
- ¿Van a reemplazar a Prosperidad Social? No: somos la capa de distribución que convierte una liquidación ya aprobada en pagos bajo demanda.
- ¿Cómo llega a producción? Con una entidad colombiana que instale Rafiki y una institución con cuenta propia para el piloto.
- ¿Esto no es el Gestor de Información Financiera? No: el Gestor dispersa por fecha a cuentas registradas; nosotros pagamos en el momento del cobro, a la cuenta o en efectivo, contra un permiso con tope.
- ¿Por qué no Bre-B? Bre-B mueve la plata; Open Payments decide quién puede ordenar el pago y con qué límite. Si una entidad colombiana expone Open Payments, el pago podría viajar por Bre-B.
- ¿Quitan a los bancos? No: la plata siempre vive en una entidad vigilada. Quitamos el adelanto del ciclo, la ventana fija y el reintegro; el punto cobra en segundos y el Estado paga solo por cobro.
- ¿Qué hizo la IA y qué hicieron ustedes? Responder con `AI_USAGE.md` en la mano.

El premio de la comunidad lo votan los participantes: ayudar a otros equipos en Slack y tener un nombre y un logo recordables suma votos.

## Recursos

Empiecen por la documentación en español y los videos 10 y 14 a 17 del curso de Platzi; el resto es consulta puntual.

| Recurso | Para qué sirve |
| --- | --- |
| [Documentación de Open Payments](https://openpayments.dev/es/) | Referencia principal: conceptos, SDK y API |
| [Flujo de Open Payments](https://openpayments.dev/es/concepts/op-flow/) | El flujo oficial completo, paso a paso |
| [Grant para pagos futuros](https://openpayments.dev/es/guides/outgoing-grant-future-payments/) | Base del permiso del programa: tope y sin receptor fijo |
| [Montos gastados de un grant](https://openpayments.dev/es/sdk/outgoing-grant-spent-amounts/) | Tablero de gastado frente al tope |
| [Crear pago saliente](https://openpayments.dev/es/sdk/outgoing-create/) | Las dos variantes: con cotización o con pago entrante y monto |
| [Verificación del hash](https://openpayments.dev/es/identity/hash-verification/) | Callback seguro |
| [Dividir un pago](https://openpayments.dev/es/guides/split-payments/) | Referencia para el copago con dos pagadores |
| [Glosario](https://openpayments.dev/es/resources/glossary/) | Vocabulario común del equipo |
| [SDK de Node](https://github.com/interledger/open-payments-node) | Código del SDK y ejemplo peer-to-peer |
| [Interledger Test Wallet](https://wallet.interledger-test.dev) | Cuentas, llaves de desarrollador y dinero de prueba |
| [Boutique](https://boutique.interledger-test.dev/) | Ejemplo de checkout de comercio electrónico |
| [Interledger Pay](https://interledgerpay.com/) | Ejemplo de app de pagos entre personas |
| [IdP en Rafiki](https://rafiki.dev/integration/requirements/open-payments/idp/) | Parámetros que llegan al callback |
| [Curso de Platzi](https://platzi.com/cursos/interledger-openpayments/) | Preparación obligatoria |
| [Recursos oficiales del hackathon](https://interledger.org/hackathon/open-payments) | Lista de herramientas de la organización |
| [Slack de Interledger](https://join.slack.com/t/interledger/shared_invite/zt-44g089zrn-XdSIiHF~cs8Oo_MBmSfECA) | Mentores, avisos y el formulario de entrega |
| [Términos del Bono de Lectura 2026](https://www.mincultura.gov.co/noticias/Documents/2026/Bases%20para%20libreri%CC%81as%20-%20Bono%20de%20Lectura.pdf) | Caso real del problema y reglas del programa de la demo |
| [Pagos masivos de Puntored](https://puntored.co/pagos-masivos-en-servicios-publicos-puntored/) | Contexto para el premio de Inclusión |
| [Edenred Alimenticio](https://edenred.co/alimenticio/) y [Pluxee](https://www.pluxee.co/) | Competencia directa que hay que diferenciar |
| Archivos del equipo | Arquitectura v2 (PDF), documento de ideas (Untitled.md), notas del curso de Platzi, agenda y proceso de entrega |

## Checklist antes del evento

Quedan 16 días: todo lo que no es código del proyecto se puede preparar antes, y eso es lo que separa a los equipos que llegan a la final.

- [ ] Oct 2, 2026 — Confirmar que el equipo de 5 quedó inscrito: el plazo cierra dos semanas antes del evento
- [ ] Oct 2, 2026 — Cuentas en la Test Wallet con KYC aprobado y dinero de prueba: programa, dos beneficiarios, un punto de retiro y dos comercios
- [ ] Oct 2, 2026 — Llaves de desarrollador en la wallet address «cliente» de la app, guardadas fuera de cualquier repo
- [ ] Oct 2, 2026 — Todos en el Slack de Interledger
- [ ] Oct 3, 2026 — Todos completan el curso de Platzi o la Guía de supervivencia (obligatorio por persona)
- [ ] Oct 4, 2026 — Un nombre para cada uno de los 5 roles
- [ ] Oct 7, 2026 — Cada integrante corre el flujo de pago de los videos 14 a 17 en un script desechable
- [ ] Oct 8, 2026 — Prueba en la Test Wallet: permiso sin receptor, pagos a dos comercios, rechazo por tope y monedas disponibles
- [ ] Oct 8, 2026 — Hablar con 2 o 3 beneficiarios de subsidios y con tenderos o corresponsales; anotar frases textuales
- [ ] Oct 9, 2026 — Confirmar con la organización: tiempo del pitch, idioma de los jurados y si se puede llevar el documento de arquitectura con fragmentos de código
- [ ] Oct 11, 2026 — Ensayo general: un mini hackathon de 9 horas con un proyecto desechable, siguiendo el plan por fases
- [ ] Oct 11, 2026 — Bocetos de las vistas de entidad, beneficiario y punto
- [ ] Oct 13, 2026 — Guion del pitch y slides en la plantilla oficial; preguntas preparadas para Puntored en el evento
- [ ] Oct 14, 2026 — Plantilla de `AI_USAGE.md` y convención de `/prompts`; declarar también que este documento se preparó con IA
- [ ] Oct 15, 2026 — Laptops listas (Node.js 24, Git, editor, GitHub, cargadores), celulares con cámara para la demo y datos móviles de respaldo

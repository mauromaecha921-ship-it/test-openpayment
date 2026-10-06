# Reglas de negocio — guía rápida

Referencia rápida de las **13 reglas de negocio (RN-01…RN-13)** del proyecto «Justo a Tiempo».
**Fuente canónica:** [`Historias de Usuario — Bonos con Destino.md`](./Historias%20de%20Usuario%20—%20Bonos%20con%20Destino.md) § Reglas, fórmulas y variables (líneas 514-530). Si una regla cambia, se edita allí y se actualiza este resumen.

El repositorio sigue siendo **solo documentación** (sin código). Las rutas de archivo citadas son las planificadas en [`Estructura del proyecto.md`](./Estructura%20del%20proyecto.md).

---

## 1. Las 13 reglas, por momento de validación

### Al solicitar el cobro (`POST /cobros`)

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-01 | La cédula debe tener un **pago disponible en la liquidación** del programa | No hay base propia de beneficiarios (AD-12); se consulta por cédula a la liquidación simulada | HU-02, HU-10 |
| RN-02 | **Un solo cobro activo o pagado** por cédula y programa | Índice único parcial en estados Solicitado, PorConfirmar, Pagando y Pagado — la protección es de base de datos | HU-14 |
| RN-03 | **Destino libre** (subsidio): canales a la cuenta y retiro · **Destino restringido** (bono, extra): solo compra en comercios de `programa_punto` | El destino sale de `programa.destino` | HU-09, HU-21 |
| RN-04 | El canal a la cuenta exige una cuenta **Verificada** y en la **misma moneda** del programa | Estados de cuenta: SinEnlazar → PorVerificar → Verificada | HU-07, HU-09 |
| RN-05 | **Monto:** subsidio = valor completo disponible · bono = `min(valor, total_compra)` | El monto lo calcula el **backend**, nunca el navegador. *El caso bono es propuesto* | HU-10, HU-21 |
| RN-06 | El programa está **Activo y dentro de su vigencia**; uno Cerrado rechaza todo cobro | Vigencia: `vigente_desde` / `vigente_hasta` | HU-13, HU-17 |

### Al confirmar (PIN) (`POST /cobros/:id/confirmar`)

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-07 | Retiro y compra exigen **PIN** validado por el servicio simulado | 3 fallos → cobro rechazado y bloqueo de la cédula por 15 minutos. *Propuesto; P-12 decide dónde se guarda el bloqueo* | HU-11 |

### Al autorizar el permiso (`POST /programas/:id/autorizar`)

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-08 | El **tope** es la suma de la liquidación al pedir la aprobación y luego queda **fijo** (`tope_total`) | Nunca se recalcula después | HU-02, HU-04 |

### Al pagar (durante la ejecución del pago)

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-09 | ⭐ La plataforma **no valida el tope antes de pagar**: lo hace cumplir el **banco** con `InsufficientGrant` → cobro **Fallido sin mover dinero** | Regla estrella de la demo: el video debe mostrar este rechazo (AD-11) | HU-13 |

### Al consultar (`GET /cobros/:id`)

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-10 | Un cobro solo queda **Pagado** si el pago saliente se completó | Se verifica con `outgoingPayment.get`; si no completó, no se marca Pagado | HU-12 |
| RN-12 | Un cobro **PorConfirmar sin PIN en 120 segundos** pasa a **Rechazado** | El vencimiento se evalúa al consultar, sin worker (AD-08). *Propuesto* | HU-11 |

### Siempre

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-11 | Todo monto se **valida y convierte en el backend** con `assetCode` + `assetScale` | Nunca se confía en el monto del navegador (Zod en la frontera) | HU-10 |

### Extras

| ID | Regla | Detalle | HU |
| --- | --- | --- | --- |
| RN-13 | Un **hito** solo se paga si el supervisor lo **certificó**, y **una sola vez** | Aplica al extra de certificación de hitos | HU-24 |

---

## 2. Fórmulas

**Monto de cada cobro (RN-05):**

```text
monto = valor_disponible                                  subsidio: a la cuenta o retiro
monto = min(valor_disponible, total_compra)               bono: compra en comercio autorizado
```

**Cifras del tablero (HU-15, HU-17):**

```text
autorizado  = tope_total = Σ liquidación
cobrado     = gastado del permiso
nunca_salió = autorizado − cobrado
tiempo de reembolso = t(Pagado) − t(confirmado)
```

**Ejemplo de la demo:** subsidio con 3 cédulas × $230.000 → tope $690.000. Ana cobra a su cuenta y Jorge retira en el punto → cobrado $460.000. Después entra un retroactivo de $460.000 para una cuarta cédula; `460.000 + 460.000 > 690.000` → el **banco rechaza** ese pago (RN-09) y el cobro queda **Fallido** sin mover dinero. La tercera persona no cobra, así que al cerrar **$230.000 nunca salieron**.

---

## 3. Máquinas de estados que gobiernan

Las reglas viven dentro de tres máquinas de estados; **cualquier transición no listada se rechaza** (Arquitectura AD-…, § máquinas).

**Cobro (6 estados):** `Solicitado → PorConfirmar → Pagando → Pagado | Fallido`, más `Rechazado`

```text
Solicitado ──(canal retiro: falta PIN)──▶ PorConfirmar ──(PIN ok, RN-07)──▶ Pagando
Solicitado ──(canal cuenta, sin PIN)─────────────────────▶ Pagando
PorConfirmar ──(120 s sin PIN, RN-12 / 3 fallos)──▶ Rechazado
Pagando ──(pago saliente completo, RN-10)──▶ Pagado
Pagando ──(InsufficientGrant u otro rechazo, RN-09)──▶ Fallido
```

- Antes de `Pagando` **no se ha movido dinero**.
- El canal a la cuenta **salta `PorConfirmar`** porque la cuenta ya probó ser del beneficiario.
- Nota: la Guía dice «7 estados» en su § Revisión, pero su tabla y las Historias tienen **6** (Arquitectura, § contradicciones).

**Programa (5 estados):** `Borrador → EsperandoAprobacion → Activo → Pausado → Cerrado`

```text
Borrador ──(autorizar, RN-08)──▶ EsperandoAprobacion
EsperandoAprobacion ──(callback ok)──▶ Activo   │ ──(rechazo/vence)──▶ Borrador
Activo ⇄ Pausado (HU-18)   │   Activo|Pausado ──(cerrar)──▶ Cerrado → todo cobro rechazado (RN-06)
```

**Cuenta del beneficiario (3 estados):** `SinEnlazar → PorVerificar → Verificada` (requisito de RN-04).

Cada flecha crea un **evento** en la tabla `evento` (HU-16).

---

## 4. Dónde se aplican (cuando exista el código)

| Capa | Implementación planificada | Reglas |
| --- | --- | --- |
| Funciones puras | `cobros/estados.ts` — transiciones y núcleo de reglas sin red ni BD | RN-01…RN-13, máquina de estados |
| Frontera HTTP | Zod en `cobros/rutas.ts` — montos, cédulas, wallet addresses antes de llamar a Open Payments | RN-05, RN-11 |
| Base de datos | Índice único parcial (programa, cédula) en estados activos · `idempotency_key` UNIQUE · columna `version` (bloqueo optimista) | RN-02, RN-11, idempotencia 3 niveles |
| Servicio | `cobros/servicio.ts` — cuándo llamar al adaptador, tope de RN-08 | RN-08, RN-09 |
| Banco (externo) | `InsufficientGrant` de Open Payments/Test Wallet | RN-09 (AD-11) |
| Tests | Vitest: ≥1 caso por regla y por transición, 100% verde | RNF-07 |

---

## 5. Propuestas abiertas y pendientes

| Tema | Regla/pregunta | Estado |
| --- | --- | --- |
| Retiro parcial: ¿el cajero digita el monto o siempre es el valor completo? | RN-05 · **P-04** | Abierto (Rol 5) |
| ¿Dónde se guarda el bloqueo de 15 min tras 3 PIN fallidos? | RN-07 · **P-12** | Abierto (Rol 1) |
| Caso «bono» de la fórmula | RN-05 | Propuesto |
| Bloqueo y vencimiento de PIN | RN-07, RN-12 | Propuestos |
| Disparo del pago en canal cuenta (¿`POST /cobros` paga directo o se llama a confirmar sin PIN?) | HU-09 vs Guía API | Abierto (Arquitectura § contradicciones) |

Ver también: [`Hallazgos — Investigación de Fuentes.md`](./Hallazgos%20—%20Investigación%20de%20Fuentes.md) § pendientes P-01…P-25 y [`Documento de Arquitectura`](./Documento%20de%20Arquitectura%20—%20Hackathon%20Open%20Payments.md) § 3.2 (operaciones O2/O4/O5/O6/O8 con las reglas que aplican en cada una).

# Plan: la animación C (se enrolla) en los pagos reales

**Estado:** aplicado en `piloto-v2` (15 oct 2026), sin commit.

Lleva la opción C de `/demo/tatu` (`TatuEnrolla`) a las pantallas de cobro del punto
(`CobroEnPunto`) y del beneficiario (`CobroPagado`). Solo `web/`; la API no cambia.

## 1. Lo que decidió el equipo

- **El tatú es la barra de carga.** Reemplaza la barra ámbar del punto y el tatú B que giraba en
  los pagos a billetera: empieza de pie (pose 1), se enrolla y rueda mientras se paga.
- **Pago bien:** se queda enrollado y la cerradura se enciende en verde, con la información del pago.
- **Pago mal (Rechazado o Fallido):** se devuelve a la pose 1, de pie, en lugar de la mano del
  bloque «No entregues efectivo».

## 2. Cómo quedó

| Pantalla | Antes | Ahora |
|---|---|---|
| Pagando (P4 / B5) | Barra ámbar (punto) y tatú B de 64 px | `TatuEnrolla` de 176 px en el bloque Noche: de pie → se enrolla → rueda |
| Pagado (P5 / B6, PD3) | Círculo ✓ blanco | `TatuResultado`: llega rodando, frena, asoma la cabeza (pose 8) y pasa al logo en su medallón con la cerradura verde y el ✓ |
| Rechazo / Fallido del punto (P6, P7, PD4) | Mano en el bloque rojo | `TatuResultado`: llega rodando, frena y se desenrolla (poses 3 → 2 → 1) hasta quedar de pie |
| Rechazo / Fallido del beneficiario | Sin ícono | El mismo tatú, sobre el fondo de la pantalla |
| Cargando (pantallas y listas) | Tatú B | Sin cambios (no son pagos) |

- **Pagando y el resultado son pantallas distintas.** La de Pagando anota el cobro (`marcarPagando`)
  y la del resultado termina la animación solo si lo vio pagando. Si el resultado se abre después
  (desde «Cobros de hoy» o el historial), o el cobro se rechazó antes de pagarse (PIN, ya cobrado),
  el tatú aparece quieto en su pose final.
- **«Pagado» sale al instante,** como antes: la animación es lo que acompaña al resultado, no lo retrasa.
- **Reducir movimiento:** todo quieto (logo con cerradura ámbar mientras paga, verde si pagó; de pie si falló).
- Se quitó `CirculoCheck` (`Proto.tsx`), que ya no usaba ninguna pantalla.
- En la demo, la opción C tiene «Simular que falló».

### Ajustes tras la primera prueba del equipo

- **Una sola carga por pago.** Al cobrar a la cuenta salía primero el tatú de carga (B) mientras
  cargaba la pantalla del cobro y después el de los pagos (C). Ahora los dos botones de cobrar a la
  cuenta (`Subsidio` y `CobrarCuenta`) llevan a esa pantalla con los datos que ya devolvió la API
  (`irAlCobroPedido`): no hay pantalla de carga. Si el cobro quedó en curso se ve «Pagando…»; si se
  rechazó al instante (otro cobro en curso, ya cobrado), el rechazo sale de una vez con el tatú de pie,
  sin rodar. El tatú B queda solo para las pantallas de carga.
- **El rechazo del beneficiario se ve como el del punto:** bloque rojo con el tatú, «No se hizo el pago ·
  No se movió dinero».
- **Mientras se pide el pago a la cuenta** (el botón queda bloqueado unos segundos), en lugar de solo
  «Pidiendo el pago…» se ve el tatú de los pagos rodando (`PidiendoPago`). Si el cobro queda en curso,
  «Pagando…» sigue rodando sin volver a pararse; si se rechaza, la pantalla del rechazo llega rodando,
  frena en un tercio de vuelta (≈ 0,8 s) y termina en **el logo con la cerradura roja** y una ✕
  (`tatu-logo-error.svg` del zip de identidad; `finalError="logo"`). En el punto, el fallo termina
  igual: enrollado con la cerradura roja (el equipo lo cambió; antes volvía a pararse). La demo tiene
  el selector «Al fallar» para ver las dos.
- **El punto funciona igual que la cuenta.** Al tocar «Pagar» (o consultar una cédula sin pagos) se ve
  «Pidiendo el pago…» con el tatú rodando y se pasa al cobro con sus datos (`irAlCobroDelPunto`), sin
  pantalla de carga: si sigue al PIN, el PIN sale de una vez; si se rechazó (ya cobrado, en proceso…),
  el rechazo llega rodando y termina enrollado en rojo. Lo mismo si el rechazo llega al confirmar el
  PIN (por ejemplo, PIN bloqueado).
- **La tarjeta de Pagando respeta el modo.** Ya no es el bloque Noche fijo: es una tarjeta del tema
  (clara en modo claro, oscura en modo oscuro), con el tatú en el color del texto y el suelo de rayitas
  del original. Los pasos del pago (Solicitado · Pagando · Pagado) usan también los colores del tema.

## 3. Hallazgos

- **H-1** · P5, P6 y P7 se apartan del prototipo en el ícono del bloque (✓ y mano → tatú), por pedido del equipo.
- **H-2** · En desarrollo, React corre los efectos dos veces al montar: el frenado cancela uno anterior para no duplicarse.
- **H-3** · El pago a billetera del beneficiario no se probó de punta a punta en la API simulada (Luis no tiene su
  cédula como llave Bre-B y Ana ya cobró en el escenario); usa los mismos componentes que se probaron en el punto.

## 4. Verificación

`pnpm typecheck`, `pnpm test` (20) y `pnpm build`. En la API simulada, en el punto: un cobro que sale bien (Luis),
uno que falla por el tope del banco (Rosa) y un rechazo «ya cobrado» (Ana, Jorge); el resultado ya pagado abierto
desde el historial del beneficiario. Capturas en celular de Pagando, Pagado y Fallido; consola sin errores.

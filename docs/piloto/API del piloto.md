# API del piloto: todos los endpoints

> Parte del [piloto](./README.md). Catálogo único de las **43 rutas** que usa hoy la API del piloto
> (rama `piloto`, 12 de octubre de 2026), con lo que hace cada una, quién la usa y de dónde salió.
> Todas van bajo `/api` (por ejemplo, `GET /api/programas`). El código está en `api/src/*/rutas.ts`.
>
> **Swagger:** con la API prendida, `http://localhost:3000/api/docs` (o el 3100) muestra estas rutas
> con sus campos y deja probarlas; el JSON está en `/api/openapi.json`. Los cuerpos salen de los
> mismos esquemas Zod que validan las rutas, y `api/src/openapi.test.ts` falla si se agrega una ruta
> sin documentarla. Ojo: «Try it out» llama a la API de verdad y, con `api/.env` lleno, mueve dinero
> de prueba.

**Por qué hay tantas:** la Guía define **9 rutas**. No alcanzan para las pantallas de los
wireframes (hallazgo **D-05**: faltaban 16) ni para lo que salió de probar con dinero real
(registro del equipo, renovación del permiso, caja del punto, bonos). Este documento sirve para
actualizar la API de la Guía antes del evento y para comparar con lo que lleva el equipo en su rama.

**Columna «Origen»:**
- **Guía:** está en la API REST del Documento Guía (alcance original).
- **Piloto:** la agregó el Plan backend para que funcionaran los wireframes (D-05).
- **Ajustes:** la agregó el [Plan de ajustes](./Plan%20de%20ajustes.md) después de probar (§ y hallazgo).

**Columna «Quién»:** Entidad · Beneficiario · Punto (retiro) · Comercio (sede que acepta bonos) ·
Equipo (registro de prueba) · Sistema (la propia API o la Test Wallet).

---

## 1. Programas (la entidad)

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `GET /programas` | Lista los programas (para elegir rol y entrar como entidad) | Entidad | Piloto | HU-19, D-05 |
| `POST /programas` | Crea el programa en Borrador: wallet que paga (toma su moneda), vigencia, tipo, **monto por persona** y, si es bono, sus **categorías** | Entidad | Guía (ampliada en Ajustes § 2 y § 11) | HU-01, HU-21 |
| `GET /programas/:id` | Lee un programa: estado, tope, monto por persona, categorías, si el permiso está vencido | Entidad | Piloto | HU-01 |
| `PATCH /programas/:id` | Edita un borrador (incluye monto por persona y categorías) | Entidad | Piloto | HU-01 |
| `GET /programas/:id/liquidacion` | Cuántas personas registradas y el total: será el tope | Entidad | Piloto | HU-02, RN-08 |
| `POST /programas/:id/autorizar` | Fija el tope y pide el permiso con tope al banco; devuelve la URL para aprobar en la Test Wallet | Entidad | Guía | HU-04 |
| `GET /callback/:id` | Vuelta desde la Test Wallet: verifica el hash, activa el programa (o completa la renovación) y redirige a la web | Sistema | Guía (ampliada en Ajustes D-35) | HU-04, HU-05 |
| `POST /programas/:id/cancelar-aprobacion` | Cancela una aprobación pendiente y vuelve a Borrador | Entidad | Piloto | HU-05, D-09 |
| `POST /programas/:id/renovar-permiso` | Si el permiso venció (la API estuvo apagada), pide uno nuevo **por lo que falta del tope**; lo cobrado se conserva | Entidad | Ajustes (D-35) | HU-06 |
| `GET /programas/:id/tablero` | Autorizado, cobrado (leído del permiso), lo que no ha salido, cobros por canal (cuenta, punto, compra), tiempo de reembolso y lista de cobros | Entidad | Guía | HU-15, HU-16 |
| `POST /programas/:id/pausar` | Pausa los cobros | Entidad | Piloto | HU-18 |
| `POST /programas/:id/reanudar` | Reanuda los cobros | Entidad | Piloto | HU-18 |
| `POST /programas/:id/cerrar` | Cierra (escribiendo CERRAR) y revoca el permiso; guarda lo que nunca salió | Entidad | Guía | HU-17, D-18 |
| `GET /programas/:id/comercios` | Las sedes donde se puede usar un bono | Beneficiario | Ajustes § 11 (D-38) | HU-21 |

## 2. Personas, cuentas y registro del equipo

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `GET /beneficiarios/demo` | Personas para el selector de la entrada (nombre y etiqueta, sin la cédula completa) | Beneficiario | Piloto | HU-19 |
| `GET /beneficiarios` | Personas registradas con su wallet, moneda, estado de la cuenta y si tienen PIN | Equipo | Ajustes § 2 | — |
| `POST /beneficiarios` | **Registra una persona con su cédula y su wallet** (nombre y PIN opcionales); la cuenta queda verificada | Equipo | Ajustes § 2 (D-31) | HU-07 |
| `POST /beneficiarios/:documento/pin` | Pone o cambia el PIN de alguien ya registrado (para retirar en un punto o usar un bono) | Equipo | Ajustes | HU-11 |
| `GET /beneficiarios/:documento/resumen` | Lo que ve la persona: **todos** sus subsidios y bonos pendientes, su cuenta y su historial | Beneficiario | Piloto (ampliada en Ajustes: varios programas) | HU-08 |
| `POST /cuentas` | Enlaza o cambia la wallet de la persona; pide confirmarla en su banco (o simulada) | Beneficiario | Guía | HU-07 |
| `GET /cuentas/:documento` | Estado de la cuenta mientras la persona aprueba | Beneficiario | Piloto | HU-07 |
| `GET /cuentas/callback/:id` | Vuelta desde la Test Wallet al verificar la cuenta | Sistema | Piloto | HU-07, D-03 |

## 3. Cobros (cuenta, retiro y compra con bono)

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `POST /cobros` | Pide un cobro: a la **cuenta** (paga enseguida), **retiro** en un punto o **compra** con bono (esperan el PIN). Aplica todas las reglas y nunca recibe el monto del navegador | Beneficiario, Punto, Comercio | Guía | HU-09, HU-10, HU-21 |
| `POST /cobros/:id/confirmar` | La persona confirma con su PIN y sale el pago | Punto, Comercio | Guía | HU-11, HU-12 |
| `POST /cobros/:id/cancelar` | El punto cancela un cobro que espera el PIN | Punto | Piloto | D-09 |
| `GET /cobros/:id` | Estado del cobro y su línea de tiempo (se consulta cada segundo) | Todos | Guía | HU-12, HU-16 |

## 4. Puntos de retiro y wallets

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `GET /billeteras/resolver` | Valida una wallet («Cuenta encontrada») y devuelve su moneda y su nombre público | Entidad, Equipo | Piloto | HU-01, HU-03 |
| `GET /puntos` | Lista puntos de retiro y sedes de comercios | Todos | Piloto | HU-03 |
| `POST /puntos` | Registra un punto de retiro (nombre y wallet; dirección opcional) | Equipo, Entidad | Piloto (simplificada en Ajustes) | HU-03 |
| `GET /puntos/:id/pagos` | Con la cédula, qué puede pagar **este** punto hoy: subsidios en un punto de retiro, bonos aceptados en una sede. Si hay varios, el punto elige | Punto, Comercio | Ajustes (varios subsidios, § 11) | HU-10, D-21 |
| `GET /puntos/:id/cobros` | Historial del punto: hoy, últimos 7 días o todo | Punto | Piloto (ampliada en Ajustes § 8) | HU-10 |
| `GET /puntos/:id/resumen` | **Mi caja:** entregado, reembolsado, pendiente, tiempo de reembolso y $0 por adelantado | Punto, Comercio | Ajustes § 8 (D-36) | HU-26 propuesta |

## 5. Comercios y bonos con destino

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `GET /categorias` | Categorías de bono (alimentos, salud, educación) con sus actividades CIIU | Entidad, Equipo | Ajustes § 11 | HU-21 |
| `GET /comercios` | Comercios con NIT, actividad, categoría, si están verificados y sus sedes | Equipo, Entidad | Ajustes § 11 | HU-21, D-38 |
| `POST /comercios` | Registra un comercio (NIT, razón social, actividad del RUT) con su primera sede | Equipo | Ajustes § 11 | HU-21, D-38 |
| `POST /comercios/:id/sedes` | Agrega una sede (una cadena tiene varias), con su wallet | Equipo | Ajustes § 11 | D-38 |
| `POST /comercios/:id/verificar` | La entidad verifica el comercio (simula el cruce con el RUT y el RUES) | Entidad | Ajustes § 11 | D-38 |

## 6. Liquidación simulada (el sistema de la entidad)

En producción es otro sistema (AD-12); en el piloto vive en la misma API, bajo `/api/liquidacion`, y
la API lo consume por HTTP.

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `GET /liquidacion/programas/:programaId/resumen` | Cuántas cédulas y cuánto suman (sin las novedades) | Sistema | Piloto | HU-02 |
| `GET /liquidacion/programas/:programaId/pagos/:documento` | Si una cédula tiene pago en ese programa y cuánto | Sistema | Piloto | HU-02 |
| `POST /liquidacion/pin/validar` | Valida el PIN de una cédula (guardado con hash) | Sistema | Piloto | HU-11, D-07 |

## 7. Salud, estado y configuración

| Método y ruta | Qué hace | Quién | Origen | HU / hallazgo |
|---|---|---|---|---|
| `GET /salud` | La base de datos responde y la llave coincide con la publicada en la Test Wallet | Equipo | Piloto | — |
| `GET /estado` | **«Pagos reales» o «simulados»** y qué falta (llave, token falso); lo muestra la página `/estado` | Equipo | Ajustes § 2 | — |
| `GET /config` | Extras prendidos (bonos…) y tiempos de consulta | Web | Piloto | RNF-10 |

---

## 8. Resumen por origen

| Origen | Rutas |
|---|---|
| Guía (alcance original) | 9 |
| Piloto, para que funcionaran los wireframes (D-05) | 21 |
| Ajustes, después de probar con dinero real | 13 |
| **Total** | **43** |

## 9. Pendientes que tocan la API

| Pendiente | Qué haría falta | Dónde |
|---|---|---|
| Actualizar la API de la Guía | Llevar a la Guía las rutas que de verdad hacen falta (esta lista) | D-05 |
| Quien no cobra a tiempo | Decidir si lo no cobrado pasa al siguiente ciclo; avisar en el historial que el programa cerró; marcar «venció» cuando pasa la vigencia | Plan de ajustes § 9, D-37 |
| No aprobar un programa ya vencido | Rechazar en `POST /programas/:id/autorizar` (hoy deja aprobar uno cuya vigencia terminó) | Plan de ajustes § 9 |
| Bonos | Lista de categorías con la entidad; ¿un bono en varias compras? | § 11, D-38 |
| «Activa tu ubicación» | Latitud y longitud de cada sede y punto; la distancia se calcula en el celular (sin ruta nueva) | § 10 |
| Base de datos del evento | Llevar a `db/` (PostgreSQL) lo que agregaron las migraciones `003` a `005` del piloto | Resumen para el equipo § 6 |

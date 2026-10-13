# Tatú · Hackathon Open Payments (Medellín, 16 y 17 de octubre de 2026)

Subsidios que se cobran justo a tiempo con Open Payments (Interledger): la entidad aprueba una vez un
permiso con tope en su banco y cada beneficiario cobra cuando quiere, a su wallet o en efectivo en un
punto que recupera su plata en segundos.

## 👉 Empieza aquí

**[Resumen para el equipo](https://github.com/mauromaecha921-ship-it/test-openpayment/blob/piloto/docs/Resumen%20para%20el%20equipo.md)**
(versión al día, en la rama `piloto`): todo lo importante en un solo documento. Qué es Tatú, qué ya
funciona con dinero de prueba real, qué aprendimos en el piloto, cómo correrlo y qué decidir antes
del evento.

> **Ojo:** el resumen está basado en lo que se construyó y probó en la
> **[rama `piloto`](https://github.com/mauromaecha921-ship-it/test-openpayment/tree/piloto)** (10 a 12 de octubre de 2026): un piloto desechable con pagos reales
> en la Interledger Test Wallet. Ese código y sus documentos viven en esa rama y **nunca se mezclan a
> `main`**, porque la Guía descalifica el código hecho antes del evento. La copia de
> `docs/Resumen para el equipo.md` en `main` es del 12 de octubre por la mañana; la que vale es la de
> `piloto`.

## Lo más reciente del piloto (12 de octubre)

| Qué | Dónde (rama `piloto`) |
|---|---|
| **Los 43 endpoints** que usa la API: qué hace cada uno, quién lo usa y si viene de la Guía (9), del piloto (21) o de lo que salió al probar (13) | [API del piloto](https://github.com/mauromaecha921-ship-it/test-openpayment/blob/piloto/docs/piloto/API%20del%20piloto.md) |
| **Bonos con destino** en comercios verificados por categoría (NIT y actividad del RUT, sedes con su wallet) | [Plan de ajustes § 11](https://github.com/mauromaecha921-ship-it/test-openpayment/blob/piloto/docs/piloto/Plan%20de%20ajustes.md) |
| **Pendientes por decidir:** quien no cobra a tiempo (D-37), categorías de los bonos (D-38), «activa tu ubicación» | [Resultados del piloto](https://github.com/mauromaecha921-ship-it/test-openpayment/blob/piloto/docs/piloto/Resultados%20del%20piloto.md) |

## Lo demás

| Carpeta | Qué hay |
|---|---|
| [`docs/`](./docs/README.md) | Detalle y contexto (sobre todo para la IA): Guía, Historias de usuario, Arquitectura, Reglas de negocio y Endpoints |
| [`db/`](./db/README.md) | Esquema de base de datos en PostgreSQL (`001` a `003`), datos de prueba y diagrama |
| `wireframe/` | Wireframes de las 22 pantallas |
| [Rama `piloto`](https://github.com/mauromaecha921-ship-it/test-openpayment/tree/piloto) | El piloto: `api/`, `web/` y `docs/piloto/` con todos los hallazgos |

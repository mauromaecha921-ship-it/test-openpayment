# Tatú · Hackathon Open Payments (Medellín, 16 y 17 de octubre de 2026)

Subsidios que se cobran justo a tiempo con Open Payments (Interledger): la entidad aprueba una vez un
permiso con tope en su banco y cada beneficiario cobra cuando quiere, a su wallet o en efectivo en un
punto que recupera su plata en segundos.

## 👉 Empieza aquí

**[Resumen para el equipo](./docs/Resumen%20para%20el%20equipo.md)**: todo lo importante en un solo
documento. Qué es Tatú, qué ya funciona con dinero de prueba real, qué aprendimos en el piloto, cómo
correrlo y qué decidir antes del evento.

> **Ojo:** el resumen está basado en lo que se construyó y probó en la
> **[rama `piloto`](https://github.com/mauromaecha921-ship-it/test-openpayment/tree/piloto)** (10 a 12 de octubre de 2026): un piloto desechable con pagos reales
> en la Interledger Test Wallet. Ese código vive solo en esa rama y **nunca se mezcla a `main`**,
> porque la Guía descalifica el código hecho antes del evento; aquí solo quedan los documentos y los
> aprendizajes.

## Lo demás

| Carpeta | Qué hay |
|---|---|
| [`docs/`](./docs/README.md) | Detalle y contexto (sobre todo para la IA): Guía, Historias de usuario, Arquitectura, Reglas de negocio y Endpoints |
| [`db/`](./db/README.md) | Esquema de base de datos en PostgreSQL (`001` a `003`), datos de prueba y diagrama |
| `wireframe/` | Wireframes de las 22 pantallas |
| [Rama `piloto`](https://github.com/mauromaecha921-ship-it/test-openpayment/tree/piloto) | El piloto: `api/`, `web/` y `docs/piloto/` con todos los hallazgos |

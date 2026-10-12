# Tatú · Hackathon Open Payments (Medellín, 16 y 17 de octubre de 2026)

Subsidios que se cobran justo a tiempo con Open Payments (Interledger): la entidad aprueba una vez un
permiso con tope en su banco y cada beneficiario cobra cuando quiere, a su wallet o en efectivo en un
punto que recupera su plata en segundos.

## 👉 Empieza aquí

**[Resumen para el equipo](./docs/Resumen%20para%20el%20equipo.md)**: todo lo importante en un solo
documento. Qué es Tatú, qué ya funciona con dinero de prueba real, qué aprendimos en el piloto, cómo
correrlo y qué decidir antes del evento.

> **Ojo:** el resumen está basado en lo que se construyó y probó en esta rama, **`piloto`** (10 a 12
> de octubre de 2026): un piloto desechable con pagos reales en la Interledger Test Wallet. Es para
> aprender y validar la documentación; el código del evento se escribe desde cero.

## Lo demás

| Carpeta | Qué hay |
|---|---|
| [`docs/`](./docs/README.md) | Detalle y contexto (sobre todo para la IA): Guía, Historias de usuario, Arquitectura, Reglas de negocio, Endpoints y el [piloto](./docs/piloto/README.md) |
| [`db/`](./db/README.md) | Esquema de base de datos en PostgreSQL y datos de prueba |
| `wireframe/` | Wireframes de las 22 pantallas |
| [`api/`](./api/README.md) y [`web/`](./web/README.md) | Código del **piloto desechable** (solo en la rama `piloto`; nunca se mezcla a `main`, porque la Guía descalifica el código hecho antes del evento) |

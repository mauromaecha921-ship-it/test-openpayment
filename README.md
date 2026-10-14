# Tatú · Hackathon Open Payments (Medellín, 16 y 17 de octubre de 2026)

Subsidios que se cobran justo a tiempo con Open Payments (Interledger): la entidad aprueba una vez un
permiso con tope en su banco y cada beneficiario cobra cuando quiere, a su wallet o en efectivo en un
punto que recupera su plata en segundos.

**Piloto desplegado:** <https://test-openpayment.vercel.app> (web y API en Vercel, base en Supabase).

## 👉 Empieza aquí

**[Resumen para el equipo](./docs/Resumen%20para%20el%20equipo.md)**: todo lo importante en un solo
documento. Qué es Tatú, qué ya funciona con dinero de prueba real, qué aprendimos en el piloto, cómo
usarlo o correrlo y qué decidir antes del evento.

> **Ojo:** esta rama, **`piloto-v2`**, es un piloto desechable con pagos reales en la Interledger
> Test Wallet (10 a 14 de octubre de 2026). Es para aprender y validar la documentación; el código
> del evento se escribe desde cero. La rama **`produccion`** es la que despliega Vercel, y la rama
> `piloto` conserva la primera versión, con SQLite.

## Lo demás

| Carpeta | Qué hay |
|---|---|
| [`docs/`](./docs/README.md) | Detalle y contexto (sobre todo para la IA): Guía, Historias de usuario, Arquitectura (con el despliegue en la § 3.6), Reglas de negocio, Endpoints y el [piloto](./docs/piloto/README.md) |
| [`db/`](./db/README.md) | Esquema de base de datos en PostgreSQL y datos de prueba |
| `wireframe/` | Wireframes de las 22 pantallas |
| [`server/`](./server/README.md) y [`web/`](./web/README.md) | Código del **piloto desechable**: la API (Express, Drizzle y Supabase) y la web (React y Vite). Nunca se mezcla a `main`, porque la Guía descalifica el código hecho antes del evento |
| `vercel.json` y `scripts/build-vercel.mjs` | Cómo Vercel arma la web y la API en un solo despliegue |

# Tatú

La capa de distribución que convierte una liquidación ya aprobada en **pagos bajo
demanda** con Open Payments: la entidad aprueba una sola vez un permiso con tope y
cada peso sale de su cuenta solo cuando el beneficiario cobra, a su propia cuenta o
en un punto físico con cédula y PIN.

Monolito modular en un solo proceso (AD-01): una API Node + Express y una web React
con tres vistas (entidad, beneficiario y punto). Toda la documentación del proyecto
vive en [`docs/`](./docs/README.md).

## Requisitos

- Node.js 24 LTS
- pnpm 12

## Cómo correrlo

```bash
pnpm install
cp .env.example .env   # completar los valores (sin secretos en el repo)
pnpm dev               # API en :3000 y web en :5173, en paralelo
```

Comandos por paquete: `pnpm --filter api dev|test|typecheck` y
`pnpm --filter web dev|build|lint`.

## Estructura

```text
api/    Node 24 + Express + tsx + Zod + SDK @interledger/open-payments 7.4.0
web/    React + Vite + Tailwind CSS
docs/   Toda la documentación (guía, arquitectura, historias, endpoints)
```

El diseño del árbol y los mapas ruta → archivo y HU → archivo están en
[`docs/Estructura del proyecto.md`](./docs/Estructura%20del%20proyecto.md).

## Entregables del hackathon

- `AI_USAGE.md` y [`prompts/`](./prompts) (obligatorios).
- Video de la demo: _pendiente_.

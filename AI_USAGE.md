# Uso de IA en el proyecto

Entregable obligatorio del hackathon (Guía § Entregables): aquí se declara qué
herramientas de IA se usaron y para qué. El texto real de los prompts se guarda en
[`/prompts`](./prompts) mientras cada persona trabaja, no al final.

## Registro

### 6 de octubre de 2026 — Esqueleto del repositorio

- **Herramienta:** OpenCode (agente de código con IA).
- **Qué se generó:** la estructura inicial del repo (archivos de la raíz, módulos
  y stubs de `api/`, limpieza y carpetas de `web/`), siguiendo
  `docs/Estructura del proyecto.md`. Sin lógica de negocio ni llamadas a Open
  Payments.
- **Qué queda para escribir a mano:** `openPaymentsService.ts` (lo escribe y lo
  entiende el equipo con poca IA — Guía § Estructura del repositorio), reglas de
  negocio y vistas.

### 11 de octubre de 2026 — Épica 1 (API)

- **Herramienta:** OpenCode (agente de código con IA).
- **Qué se generó:** la parte de API de la épica 1 siguiendo las historias y la
  estructura del proyecto: el simulador de liquidación, HU-02
  (`liquidacion/contrato.ts`, `datos.ts`, `router.ts` y sus pruebas), y el
  registro de puntos de retiro, HU-03 (`puntos/servicio.ts`, `puntos/rutas.ts`,
  `db/repositorios/puntos.ts`, el `buscarProgramaPorId` del repositorio de
  programas y sus pruebas), más el montaje de `/puntos` en `main.ts`.
- **Qué queda para escribir a mano:** las llamadas al SDK en
  `openPaymentsService.ts` (en la épica 1, `walletAddress.get`, que usan HU-01 y
  HU-03). No se pudieron generar con IA por la restricción del proyecto
  (Guía § Estructura del repositorio): las debe implementar y entender el equipo
  (Rol 1).

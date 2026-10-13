# Plan: aplicar la identidad visual de Tatú al front del piloto

**Estado:** aplicado en `piloto-v2` (13 oct 2026).

Fuente: `D:\PRE-Hackathon\FRORNT Y ESTILO VISUAL` (zip con 5 logos SVG, «Exploración de logo.pdf»
con la paleta y `tatu-prototipo.html`). Cierra el pendiente **P-17** del Plan frontend § 6.

## 1. Qué trae la identidad

| Nombre | Color | Uso según el PDF / prototipo |
|---|---|---|
| Noche | `#13203A` | Texto, trazo del logo, fondo oscuro |
| Arena | `#F5F0E6` | Fondo de la app |
| Ámbar | `#F6A623` | Cerradura del logo, acentos (ícono del punto) |
| Azul vivo | `#2E5FE0` | Acciones: botones, enlaces, foco |
| Arcilla / Barro | `#6E4630` / `#9C5A3C` | Tierra, adicional: fondos de apoyo, detalles |
| Pagado (reservado) | `#1B7F4B` | Solo para «Pagado» |

Del prototipo salen además: tarjetas `#FFFDF8`, bordes `#E2D8C4`, texto secundario `#4A5468`,
caja de aviso `#EDE5D3`, rechazo `#A3261C` sobre `#F8E4DF`, «Disponible» sobre `#FCE3B4`, y la
tipografía **Archivo** (variable, ancho 62–125; el logotipo «Tatú» va en 800 al 125 %).

Logos: `claro` (sobre arena), `oscuro` (sobre noche), `tierra` (sobre arcilla), `línea sola` e
`ícono pequeño`.

## 2. Cambios (solo `web/`, el backend no se toca)

1. **Tokens** en `web/src/index.css`: todo el front ya usa variables (`bg-primary`, `text-pagado`…),
   así que casi todo el cambio es aquí.

   | Token | Antes | Después |
   |---|---|---|
   | background | `#ffffff` | Arena `#F5F0E6` |
   | foreground | `#1c1c1c` | Noche `#13203A` |
   | card / popover | `#ffffff` | `#FFFDF8` |
   | primary (botones) | `#1c1c1c` | Azul vivo `#2E5FE0` + texto blanco (5,5:1) |
   | secondary / muted | grises | `#EDE5D3` |
   | muted-foreground / tenue | `#4d4d4d` / `#6b6b6b` | `#4A5468` / `#5A657A` (≥ 4,5:1 sobre arena y `#EDE5D3`) |
   | border / control | `#d4d4d0` / `#8c8c88` | `#E2D8C4` / `#847A66` (`#8F8571` del prototipo da 2,9:1 sobre `#EDE5D3`) |
   | ring / enlace | `#1f55c6` | `#2E5FE0` (foco) · `#1E4FC8` (enlaces, ≥ 4,5:1 también sobre `#EDE5D3`) |
   | pagado | verde gris | `#1B7F4B` en rellenos; texto en `#17703F` (ver hallazgo H-1) |
   | pagando | `#7a4b00` / `#fdf1dc` | Arcilla `#6E4630` sobre `#FCE3B4` (6,5:1) |
   | rechazo / destructive | `#a2231d` | `#A3261C` sobre `#F8E4DF` (6,0:1) |
   | radius | 12 px | 14 px (el prototipo usa 12–18) |

2. **Tipografía**: instalar `@fontsource-variable/archivo` (con eje de ancho) y usarla como
   `--font-sans`; quitar Atkinson Hyperlegible. IBM Plex Mono se queda para direcciones de
   billetera e identificadores.
3. **Logo**: copiar los SVG a `web/public/marca/`. El componente `Logo` (`Encabezado.tsx`) pasa del
   cuadro gris al ícono + «Tatú» en Archivo 800 ancho 125 %.
4. **Entrada** (`vistas/Entrada.tsx`): arriba, el logo claro grande con «Tatú» y la frase del
   prototipo; los íconos de las tres tarjetas de rol con los colores del prototipo (Entidad noche,
   Beneficiario azul, Punto ámbar). Se mantiene el diseño responsive actual (columnas en PC).
5. **Pantallas de éxito** (`CobroPagado`, `CobroEnPunto`, `EnlazarCuenta`): el círculo verde ya usa
   `bg-pagado`; solo se revisa que quede como en el prototipo.
6. **Favicon y `index.html`**: favicon = ícono sobre noche (`tatu-logo-oscuro.svg`),
   `theme-color` `#13203A`.
7. **Sin cambios**: `BancoSimulado.tsx` (imita otro banco, lleva su propio estilo), el layout y la
   navegación, el modo oscuro (el piloto sigue solo en claro).
8. **Docs**: Plan frontend § 6 (P-17 resuelto) y el comentario de `index.css`.

## 3. Hallazgos para el equipo

- **H-1** · `#1B7F4B` como texto sobre arena da 4,42:1 (< 4,5 de WCAG AA). Propuesta: en rellenos
  (chip «Pagado» sólido con texto blanco, 5,0:1, como el prototipo) se usa tal cual; para texto
  verde se usa `#17703F` (5,4:1).
- **H-2** · Azul vivo `#2E5FE0` como texto sobre `#EDE5D3` da 4,37:1; los enlaces usan `#1E4FC8`,
  que ya está en el prototipo.
- **H-3** · El prototipo es de columna de celular (máx. 480 px). Igual que con los wireframes, se
  toman colores, tipografía y componentes, no el ancho: el front sigue adaptándose a PC y celular.
- **H-4** · Atkinson Hyperlegible se eligió por legibilidad. Archivo es legible a 16 px o más; se
  mantiene el tamaño base de 16 px y las cifras tabulares (`tabular-nums`) del prototipo.

## 4. Verificación

`pnpm typecheck`, `pnpm test` y `pnpm build` en `web/`; abrir el piloto (API simulada) en PC y en
celular (375 px), recorrer Entrada, Entidad, Beneficiario y Punto, revisar contrastes y foco, y
dejar capturas.

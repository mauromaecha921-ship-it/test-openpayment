-- =====================================================================
-- Tatú · Renovar el permiso (hallazgo D-35)
-- El token del permiso dura 10 minutos: la API lo rota en segundo plano.
-- Si estuvo apagada mucho tiempo y el banco ya no acepta la rotación, el
-- programa queda con el permiso vencido hasta que la entidad lo renueve
-- (un permiso nuevo por lo que falta del tope). El programa sigue Activo
-- o Pausado: el token viejo se conserva por la restricción activo_con_permiso.
-- =====================================================================

-- Cuándo se detectó que el permiso ya no se puede usar ni rotar. NULL = vigente.
ALTER TABLE programa ADD COLUMN permiso_vencido_en TEXT;

-- Lo que salió con permisos anteriores del mismo programa: el permiso nuevo solo
-- conoce su propio gasto, y el tablero suma los dos.
ALTER TABLE programa ADD COLUMN gastado_permisos_anteriores INTEGER NOT NULL DEFAULT 0
  CHECK (gastado_permisos_anteriores >= 0);

-- =====================================================================
-- Tatú · Bonos con destino y comercios verificados (Plan de ajustes § 11)
-- Un comercio (NIT, razón social, actividad CIIU) tiene una o más sedes;
-- cada sede es un punto de tipo «compra» con su propia wallet. El gobierno
-- verifica el comercio (en producción, con el RUT y el RUES; en el piloto,
-- un botón). Un bono acepta categorías: lo aceptan las sedes de comercios
-- verificados de esas categorías.
-- =====================================================================

CREATE TABLE comercio (
  id             TEXT PRIMARY KEY,
  nit            TEXT NOT NULL UNIQUE CHECK (length(nit) BETWEEN 5 AND 15 AND nit NOT GLOB '*[^0-9]*'),
  razon_social   TEXT NOT NULL CHECK (length(razon_social) BETWEEN 3 AND 120),
  -- Actividad económica del RUT (CIIU rev. 4 A.C., 4 dígitos) y la categoría que se deduce de ella
  ciiu           TEXT NOT NULL CHECK (length(ciiu) = 4 AND ciiu NOT GLOB '*[^0-9]*'),
  categoria      TEXT NOT NULL,
  -- NULL = por verificar; la entidad lo verifica antes de que acepte bonos
  verificado_en  TEXT,
  creado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Las sedes son puntos de tipo «compra» que apuntan a su comercio
ALTER TABLE punto ADD COLUMN comercio_id TEXT REFERENCES comercio (id);

-- Las categorías que acepta cada bono
CREATE TABLE programa_categoria (
  programa_id  TEXT NOT NULL REFERENCES programa (id) ON DELETE RESTRICT,
  categoria    TEXT NOT NULL,
  PRIMARY KEY (programa_id, categoria)
) STRICT;

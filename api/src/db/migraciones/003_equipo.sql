-- =====================================================================
-- Tatú · Registro del equipo (Plan de ajustes § 2)
-- La liquidación simulada pasa de una lista fija en el código a esta
-- tabla, para que el equipo registre personas (cédula y wallet) desde la
-- app. Representa el sistema de la entidad (AD-12): por eso el PIN vive
-- aquí y no en `beneficiario`. El PIN es opcional: sin PIN la persona
-- solo cobra a su cuenta.
-- =====================================================================

CREATE TABLE liquidacion_persona (
  documento  TEXT PRIMARY KEY
             CHECK (length(documento) BETWEEN 3 AND 20 AND documento NOT GLOB '*[^A-Za-z0-9]*'),
  -- Múltiplo del monto por persona del programa (la demo usa 2 para Rosa)
  veces      INTEGER NOT NULL DEFAULT 1 CHECK (veces >= 1),
  -- «sal:hash» en hex (scrypt); NULL = sin PIN
  pin_hash   TEXT,
  -- Retroactivo fijo (Rosa en la demo). Quien se registra después de fijar
  -- el tope de un programa también es novedad para ese programa (RN-08).
  novedad    INTEGER NOT NULL DEFAULT 0 CHECK (novedad IN (0, 1)),
  creado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Lo que recibe cada persona, en unidades mínimas. NULL = LIQUIDACION_MONTO_BASE.
ALTER TABLE programa ADD COLUMN monto_por_persona INTEGER CHECK (monto_por_persona > 0);

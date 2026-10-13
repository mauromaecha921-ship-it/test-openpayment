-- =====================================================================
-- Tatú · Simulador del sistema del gobierno (esquema `piloto_gobierno`)
-- Tatú guarda lo mínimo (docs/piloto/Plan Supabase y pnpm.md § 3): quién
-- recibe, cuánto y su huella (en el MVP, el PIN) son del gobierno, que se
-- los pasa a Tatú por un endpoint. En el piloto ese sistema vive en la
-- misma base, en su propio esquema, y la API de Tatú solo lo lee por
-- HTTP (LIQUIDACION_URL), nunca con SQL. En producción no existe aquí.
-- =====================================================================

BEGIN;

CREATE SCHEMA piloto_gobierno;

-- La liquidación: cada persona con su nombre, cuántas veces el monto por
-- persona del programa recibe (la demo usa 2 para un retroactivo) y su PIN.
CREATE TABLE piloto_gobierno.persona (
  documento  text PRIMARY KEY CHECK (documento ~ '^[A-Za-z0-9]{3,20}$'),
  nombre     text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  veces      integer NOT NULL DEFAULT 1 CHECK (veces >= 1),
  pin_hash   text,                              -- «sal:hash» en hex (scrypt); NULL = sin PIN
  -- Retroactivo fijo (Rosa en la demo). Quien se registra después de que un
  -- programa fijó su tope también es novedad para ese programa (RN-08).
  novedad    boolean NOT NULL DEFAULT false,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE piloto_gobierno.persona ENABLE ROW LEVEL SECURITY;

COMMIT;

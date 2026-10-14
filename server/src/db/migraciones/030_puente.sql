-- =====================================================================
-- Tatú · Simulador del banco puente de Bre-B (esquema `piloto_puente`)
-- Plan Bre-B § 3.1 y Arquitectura AD-21. Hace el papel de un banco o SEDPE
-- que participa en Bre-B y opera Rafiki: sabe a qué cuenta va cada llave
-- y de quién es. En el piloto cada llave apunta a una wallet de la Test
-- Wallet. La API de Tatú lo consulta por HTTP (PUENTE_URL), nunca con SQL,
-- igual que a la liquidación. En producción no existe aquí: es el banco.
-- =====================================================================

BEGIN;

CREATE SCHEMA piloto_puente;

-- Una llave apunta a una sola cuenta (regla de unicidad del DICE de Bre-B).
-- `documento_titular` y `nombre_titular` son del banco: Tatú nunca los
-- guarda; solo pregunta «¿es de esta cédula?» y muestra el nombre enmascarado.
CREATE TABLE piloto_puente.llave (
  tipo               text NOT NULL CHECK (tipo IN ('cedula', 'celular', 'correo', 'alfanumerica')),
  valor              text NOT NULL CHECK (char_length(valor) BETWEEN 3 AND 80),
  documento_titular  text NOT NULL CHECK (documento_titular ~ '^[A-Za-z0-9]{3,20}$'),
  nombre_titular     text NOT NULL CHECK (char_length(nombre_titular) BETWEEN 1 AND 120),
  billetera          text NOT NULL CHECK (billetera LIKE 'https://%'),
  creado_en          timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tipo, valor),
  -- Una llave tipo cédula solo la registra su titular
  CONSTRAINT cedula_del_titular CHECK (tipo <> 'cedula' OR valor = documento_titular)
);

ALTER TABLE piloto_puente.llave ENABLE ROW LEVEL SECURITY;

COMMIT;

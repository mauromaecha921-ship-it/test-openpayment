-- =====================================================================
-- Tatú · La cuenta del beneficiario puede ser una llave Bre-B
-- Plan Bre-B § 3.2, RN-14 a RN-18. La persona elige el tipo (RN-14);
-- `billetera` sigue igual y guarda la última wallet que devolvió el banco
-- puente para esa llave (se vuelve a resolver en cada cobro, RN-18). Sin
-- llave, la cuenta es una wallet Open Payments escrita a mano (como antes).
-- =====================================================================

BEGIN;

CREATE TYPE tipo_llave AS ENUM ('cedula', 'celular', 'correo', 'alfanumerica');

ALTER TABLE cuenta_beneficiario
  ADD COLUMN tipo_llave tipo_llave,
  ADD COLUMN llave      text CHECK (char_length(llave) BETWEEN 3 AND 80),
  ADD CONSTRAINT llave_con_tipo CHECK ((tipo_llave IS NULL) = (llave IS NULL));

COMMIT;

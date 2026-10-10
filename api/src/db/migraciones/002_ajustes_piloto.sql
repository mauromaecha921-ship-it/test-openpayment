-- =====================================================================
-- Tatú · Ajustes del piloto al esquema (desviación 2, Plan backend § 4.2)
-- D-03: sin la uri y el token de continuación no se puede llamar
-- grant.continue en el callback de HU-07. Son temporales y solo del
-- backend: se ponen en NULL al terminar la verificación.
-- =====================================================================

ALTER TABLE cuenta_beneficiario ADD COLUMN uri_continuacion TEXT;
ALTER TABLE cuenta_beneficiario ADD COLUMN token_continuacion TEXT;

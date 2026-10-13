-- =====================================================================
-- Tatú · Lo que el piloto le agrega al esquema de main (db/001 y db/003)
-- Corre después de 001_esquema.sql y 003_ajustes.sql, que son copia
-- exacta de db/. Cada cambio resuelve algo que el esquema original no
-- había considerado y que salió de probar con dinero real
-- (docs/piloto/Resultados del piloto.md). Para el evento, esto se lleva
-- a db/ de main.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Cuenta del beneficiario
--    D-03: sin la uri y el token de continuación no se puede llamar
--    grant.continue en el callback de la verificación (HU-07). Son
--    temporales y solo del backend: se ponen en NULL al terminar.
--    D-41: sin fecha de creación no hay cómo saber cuál es la última.
-- ---------------------------------------------------------------------
ALTER TABLE cuenta_beneficiario
  ADD COLUMN uri_continuacion   text,
  ADD COLUMN token_continuacion text,
  ADD COLUMN creado_en          timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------
-- 2. Programa
--    Monto por persona (Plan de ajustes § 2): la entidad dice cuánto
--    recibe cada persona; NULL = LIQUIDACION_MONTO_BASE de la API.
--    D-35: el token del permiso dura 10 minutos y la API lo rota; si el
--    banco ya no acepta la rotación, el permiso queda vencido hasta que la
--    entidad lo renueve, y lo que salió con el permiso viejo se suma al
--    nuevo en el tablero.
--    D-41: fecha de creación para listar los programas en orden.
-- ---------------------------------------------------------------------
ALTER TABLE programa
  ADD COLUMN monto_por_persona           bigint CHECK (monto_por_persona > 0),
  ADD COLUMN permiso_vencido_en          timestamptz,
  ADD COLUMN gastado_permisos_anteriores bigint NOT NULL DEFAULT 0 CHECK (gastado_permisos_anteriores >= 0),
  ADD COLUMN creado_en                   timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------
-- 3. Comercios verificados y bonos por categoría (D-38, Plan de ajustes § 11)
--    Un comercio (NIT y actividad CIIU del RUT) tiene una o más sedes;
--    cada sede es un punto de tipo «compra» con su propia wallet. La
--    entidad lo verifica (en producción, con el RUT y el RUES). Un bono
--    acepta categorías: lo aceptan las sedes de los comercios verificados
--    de esas categorías.
-- ---------------------------------------------------------------------
CREATE TABLE comercio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nit            text NOT NULL UNIQUE CHECK (nit ~ '^[0-9]{5,15}$'),
  razon_social   text NOT NULL CHECK (char_length(razon_social) BETWEEN 3 AND 120),
  ciiu           text NOT NULL CHECK (ciiu ~ '^[0-9]{4}$'),
  categoria      text NOT NULL,
  verificado_en  timestamptz,                   -- NULL = por verificar
  creado_en      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE punto
  ADD COLUMN comercio_id uuid REFERENCES comercio (id) ON DELETE RESTRICT,
  ADD CONSTRAINT sede_es_de_compra CHECK (comercio_id IS NULL OR tipo = 'compra');

CREATE TABLE programa_categoria (
  programa_id  uuid NOT NULL REFERENCES programa (id) ON DELETE RESTRICT,
  categoria    text NOT NULL,
  PRIMARY KEY (programa_id, categoria)
);

-- ---------------------------------------------------------------------
-- 4. D-39: la regla RN-03 del bono en la base
--    db/003 solo autoriza un comercio si está en programa_punto (la lista
--    del extra HU-21). El piloto autoriza también por categoría: una sede
--    de un comercio verificado cuya categoría acepta el bono. El resto de
--    la función es igual a la de db/003.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cobro_reglas() RETURNS trigger AS $$
DECLARE
  p  programa%ROWTYPE;
  tipo_del_punto tipo_punto;
BEGIN
  IF NEW.estado = 'Rechazado' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO p FROM programa WHERE id = NEW.programa_id;

  IF p.estado <> 'Activo' OR now() NOT BETWEEN p.vigencia_inicio AND p.vigencia_fin THEN
    RAISE EXCEPTION 'RN-06: el programa no está recibiendo cobros (estado % o fuera de vigencia)', p.estado;
  END IF;

  IF p.tipo = 'subsidio' AND NEW.canal = 'compra' THEN
    RAISE EXCEPTION 'RN-03: un subsidio se cobra a la cuenta o en un punto de retiro';
  END IF;

  IF p.tipo = 'bono' THEN
    IF NEW.canal <> 'compra' THEN
      RAISE EXCEPTION 'RN-03: un bono solo se usa en una compra';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM programa_punto
                    WHERE programa_id = NEW.programa_id AND punto_id = NEW.punto_id)
       AND NOT EXISTS (SELECT 1 FROM punto s
                         JOIN comercio c ON c.id = s.comercio_id AND c.verificado_en IS NOT NULL
                         JOIN programa_categoria pc ON pc.programa_id = NEW.programa_id
                                                  AND pc.categoria = c.categoria
                        WHERE s.id = NEW.punto_id) THEN
      RAISE EXCEPTION 'RN-03: este comercio no acepta este bono';
    END IF;
  END IF;

  IF NEW.punto_id IS NOT NULL THEN
    SELECT tipo INTO tipo_del_punto FROM punto WHERE id = NEW.punto_id;
    IF tipo_del_punto::text <> NEW.canal::text THEN
      RAISE EXCEPTION 'RN-03: un punto de % no atiende el canal %', tipo_del_punto, NEW.canal;
    END IF;
  END IF;

  IF NEW.canal = 'cuenta' AND NOT EXISTS (SELECT 1 FROM cuenta_beneficiario
                                           WHERE id = NEW.cuenta_id AND estado = 'Verificada') THEN
    RAISE EXCEPTION 'RN-04: la cuenta no está verificada';
  END IF;

  IF EXISTS (SELECT 1 FROM bloqueo_pin
              WHERE programa_id = NEW.programa_id
                AND beneficiario_id = NEW.beneficiario_id
                AND bloqueado_hasta > now()) THEN
    RAISE EXCEPTION 'RN-07: la persona está bloqueada por PIN en este programa';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 5. RLS en las tablas nuevas, igual que db/003 (sin políticas: la API
--    se conecta como dueña de las tablas y no pasa por RLS)
-- ---------------------------------------------------------------------
ALTER TABLE comercio           ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_categoria ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 6. Las funciones de los triggers buscan sus tablas en el esquema donde
--    se crearon, no en el de quien las llama. Sin esto, en una base con
--    otro esquema con tablas del mismo nombre (el piloto vive en `piloto`
--    junto a `public` del equipo), `FROM programa` podía leer la tabla
--    equivocada. Es también lo que pide el revisor de seguridad de
--    Supabase («function_search_path_mutable»). FROM CURRENT toma el
--    esquema en el que corre esta migración (en db/ de main, `public`).
-- ---------------------------------------------------------------------
ALTER FUNCTION fn_programa_moneda_fija() SET search_path FROM CURRENT;
ALTER FUNCTION fn_cobro_transicion()     SET search_path FROM CURRENT;
ALTER FUNCTION fn_prohibir_borrado()     SET search_path FROM CURRENT;
ALTER FUNCTION fn_evento_inmutable()     SET search_path FROM CURRENT;
ALTER FUNCTION fn_cobro_reglas()         SET search_path FROM CURRENT;

COMMIT;

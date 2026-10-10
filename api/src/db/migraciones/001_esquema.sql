-- =====================================================================
-- Tatú · Esquema de base de datos (SQLite, piloto)
-- Traducción fiel de db/001_esquema.sql (PostgreSQL). Mismas tablas,
-- columnas, restricciones, índices y triggers; cambia solo la sintaxis
-- (Plan backend § 4.1). Montos: enteros en unidades mínimas según
-- escala_moneda ($230.000,00 con escala 2 = 23000000). Nunca float.
-- Fechas: texto ISO 8601 UTC ('2026-10-16T15:00:00.000Z').
-- =====================================================================

-- ---------------------------------------------------------------------
-- secuencia: reemplaza a cobro_referencia_seq (desviación 1, § 4.2)
-- ---------------------------------------------------------------------
CREATE TABLE secuencia (
  nombre  TEXT    PRIMARY KEY,
  valor   INTEGER NOT NULL CHECK (valor >= 0)
) STRICT;

INSERT INTO secuencia (nombre, valor) VALUES ('cobro_referencia', 0);

-- ---------------------------------------------------------------------
-- municipio: catálogo DANE
-- ---------------------------------------------------------------------
CREATE TABLE municipio (
  codigo_dane   TEXT PRIMARY KEY
                CHECK (length(codigo_dane) = 5 AND codigo_dane NOT GLOB '*[^0-9]*'),
  nombre        TEXT NOT NULL,
  departamento  TEXT NOT NULL
) STRICT;

-- ---------------------------------------------------------------------
-- programa: reglas del programa + permiso de Open Payments
-- ---------------------------------------------------------------------
CREATE TABLE programa (
  id                  TEXT PRIMARY KEY,
  entidad             TEXT NOT NULL CHECK (length(entidad) BETWEEN 3 AND 80),
  nombre              TEXT NOT NULL CHECK (length(nombre)  BETWEEN 3 AND 80),
  tipo                TEXT NOT NULL CHECK (tipo IN ('subsidio', 'bono')),
  destino             TEXT NOT NULL CHECK (destino IN ('libre', 'restringido')),
  billetera_programa  TEXT NOT NULL CHECK (billetera_programa LIKE 'https://%'),
  codigo_moneda       TEXT NOT NULL
                      CHECK (length(codigo_moneda) = 3 AND codigo_moneda GLOB '[A-Z][A-Z][A-Z]'),
  escala_moneda       INTEGER NOT NULL CHECK (escala_moneda BETWEEN 0 AND 18),
  vigencia_inicio     TEXT NOT NULL CHECK (vigencia_inicio GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  vigencia_fin        TEXT NOT NULL CHECK (vigencia_fin    GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'),
  tope_total          INTEGER CHECK (tope_total > 0),          -- se fija al pedir la aprobación (RN-08)
  estado              TEXT NOT NULL DEFAULT 'Borrador'
                      CHECK (estado IN ('Borrador', 'EsperandoAprobacion', 'Activo', 'Pausado', 'Cerrado')),

  -- Permiso de Open Payments. Solo backend; nunca al navegador ni a evento.
  -- En producción: cifrados con una llave de KMS y en tabla aparte.
  token_acceso        TEXT,
  url_gestion         TEXT,
  uri_continuacion    TEXT,
  token_continuacion  TEXT,
  nonce_cliente       TEXT,
  nonce_cierre        TEXT,
  url_permiso         TEXT,

  CONSTRAINT vigencia_valida      CHECK (vigencia_fin > vigencia_inicio),
  CONSTRAINT destino_segun_tipo   CHECK ((tipo = 'subsidio' AND destino = 'libre')
                                      OR (tipo = 'bono'     AND destino = 'restringido')),
  CONSTRAINT tope_antes_de_aprobar CHECK (estado = 'Borrador' OR tope_total IS NOT NULL),
  CONSTRAINT activo_con_permiso   CHECK (estado NOT IN ('Activo', 'Pausado')
                                      OR (token_acceso IS NOT NULL AND url_gestion IS NOT NULL))
) STRICT;

-- La cuenta y la moneda no cambian una vez el programa salió de Borrador
-- (cobro.monto no guarda moneda: la hereda del programa).
CREATE TRIGGER programa_moneda_fija BEFORE UPDATE ON programa
WHEN OLD.estado <> 'Borrador'
 AND (NEW.billetera_programa IS NOT OLD.billetera_programa
   OR NEW.codigo_moneda      IS NOT OLD.codigo_moneda
   OR NEW.escala_moneda      IS NOT OLD.escala_moneda)
BEGIN
  SELECT RAISE(ABORT, 'La billetera y la moneda del programa no cambian fuera de Borrador');
END;

-- ---------------------------------------------------------------------
-- punto: puntos de retiro y comercios
-- ---------------------------------------------------------------------
CREATE TABLE punto (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  direccion  TEXT NOT NULL,
  billetera  TEXT NOT NULL UNIQUE CHECK (billetera LIKE 'https://%'),
  tipo       TEXT NOT NULL CHECK (tipo IN ('retiro', 'compra'))
) STRICT;

-- ---------------------------------------------------------------------
-- programa_punto: comercios autorizados de un bono (extra HU-21)
-- ---------------------------------------------------------------------
CREATE TABLE programa_punto (
  programa_id  TEXT NOT NULL REFERENCES programa (id) ON DELETE RESTRICT,
  punto_id     TEXT NOT NULL REFERENCES punto (id)    ON DELETE RESTRICT,
  PRIMARY KEY (programa_id, punto_id)
) STRICT;

-- ---------------------------------------------------------------------
-- beneficiario: la persona (datos ficticios en el piloto, D-01)
-- ---------------------------------------------------------------------
CREATE TABLE beneficiario (
  id                    TEXT PRIMARY KEY,

  -- identificación
  tipo_documento        TEXT NOT NULL CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PPT', 'PA')),
  numero_documento      TEXT NOT NULL
                        CHECK (length(numero_documento) BETWEEN 3 AND 20
                               AND numero_documento NOT GLOB '*[^A-Za-z0-9]*'),
  fecha_expedicion      TEXT NOT NULL CHECK (fecha_expedicion IS date(fecha_expedicion)),

  -- nombre
  primer_nombre         TEXT NOT NULL,
  segundo_nombre        TEXT,
  primer_apellido       TEXT NOT NULL,
  segundo_apellido      TEXT,

  -- datos demográficos (la edad no se guarda: ver vista beneficiario_con_edad)
  fecha_nacimiento      TEXT NOT NULL
                        CHECK (fecha_nacimiento IS date(fecha_nacimiento) AND fecha_nacimiento > '1900-01-01'),
  sexo                  TEXT NOT NULL DEFAULT 'NoInformado' CHECK (sexo IN ('F', 'M', 'NoInformado')),
  nacionalidad          TEXT NOT NULL DEFAULT 'CO'
                        CHECK (length(nacionalidad) = 2 AND nacionalidad GLOB '[A-Z][A-Z]'),

  -- contacto y ubicación
  celular               TEXT CHECK (
                          (length(celular) BETWEEN 7 AND 15 AND celular NOT GLOB '*[^0-9]*')
                       OR (substr(celular, 1, 1) = '+' AND length(celular) BETWEEN 8 AND 16
                           AND substr(celular, 2) NOT GLOB '*[^0-9]*')),
  correo                TEXT CHECK (correo GLOB '?*@?*.?*' AND correo NOT GLOB '*@*@*'
                                    AND correo NOT GLOB '*[ 	]*'),
  municipio_id          TEXT REFERENCES municipio (codigo_dane),
  direccion             TEXT,
  estrato               INTEGER CHECK (estrato BETWEEN 1 AND 6),

  -- afiliación (por confirmar con la entidad)
  categoria_afiliacion  TEXT CHECK (categoria_afiliacion IN ('A', 'B', 'C')),

  -- tratamiento de datos (Ley 1581 de 2012)
  autoriza_datos        INTEGER NOT NULL DEFAULT 0 CHECK (autoriza_datos IN (0, 1)),
  fecha_autorizacion    TEXT,
  version_politica      TEXT,

  -- control
  estado                TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Anonimizado')),
  creado_en             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_en        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CONSTRAINT documento_unico      UNIQUE (tipo_documento, numero_documento),
  CONSTRAINT expedicion_posterior CHECK (fecha_expedicion >= fecha_nacimiento),
  CONSTRAINT autorizacion_completa CHECK (
        (autoriza_datos = 1 AND fecha_autorizacion IS NOT NULL AND version_politica IS NOT NULL)
     OR (autoriza_datos = 0 AND fecha_autorizacion IS NULL     AND version_politica IS NULL))
) STRICT;

CREATE INDEX beneficiario_municipio_idx ON beneficiario (municipio_id);

-- SQLite no deja modificar NEW: un trigger AFTER marca la actualización
-- (los triggers recursivos están apagados por defecto, así que no se repite).
CREATE TRIGGER beneficiario_actualizado AFTER UPDATE ON beneficiario
WHEN NEW.actualizado_en IS OLD.actualizado_en
BEGIN
  UPDATE beneficiario SET actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- La edad cambia sola cada año: se calcula, no se guarda.
CREATE VIEW beneficiario_con_edad AS
SELECT b.*,
       CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', b.fecha_nacimiento) AS INTEGER)
         - (strftime('%m-%d', 'now') < strftime('%m-%d', b.fecha_nacimiento)) AS edad
FROM beneficiario b;

-- ---------------------------------------------------------------------
-- cuenta_beneficiario: billeteras enlazadas (con historial)
-- ---------------------------------------------------------------------
CREATE TABLE cuenta_beneficiario (
  id               TEXT PRIMARY KEY,
  beneficiario_id  TEXT NOT NULL REFERENCES beneficiario (id) ON DELETE RESTRICT,
  billetera        TEXT NOT NULL CHECK (billetera LIKE 'https://%'),
  estado           TEXT NOT NULL DEFAULT 'SinEnlazar'
                   CHECK (estado IN ('SinEnlazar', 'PorVerificar', 'Verificada')),
  nonce_cliente    TEXT,                     -- temporales: solo durante la verificación
  nonce_cierre     TEXT,
  verificada_en    TEXT,

  CONSTRAINT verificada_con_fecha CHECK ((estado = 'Verificada') = (verificada_en IS NOT NULL)),
  CONSTRAINT cuenta_de_beneficiario UNIQUE (id, beneficiario_id)   -- destino de la FK compuesta de cobro
) STRICT;

-- Una sola cuenta vigente por persona; las anteriores quedan como historial.
CREATE UNIQUE INDEX una_cuenta_vigente
  ON cuenta_beneficiario (beneficiario_id)
  WHERE estado IN ('PorVerificar', 'Verificada');

-- ---------------------------------------------------------------------
-- cobro: cada intento de cobro, por cualquier canal
-- ---------------------------------------------------------------------
CREATE TABLE cobro (
  id                  TEXT PRIMARY KEY,
  programa_id         TEXT NOT NULL REFERENCES programa (id)     ON DELETE RESTRICT,
  punto_id            TEXT          REFERENCES punto (id)        ON DELETE RESTRICT,
  cuenta_id           TEXT,
  beneficiario_id     TEXT NOT NULL REFERENCES beneficiario (id) ON DELETE RESTRICT,
  canal               TEXT NOT NULL CHECK (canal IN ('cuenta', 'retiro', 'compra')),
  total_compra        INTEGER CHECK (total_compra > 0),
  monto               INTEGER CHECK (monto > 0),                -- lo calcula el backend (RN-05)
  estado              TEXT NOT NULL DEFAULT 'Solicitado'
                      CHECK (estado IN ('Solicitado', 'PorConfirmar', 'Pagando', 'Pagado', 'Rechazado', 'Fallido')),
  motivo_rechazo      TEXT,
  intentos_pin        INTEGER NOT NULL DEFAULT 0 CHECK (intentos_pin >= 0),
  -- La arma la API desde la tabla secuencia: 'SUB-' || printf('%04d', valor)
  referencia          TEXT NOT NULL UNIQUE CHECK (referencia GLOB 'SUB-[0-9][0-9][0-9][0-9]*'),
  llave_idempotencia  TEXT NOT NULL UNIQUE,
  url_pago_entrante   TEXT,
  url_pago_saliente   TEXT,
  version             INTEGER NOT NULL DEFAULT 0,
  creado_en           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- La cuenta usada tiene que ser del mismo beneficiario del cobro.
  CONSTRAINT cuenta_del_beneficiario FOREIGN KEY (cuenta_id, beneficiario_id)
    REFERENCES cuenta_beneficiario (id, beneficiario_id) ON DELETE RESTRICT,

  CONSTRAINT canal_y_punto CHECK (
        (canal = 'cuenta' AND punto_id IS NULL)
     OR (canal IN ('retiro', 'compra') AND punto_id IS NOT NULL)),
  CONSTRAINT canal_y_cuenta CHECK ((canal = 'cuenta') = (cuenta_id IS NOT NULL)),
  CONSTRAINT compra_con_total CHECK ((canal = 'compra') = (total_compra IS NOT NULL)),
  CONSTRAINT bono_no_supera_compra CHECK (total_compra IS NULL OR monto IS NULL OR monto <= total_compra),
  CONSTRAINT monto_si_avanza CHECK (monto IS NOT NULL OR estado = 'Rechazado'),
  CONSTRAINT motivo_si_termina_mal CHECK (estado NOT IN ('Rechazado', 'Fallido') OR motivo_rechazo IS NOT NULL),
  CONSTRAINT pagado_con_pago_saliente CHECK (estado <> 'Pagado' OR url_pago_saliente IS NOT NULL)
) STRICT;

-- RN-02 / HU-14: un solo cobro vivo o pagado por persona y programa.
-- Lo arbitra la base, aunque lleguen dos solicitudes en el mismo instante.
-- OJO: Fallido libera a la persona; solo se marca Fallido con una respuesta
-- definitiva del banco, nunca por un timeout (db/README.md, P1).
CREATE UNIQUE INDEX un_cobro_vivo_por_persona
  ON cobro (programa_id, beneficiario_id)
  WHERE estado IN ('Solicitado', 'PorConfirmar', 'Pagando', 'Pagado');

CREATE INDEX cobro_programa_idx     ON cobro (programa_id, creado_en);
CREATE INDEX cobro_beneficiario_idx ON cobro (beneficiario_id);
CREATE INDEX cobro_punto_idx        ON cobro (punto_id) WHERE punto_id IS NOT NULL;
CREATE INDEX cobro_cuenta_idx       ON cobro (cuenta_id) WHERE cuenta_id IS NOT NULL;
CREATE INDEX cobro_pagando_idx      ON cobro (actualizado_en) WHERE estado = 'Pagando';  -- reconciliación

-- Máquina de estados del cobro: la base rechaza saltos imposibles.
--   Solicitado   -> PorConfirmar | Pagando | Rechazado
--   PorConfirmar -> Pagando | Rechazado
--   Pagando      -> Pagado | Fallido
--   Pagado, Rechazado, Fallido: finales
CREATE TRIGGER cobro_nacimiento BEFORE INSERT ON cobro
WHEN NEW.estado NOT IN ('Solicitado', 'PorConfirmar', 'Rechazado')
BEGIN
  SELECT RAISE(ABORT, 'Un cobro no puede nacer en ese estado');
END;

CREATE TRIGGER cobro_transicion BEFORE UPDATE OF estado ON cobro
WHEN NEW.estado IS NOT OLD.estado AND NOT (
     (OLD.estado = 'Solicitado'   AND NEW.estado IN ('PorConfirmar', 'Pagando', 'Rechazado'))
  OR (OLD.estado = 'PorConfirmar' AND NEW.estado IN ('Pagando', 'Rechazado'))
  OR (OLD.estado = 'Pagando'      AND NEW.estado IN ('Pagado', 'Fallido')))
BEGIN
  SELECT RAISE(ABORT, 'Transición de cobro no permitida');
END;

-- Bloqueo optimista: la app actualiza con WHERE id = ? AND version = ?
-- y SET version = version + 1. SQLite no deja asignar NEW.version en un
-- trigger, así que la base rechaza cualquier cambio que no la suba en 1.
CREATE TRIGGER cobro_version BEFORE UPDATE ON cobro
WHEN NEW.version IS NOT OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'Cada cambio de un cobro debe subir version en 1');
END;

-- Un cobro nunca se borra: cambia de estado. (SQLite no tiene TRUNCATE.)
CREATE TRIGGER cobro_sin_borrado BEFORE DELETE ON cobro
BEGIN
  SELECT RAISE(ABORT, 'La tabla cobro no admite DELETE');
END;

-- ---------------------------------------------------------------------
-- evento: línea de tiempo y auditoría (solo inserción)
-- Nunca guarda tokens, PIN, llaves ni datos personales.
-- ---------------------------------------------------------------------
CREATE TABLE evento (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_entidad     TEXT NOT NULL CHECK (tipo_entidad IN ('programa', 'cuenta', 'cobro', 'beneficiario')),
  id_entidad       TEXT NOT NULL,
  estado_anterior  TEXT,
  estado_nuevo     TEXT,
  detalle          TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detalle)),
  creado_en        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX evento_entidad_idx ON evento (tipo_entidad, id_entidad, id);

CREATE TRIGGER evento_sin_cambios BEFORE UPDATE ON evento
BEGIN
  SELECT RAISE(ABORT, 'evento es de solo inserción');
END;

CREATE TRIGGER evento_sin_borrado BEFORE DELETE ON evento
BEGIN
  SELECT RAISE(ABORT, 'evento es de solo inserción');
END;

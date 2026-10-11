-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "tipo_programa" AS ENUM('subsidio', 'bono');--> statement-breakpoint
CREATE TYPE "destino_programa" AS ENUM('libre', 'restringido');--> statement-breakpoint
CREATE TYPE "estado_programa" AS ENUM('Borrador', 'EsperandoAprobacion', 'Activo', 'Pausado', 'Cerrado');--> statement-breakpoint
CREATE TYPE "tipo_punto" AS ENUM('retiro', 'compra');--> statement-breakpoint
CREATE TYPE "estado_cuenta" AS ENUM('SinEnlazar', 'PorVerificar', 'Verificada');--> statement-breakpoint
CREATE TYPE "canal_cobro" AS ENUM('cuenta', 'retiro', 'compra');--> statement-breakpoint
CREATE TYPE "estado_cobro" AS ENUM('Solicitado', 'PorConfirmar', 'Pagando', 'Pagado', 'Rechazado', 'Fallido');--> statement-breakpoint
CREATE TYPE "tipo_doc" AS ENUM('CC', 'TI', 'CE', 'PPT', 'PA');--> statement-breakpoint
CREATE SEQUENCE "public"."cobro_referencia_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "beneficiario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tipo_documento" "tipo_doc" NOT NULL,
	"numero_documento" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_unico" UNIQUE("tipo_documento","numero_documento"),
	CONSTRAINT "beneficiario_numero_documento_check" CHECK ((numero_documento ~ '^[A-Za-z0-9]{3,20}$'::text))
);
--> statement-breakpoint
ALTER TABLE "beneficiario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bloqueo_pin" (
	"programa_id" uuid,
	"beneficiario_id" uuid,
	"bloqueado_hasta" timestamp with time zone NOT NULL,
	"cobro_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bloqueo_pin_pkey" PRIMARY KEY("programa_id","beneficiario_id")
);
--> statement-breakpoint
ALTER TABLE "bloqueo_pin" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cobro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"programa_id" uuid NOT NULL,
	"punto_id" uuid,
	"cuenta_id" uuid,
	"beneficiario_id" uuid NOT NULL,
	"canal" "canal_cobro" NOT NULL,
	"total_compra" bigint,
	"monto" bigint,
	"estado" "estado_cobro" DEFAULT 'Solicitado'::"estado_cobro" NOT NULL,
	"motivo_rechazo" text,
	"intentos_pin" smallint DEFAULT 0 NOT NULL,
	"referencia" text DEFAULT ('SUB-'::text || lpad((nextval('cobro_referencia_seq'::regclass))::text, 4, '0'::text)) NOT NULL CONSTRAINT "cobro_referencia_key" UNIQUE,
	"llave_idempotencia" text NOT NULL CONSTRAINT "cobro_llave_idempotencia_key" UNIQUE,
	"url_pago_entrante" text,
	"url_pago_saliente" text,
	"version" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bono_no_supera_compra" CHECK (((total_compra IS NULL) OR (monto IS NULL) OR (monto <= total_compra))),
	CONSTRAINT "canal_y_cuenta" CHECK ((((canal <> 'cuenta'::canal_cobro) AND (cuenta_id IS NULL)) OR ((canal = 'cuenta'::canal_cobro) AND ((cuenta_id IS NOT NULL) OR (estado = 'Rechazado'::estado_cobro))))),
	CONSTRAINT "canal_y_punto" CHECK ((((canal = 'cuenta'::canal_cobro) AND (punto_id IS NULL)) OR ((canal = ANY (ARRAY['retiro'::canal_cobro, 'compra'::canal_cobro])) AND (punto_id IS NOT NULL)))),
	CONSTRAINT "cobro_intentos_pin_check" CHECK ((intentos_pin >= 0)),
	CONSTRAINT "cobro_monto_check" CHECK ((monto > 0)),
	CONSTRAINT "cobro_total_compra_check" CHECK ((total_compra > 0)),
	CONSTRAINT "compra_con_total" CHECK ((((canal <> 'compra'::canal_cobro) AND (total_compra IS NULL)) OR ((canal = 'compra'::canal_cobro) AND ((total_compra IS NOT NULL) OR (estado = 'Rechazado'::estado_cobro))))),
	CONSTRAINT "monto_si_avanza" CHECK (((monto IS NOT NULL) OR (estado = 'Rechazado'::estado_cobro))),
	CONSTRAINT "motivo_si_termina_mal" CHECK (((estado <> ALL (ARRAY['Rechazado'::estado_cobro, 'Fallido'::estado_cobro])) OR (motivo_rechazo IS NOT NULL))),
	CONSTRAINT "pagado_con_pago_saliente" CHECK (((estado <> 'Pagado'::estado_cobro) OR (url_pago_saliente IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "cobro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cuenta_beneficiario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"beneficiario_id" uuid NOT NULL,
	"billetera" text NOT NULL,
	"estado" "estado_cuenta" DEFAULT 'SinEnlazar'::"estado_cuenta" NOT NULL,
	"nonce_cliente" text,
	"nonce_cierre" text,
	"verificada_en" timestamp with time zone,
	CONSTRAINT "cuenta_de_beneficiario" UNIQUE("id","beneficiario_id"),
	CONSTRAINT "cuenta_beneficiario_billetera_check" CHECK ((billetera ~~ 'https://%'::text)),
	CONSTRAINT "verificada_con_fecha" CHECK (((estado = 'Verificada'::estado_cuenta) = (verificada_en IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "cuenta_beneficiario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evento" (
	"id" bigserial PRIMARY KEY,
	"tipo_entidad" text NOT NULL,
	"id_entidad" text NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text,
	"detalle" jsonb DEFAULT '{}' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text DEFAULT 'sistema' NOT NULL,
	CONSTRAINT "actor_valido" CHECK ((actor ~ '^(sistema|entidad|beneficiario|punto|banco)(:[0-9a-f-]{36})?$'::text)),
	CONSTRAINT "evento_tipo_entidad_check" CHECK ((tipo_entidad = ANY (ARRAY['programa'::text, 'cuenta'::text, 'cobro'::text, 'beneficiario'::text])))
);
--> statement-breakpoint
ALTER TABLE "evento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "programa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entidad" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_programa" NOT NULL,
	"destino" "destino_programa" NOT NULL,
	"billetera_programa" text NOT NULL,
	"codigo_moneda" text NOT NULL,
	"escala_moneda" integer NOT NULL,
	"vigencia_inicio" timestamp with time zone NOT NULL,
	"vigencia_fin" timestamp with time zone NOT NULL,
	"tope_total" bigint,
	"estado" "estado_programa" DEFAULT 'Borrador'::"estado_programa" NOT NULL,
	"token_acceso" text,
	"url_gestion" text,
	"uri_continuacion" text,
	"token_continuacion" text,
	"nonce_cliente" text,
	"nonce_cierre" text,
	"url_permiso" text,
	"aprobacion_solicitada_en" timestamp with time zone,
	CONSTRAINT "activo_con_permiso" CHECK (((estado <> ALL (ARRAY['Activo'::estado_programa, 'Pausado'::estado_programa])) OR ((token_acceso IS NOT NULL) AND (url_gestion IS NOT NULL)))),
	CONSTRAINT "destino_segun_tipo" CHECK ((((tipo = 'subsidio'::tipo_programa) AND (destino = 'libre'::destino_programa)) OR ((tipo = 'bono'::tipo_programa) AND (destino = 'restringido'::destino_programa)))),
	CONSTRAINT "espera_con_fecha" CHECK (((estado <> 'EsperandoAprobacion'::estado_programa) OR (aprobacion_solicitada_en IS NOT NULL))),
	CONSTRAINT "programa_billetera_programa_check" CHECK ((billetera_programa ~~ 'https://%'::text)),
	CONSTRAINT "programa_codigo_moneda_check" CHECK ((codigo_moneda ~ '^[A-Z]{3}$'::text)),
	CONSTRAINT "programa_entidad_check" CHECK (((char_length(entidad) >= 3) AND (char_length(entidad) <= 80))),
	CONSTRAINT "programa_escala_moneda_check" CHECK (((escala_moneda >= 0) AND (escala_moneda <= 18))),
	CONSTRAINT "programa_nombre_check" CHECK (((char_length(nombre) >= 3) AND (char_length(nombre) <= 80))),
	CONSTRAINT "programa_tope_total_check" CHECK ((tope_total > 0)),
	CONSTRAINT "tope_antes_de_aprobar" CHECK (((estado = 'Borrador'::estado_programa) OR (tope_total IS NOT NULL))),
	CONSTRAINT "vigencia_valida" CHECK ((vigencia_fin > vigencia_inicio))
);
--> statement-breakpoint
ALTER TABLE "programa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "programa_punto" (
	"programa_id" uuid,
	"punto_id" uuid,
	CONSTRAINT "programa_punto_pkey" PRIMARY KEY("programa_id","punto_id")
);
--> statement-breakpoint
ALTER TABLE "programa_punto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "punto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"nombre" text NOT NULL,
	"direccion" text NOT NULL,
	"billetera" text NOT NULL CONSTRAINT "punto_billetera_key" UNIQUE,
	"tipo" "tipo_punto" NOT NULL,
	CONSTRAINT "punto_billetera_check" CHECK ((billetera ~~ 'https://%'::text))
);
--> statement-breakpoint
ALTER TABLE "punto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "cobro_beneficiario_idx" ON "cobro" ("beneficiario_id");--> statement-breakpoint
CREATE INDEX "cobro_cuenta_idx" ON "cobro" ("cuenta_id") WHERE (cuenta_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "cobro_pagando_idx" ON "cobro" ("actualizado_en") WHERE (estado = 'Pagando'::estado_cobro);--> statement-breakpoint
CREATE INDEX "cobro_programa_idx" ON "cobro" ("programa_id","creado_en");--> statement-breakpoint
CREATE INDEX "cobro_punto_idx" ON "cobro" ("punto_id") WHERE (punto_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "un_cobro_vivo_por_persona" ON "cobro" ("programa_id","beneficiario_id") WHERE (estado = ANY (ARRAY['Solicitado'::estado_cobro, 'PorConfirmar'::estado_cobro, 'Pagando'::estado_cobro, 'Pagado'::estado_cobro]));--> statement-breakpoint
CREATE INDEX "evento_entidad_idx" ON "evento" ("tipo_entidad","id_entidad","id");--> statement-breakpoint
CREATE UNIQUE INDEX "una_cuenta_vigente" ON "cuenta_beneficiario" ("beneficiario_id") WHERE (estado = ANY (ARRAY['PorVerificar'::estado_cuenta, 'Verificada'::estado_cuenta]));--> statement-breakpoint
ALTER TABLE "programa_punto" ADD CONSTRAINT "programa_punto_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programa"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "programa_punto" ADD CONSTRAINT "programa_punto_punto_id_fkey" FOREIGN KEY ("punto_id") REFERENCES "punto"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cuenta_beneficiario" ADD CONSTRAINT "cuenta_beneficiario_beneficiario_id_fkey" FOREIGN KEY ("beneficiario_id") REFERENCES "beneficiario"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_beneficiario_id_fkey" FOREIGN KEY ("beneficiario_id") REFERENCES "beneficiario"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programa"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_punto_id_fkey" FOREIGN KEY ("punto_id") REFERENCES "punto"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cuenta_del_beneficiario" FOREIGN KEY ("cuenta_id","beneficiario_id") REFERENCES "cuenta_beneficiario"("id","beneficiario_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bloqueo_pin" ADD CONSTRAINT "bloqueo_pin_beneficiario_id_fkey" FOREIGN KEY ("beneficiario_id") REFERENCES "beneficiario"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bloqueo_pin" ADD CONSTRAINT "bloqueo_pin_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "cobro"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bloqueo_pin" ADD CONSTRAINT "bloqueo_pin_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programa"("id") ON DELETE RESTRICT;
*/
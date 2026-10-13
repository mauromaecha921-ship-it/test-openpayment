// Generado con «pnpm --filter api db:pull» (scripts/esquema.ts) desde src/db/migraciones/.
// No se edita a mano: se cambia la migración y se vuelve a generar.
import { instante } from './tipos.js'
import { pgSchema, pgTable, uuid, bigserial, text, pgEnum, integer, boolean, jsonb, bigint, smallint, index, uniqueIndex, foreignKey, primaryKey, unique, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const piloto = pgSchema("piloto");
export const piloto_gobierno = pgSchema("piloto_gobierno");
export const tipo_programa = piloto.enum("tipo_programa", ["subsidio", "bono"])
export const destino_programa = piloto.enum("destino_programa", ["libre", "restringido"])
export const estado_programa = piloto.enum("estado_programa", ["Borrador", "EsperandoAprobacion", "Activo", "Pausado", "Cerrado"])
export const tipo_punto = piloto.enum("tipo_punto", ["retiro", "compra"])
export const estado_cuenta = piloto.enum("estado_cuenta", ["SinEnlazar", "PorVerificar", "Verificada"])
export const canal_cobro = piloto.enum("canal_cobro", ["cuenta", "retiro", "compra"])
export const estado_cobro = piloto.enum("estado_cobro", ["Solicitado", "PorConfirmar", "Pagando", "Pagado", "Rechazado", "Fallido"])
export const tipo_doc = piloto.enum("tipo_doc", ["CC", "TI", "CE", "PPT", "PA"])

export const cobro_referencia_seq = piloto.sequence("cobro_referencia_seq", { startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false, })

export const beneficiario = piloto.table.withRLS("beneficiario", {
	id: uuid().defaultRandom().primaryKey(),
	tipo_documento: tipo_doc().notNull(),
	numero_documento: text().notNull(),
	creado_en: instante().default(sql`now()`).notNull(),
}, (table) => [
	unique("documento_unico").on(table.tipo_documento, table.numero_documento),check("beneficiario_numero_documento_check", sql`(numero_documento ~ '^[A-Za-z0-9]{3,20}$'::text)`),]);

export const bloqueo_pin = piloto.table.withRLS("bloqueo_pin", {
	programa_id: uuid().notNull().references(() => programa.id, { onDelete: "restrict" } ),
	beneficiario_id: uuid().notNull().references(() => beneficiario.id, { onDelete: "restrict" } ),
	bloqueado_hasta: instante().notNull(),
	cobro_id: uuid().notNull().references(() => cobro.id, { onDelete: "restrict" } ),
	creado_en: instante().default(sql`now()`).notNull(),
}, (table) => [
	primaryKey({ columns: [table.programa_id, table.beneficiario_id], name: "bloqueo_pin_pkey"}),
]);

export const cobro = piloto.table.withRLS("cobro", {
	id: uuid().defaultRandom().primaryKey(),
	programa_id: uuid().notNull().references(() => programa.id, { onDelete: "restrict" } ),
	punto_id: uuid().references(() => punto.id, { onDelete: "restrict" } ),
	cuenta_id: uuid(),
	beneficiario_id: uuid().notNull().references(() => beneficiario.id, { onDelete: "restrict" } ),
	canal: canal_cobro().notNull(),
	total_compra: bigint({ mode: 'number' }),
	monto: bigint({ mode: 'number' }),
	estado: estado_cobro().default("Solicitado").notNull(),
	motivo_rechazo: text(),
	intentos_pin: smallint().default(0).notNull(),
	referencia: text().default(sql`('SUB-'::text || lpad((nextval('piloto.cobro_referencia_seq'::regclass))::text, 4, '0'::text))`).notNull(),
	llave_idempotencia: text().notNull(),
	url_pago_entrante: text(),
	url_pago_saliente: text(),
	version: integer().default(0).notNull(),
	creado_en: instante().default(sql`now()`).notNull(),
	actualizado_en: instante().default(sql`now()`).notNull(),
}, (table) => [
	foreignKey({
		columns: [table.cuenta_id, table.beneficiario_id],
		foreignColumns: [cuenta_beneficiario.id, cuenta_beneficiario.beneficiario_id],
		name: "cuenta_del_beneficiario"
	}).onDelete("restrict"),
	index("cobro_beneficiario_idx").using("btree", table.beneficiario_id.asc().nullsLast()),
	index("cobro_cuenta_idx").using("btree", table.cuenta_id.asc().nullsLast()).where(sql`(cuenta_id IS NOT NULL)`),
	index("cobro_pagando_idx").using("btree", table.actualizado_en.asc().nullsLast()).where(sql`(estado = 'Pagando'::piloto.estado_cobro)`),
	index("cobro_programa_idx").using("btree", table.programa_id.asc().nullsLast(), table.creado_en.asc().nullsLast()),
	index("cobro_punto_idx").using("btree", table.punto_id.asc().nullsLast()).where(sql`(punto_id IS NOT NULL)`),
	uniqueIndex("un_cobro_vivo_por_persona").using("btree", table.programa_id.asc().nullsLast(), table.beneficiario_id.asc().nullsLast()).where(sql`(estado = ANY (ARRAY['Solicitado'::piloto.estado_cobro, 'PorConfirmar'::piloto.estado_cobro, 'Pagando'::piloto.estado_cobro, 'Pagado'::piloto.estado_cobro]))`),
	unique("cobro_llave_idempotencia_key").on(table.llave_idempotencia),	unique("cobro_referencia_key").on(table.referencia),check("bono_no_supera_compra", sql`((total_compra IS NULL) OR (monto IS NULL) OR (monto <= total_compra))`),check("canal_y_cuenta", sql`(((canal <> 'cuenta'::piloto.canal_cobro) AND (cuenta_id IS NULL)) OR ((canal = 'cuenta'::piloto.canal_cobro) AND ((cuenta_id IS NOT NULL) OR (estado = 'Rechazado'::piloto.estado_cobro))))`),check("canal_y_punto", sql`(((canal = 'cuenta'::piloto.canal_cobro) AND (punto_id IS NULL)) OR ((canal = ANY (ARRAY['retiro'::piloto.canal_cobro, 'compra'::piloto.canal_cobro])) AND (punto_id IS NOT NULL)))`),check("cobro_intentos_pin_check", sql`(intentos_pin >= 0)`),check("cobro_monto_check", sql`(monto > 0)`),check("cobro_total_compra_check", sql`(total_compra > 0)`),check("compra_con_total", sql`(((canal <> 'compra'::piloto.canal_cobro) AND (total_compra IS NULL)) OR ((canal = 'compra'::piloto.canal_cobro) AND ((total_compra IS NOT NULL) OR (estado = 'Rechazado'::piloto.estado_cobro))))`),check("monto_si_avanza", sql`((monto IS NOT NULL) OR (estado = 'Rechazado'::piloto.estado_cobro))`),check("motivo_si_termina_mal", sql`((estado <> ALL (ARRAY['Rechazado'::piloto.estado_cobro, 'Fallido'::piloto.estado_cobro])) OR (motivo_rechazo IS NOT NULL))`),check("pagado_con_pago_saliente", sql`((estado <> 'Pagado'::piloto.estado_cobro) OR (url_pago_saliente IS NOT NULL))`),]);

export const comercio = piloto.table.withRLS("comercio", {
	id: uuid().defaultRandom().primaryKey(),
	nit: text().notNull(),
	razon_social: text().notNull(),
	ciiu: text().notNull(),
	categoria: text().notNull(),
	verificado_en: instante(),
	creado_en: instante().default(sql`now()`).notNull(),
}, (table) => [
	unique("comercio_nit_key").on(table.nit),check("comercio_ciiu_check", sql`(ciiu ~ '^[0-9]{4}$'::text)`),check("comercio_nit_check", sql`(nit ~ '^[0-9]{5,15}$'::text)`),check("comercio_razon_social_check", sql`((char_length(razon_social) >= 3) AND (char_length(razon_social) <= 120))`),]);

export const cuenta_beneficiario = piloto.table.withRLS("cuenta_beneficiario", {
	id: uuid().defaultRandom().primaryKey(),
	beneficiario_id: uuid().notNull().references(() => beneficiario.id, { onDelete: "restrict" } ),
	billetera: text().notNull(),
	estado: estado_cuenta().default("SinEnlazar").notNull(),
	nonce_cliente: text(),
	nonce_cierre: text(),
	verificada_en: instante(),
	uri_continuacion: text(),
	token_continuacion: text(),
	creado_en: instante().default(sql`now()`).notNull(),
}, (table) => [
	uniqueIndex("una_cuenta_vigente").using("btree", table.beneficiario_id.asc().nullsLast()).where(sql`(estado = ANY (ARRAY['PorVerificar'::piloto.estado_cuenta, 'Verificada'::piloto.estado_cuenta]))`),
	unique("cuenta_de_beneficiario").on(table.id, table.beneficiario_id),check("cuenta_beneficiario_billetera_check", sql`(billetera ~~ 'https://%'::text)`),check("verificada_con_fecha", sql`((estado = 'Verificada'::piloto.estado_cuenta) = (verificada_en IS NOT NULL))`),]);

export const evento = piloto.table.withRLS("evento", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	tipo_entidad: text().notNull(),
	id_entidad: text().notNull(),
	estado_anterior: text(),
	estado_nuevo: text(),
	detalle: jsonb().default({}).notNull(),
	creado_en: instante().default(sql`now()`).notNull(),
	actor: text().default("sistema").notNull(),
}, (table) => [
	index("evento_entidad_idx").using("btree", table.tipo_entidad.asc().nullsLast(), table.id_entidad.asc().nullsLast(), table.id.asc().nullsLast()),
check("actor_valido", sql`(actor ~ '^(sistema|entidad|beneficiario|punto|banco)(:[0-9a-f-]{36})?$'::text)`),check("evento_tipo_entidad_check", sql`(tipo_entidad = ANY (ARRAY['programa'::text, 'cuenta'::text, 'cobro'::text, 'beneficiario'::text]))`),]);

export const programa = piloto.table.withRLS("programa", {
	id: uuid().defaultRandom().primaryKey(),
	entidad: text().notNull(),
	nombre: text().notNull(),
	tipo: tipo_programa().notNull(),
	destino: destino_programa().notNull(),
	billetera_programa: text().notNull(),
	codigo_moneda: text().notNull(),
	escala_moneda: integer().notNull(),
	vigencia_inicio: instante().notNull(),
	vigencia_fin: instante().notNull(),
	tope_total: bigint({ mode: 'number' }),
	estado: estado_programa().default("Borrador").notNull(),
	token_acceso: text(),
	url_gestion: text(),
	uri_continuacion: text(),
	token_continuacion: text(),
	nonce_cliente: text(),
	nonce_cierre: text(),
	url_permiso: text(),
	aprobacion_solicitada_en: instante(),
	monto_por_persona: bigint({ mode: 'number' }),
	permiso_vencido_en: instante(),
	gastado_permisos_anteriores: bigint({ mode: 'number' }).default(0).notNull(),
	creado_en: instante().default(sql`now()`).notNull(),
}, () => [
check("activo_con_permiso", sql`((estado <> ALL (ARRAY['Activo'::piloto.estado_programa, 'Pausado'::piloto.estado_programa])) OR ((token_acceso IS NOT NULL) AND (url_gestion IS NOT NULL)))`),check("destino_segun_tipo", sql`(((tipo = 'subsidio'::piloto.tipo_programa) AND (destino = 'libre'::piloto.destino_programa)) OR ((tipo = 'bono'::piloto.tipo_programa) AND (destino = 'restringido'::piloto.destino_programa)))`),check("espera_con_fecha", sql`((estado <> 'EsperandoAprobacion'::piloto.estado_programa) OR (aprobacion_solicitada_en IS NOT NULL))`),check("programa_billetera_programa_check", sql`(billetera_programa ~~ 'https://%'::text)`),check("programa_codigo_moneda_check", sql`(codigo_moneda ~ '^[A-Z]{3}$'::text)`),check("programa_entidad_check", sql`((char_length(entidad) >= 3) AND (char_length(entidad) <= 80))`),check("programa_escala_moneda_check", sql`((escala_moneda >= 0) AND (escala_moneda <= 18))`),check("programa_gastado_permisos_anteriores_check", sql`(gastado_permisos_anteriores >= 0)`),check("programa_monto_por_persona_check", sql`(monto_por_persona > 0)`),check("programa_nombre_check", sql`((char_length(nombre) >= 3) AND (char_length(nombre) <= 80))`),check("programa_tope_total_check", sql`(tope_total > 0)`),check("tope_antes_de_aprobar", sql`((estado = 'Borrador'::piloto.estado_programa) OR (tope_total IS NOT NULL))`),check("vigencia_valida", sql`(vigencia_fin > vigencia_inicio)`),]);

export const programa_categoria = piloto.table.withRLS("programa_categoria", {
	programa_id: uuid().notNull().references(() => programa.id, { onDelete: "restrict" } ),
	categoria: text().notNull(),
}, (table) => [
	primaryKey({ columns: [table.programa_id, table.categoria], name: "programa_categoria_pkey"}),
]);

export const programa_punto = piloto.table.withRLS("programa_punto", {
	programa_id: uuid().notNull().references(() => programa.id, { onDelete: "restrict" } ),
	punto_id: uuid().notNull().references(() => punto.id, { onDelete: "restrict" } ),
}, (table) => [
	primaryKey({ columns: [table.programa_id, table.punto_id], name: "programa_punto_pkey"}),
]);

export const punto = piloto.table.withRLS("punto", {
	id: uuid().defaultRandom().primaryKey(),
	nombre: text().notNull(),
	direccion: text().notNull(),
	billetera: text().notNull(),
	tipo: tipo_punto().notNull(),
	comercio_id: uuid().references(() => comercio.id, { onDelete: "restrict" } ),
}, (table) => [
	unique("punto_billetera_key").on(table.billetera),check("punto_billetera_check", sql`(billetera ~~ 'https://%'::text)`),check("sede_es_de_compra", sql`((comercio_id IS NULL) OR (tipo = 'compra'::piloto.tipo_punto))`),]);

export const persona = piloto_gobierno.table.withRLS("persona", {
	documento: text().primaryKey(),
	nombre: text().notNull(),
	veces: integer().default(1).notNull(),
	pin_hash: text(),
	novedad: boolean().default(false).notNull(),
	creado_en: instante().default(sql`now()`).notNull(),
}, () => [
check("persona_documento_check", sql`(documento ~ '^[A-Za-z0-9]{3,20}$'::text)`),check("persona_nombre_check", sql`((char_length(nombre) >= 1) AND (char_length(nombre) <= 120))`),check("persona_veces_check", sql`(veces >= 1)`),]);

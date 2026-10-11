import { pgEnum, pgTable, bigserial, uuid, text, timestamp, jsonb, bigint, integer, smallint, index, uniqueIndex, foreignKey, primaryKey, unique, check, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const tipoPrograma = pgEnum("tipo_programa", ["subsidio", "bono"])
export const destinoPrograma = pgEnum("destino_programa", ["libre", "restringido"])
export const estadoPrograma = pgEnum("estado_programa", ["Borrador", "EsperandoAprobacion", "Activo", "Pausado", "Cerrado"])
export const tipoPunto = pgEnum("tipo_punto", ["retiro", "compra"])
export const estadoCuenta = pgEnum("estado_cuenta", ["SinEnlazar", "PorVerificar", "Verificada"])
export const canalCobro = pgEnum("canal_cobro", ["cuenta", "retiro", "compra"])
export const estadoCobro = pgEnum("estado_cobro", ["Solicitado", "PorConfirmar", "Pagando", "Pagado", "Rechazado", "Fallido"])
export const tipoDoc = pgEnum("tipo_doc", ["CC", "TI", "CE", "PPT", "PA"])

export const cobroReferenciaSeq = pgSequence("cobro_referencia_seq", { startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false, })

export const beneficiario = pgTable.withRLS("beneficiario", {
	id: uuid().defaultRandom().primaryKey(),
	tipoDocumento: tipoDoc("tipo_documento").notNull(),
	numeroDocumento: text("numero_documento").notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true }).default(sql`now()`).notNull(),
}, (table) => [
	unique("documento_unico").on(table.tipoDocumento, table.numeroDocumento),check("beneficiario_numero_documento_check", sql`(numero_documento ~ '^[A-Za-z0-9]{3,20}$'::text)`),]);

export const bloqueoPin = pgTable.withRLS("bloqueo_pin", {
	programaId: uuid("programa_id").notNull().references(() => programa.id, { name: "bloqueo_pin_programa_id_fkey", onDelete: "restrict" } ),
	beneficiarioId: uuid("beneficiario_id").notNull().references(() => beneficiario.id, { name: "bloqueo_pin_beneficiario_id_fkey", onDelete: "restrict" } ),
	bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }).notNull(),
	cobroId: uuid("cobro_id").notNull().references(() => cobro.id, { name: "bloqueo_pin_cobro_id_fkey", onDelete: "restrict" } ),
	creadoEn: timestamp("creado_en", { withTimezone: true }).default(sql`now()`).notNull(),
}, (table) => [
	primaryKey({ columns: [table.programaId, table.beneficiarioId], name: "bloqueo_pin_pkey"}),
]);

export const cobro = pgTable.withRLS("cobro", {
	id: uuid().defaultRandom().primaryKey(),
	programaId: uuid("programa_id").notNull().references(() => programa.id, { name: "cobro_programa_id_fkey", onDelete: "restrict" } ),
	puntoId: uuid("punto_id").references(() => punto.id, { name: "cobro_punto_id_fkey", onDelete: "restrict" } ),
	cuentaId: uuid("cuenta_id"),
	beneficiarioId: uuid("beneficiario_id").notNull().references(() => beneficiario.id, { name: "cobro_beneficiario_id_fkey", onDelete: "restrict" } ),
	canal: canalCobro().notNull(),
	totalCompra: bigint("total_compra", { mode: 'number' }),
	monto: bigint({ mode: 'number' }),
	estado: estadoCobro().default("Solicitado").notNull(),
	motivoRechazo: text("motivo_rechazo"),
	intentosPin: smallint("intentos_pin").default(0).notNull(),
	referencia: text().default(sql`('SUB-'::text || lpad((nextval('cobro_referencia_seq'::regclass))::text, 4, '0'::text))`).notNull(),
	llaveIdempotencia: text("llave_idempotencia").notNull(),
	urlPagoEntrante: text("url_pago_entrante"),
	urlPagoSaliente: text("url_pago_saliente"),
	version: integer().default(0).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true }).default(sql`now()`).notNull(),
	actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).default(sql`now()`).notNull(),
}, (table) => [
	foreignKey({
		columns: [table.cuentaId, table.beneficiarioId],
		foreignColumns: [cuentaBeneficiario.id, cuentaBeneficiario.beneficiarioId],
		name: "cuenta_del_beneficiario"
	}).onDelete("restrict"),
	index("cobro_beneficiario_idx").using("btree", table.beneficiarioId.asc().nullsLast()),
	index("cobro_cuenta_idx").using("btree", table.cuentaId.asc().nullsLast()).where(sql`(cuenta_id IS NOT NULL)`),
	index("cobro_pagando_idx").using("btree", table.actualizadoEn.asc().nullsLast()).where(sql`(estado = 'Pagando'::estado_cobro)`),
	index("cobro_programa_idx").using("btree", table.programaId.asc().nullsLast(), table.creadoEn.asc().nullsLast()),
	index("cobro_punto_idx").using("btree", table.puntoId.asc().nullsLast()).where(sql`(punto_id IS NOT NULL)`),
	uniqueIndex("un_cobro_vivo_por_persona").using("btree", table.programaId.asc().nullsLast(), table.beneficiarioId.asc().nullsLast()).where(sql`(estado = ANY (ARRAY['Solicitado'::estado_cobro, 'PorConfirmar'::estado_cobro, 'Pagando'::estado_cobro, 'Pagado'::estado_cobro]))`),
	unique("cobro_llave_idempotencia_key").on(table.llaveIdempotencia),	unique("cobro_referencia_key").on(table.referencia),check("bono_no_supera_compra", sql`((total_compra IS NULL) OR (monto IS NULL) OR (monto <= total_compra))`),check("canal_y_cuenta", sql`(((canal <> 'cuenta'::canal_cobro) AND (cuenta_id IS NULL)) OR ((canal = 'cuenta'::canal_cobro) AND ((cuenta_id IS NOT NULL) OR (estado = 'Rechazado'::estado_cobro))))`),check("canal_y_punto", sql`(((canal = 'cuenta'::canal_cobro) AND (punto_id IS NULL)) OR ((canal = ANY (ARRAY['retiro'::canal_cobro, 'compra'::canal_cobro])) AND (punto_id IS NOT NULL)))`),check("cobro_intentos_pin_check", sql`(intentos_pin >= 0)`),check("cobro_monto_check", sql`(monto > 0)`),check("cobro_total_compra_check", sql`(total_compra > 0)`),check("compra_con_total", sql`(((canal <> 'compra'::canal_cobro) AND (total_compra IS NULL)) OR ((canal = 'compra'::canal_cobro) AND ((total_compra IS NOT NULL) OR (estado = 'Rechazado'::estado_cobro))))`),check("monto_si_avanza", sql`((monto IS NOT NULL) OR (estado = 'Rechazado'::estado_cobro))`),check("motivo_si_termina_mal", sql`((estado <> ALL (ARRAY['Rechazado'::estado_cobro, 'Fallido'::estado_cobro])) OR (motivo_rechazo IS NOT NULL))`),check("pagado_con_pago_saliente", sql`((estado <> 'Pagado'::estado_cobro) OR (url_pago_saliente IS NOT NULL))`),]);

export const cuentaBeneficiario = pgTable.withRLS("cuenta_beneficiario", {
	id: uuid().defaultRandom().primaryKey(),
	beneficiarioId: uuid("beneficiario_id").notNull().references(() => beneficiario.id, { name: "cuenta_beneficiario_beneficiario_id_fkey", onDelete: "restrict" } ),
	billetera: text().notNull(),
	estado: estadoCuenta().default("SinEnlazar").notNull(),
	nonceCliente: text("nonce_cliente"),
	nonceCierre: text("nonce_cierre"),
	verificadaEn: timestamp("verificada_en", { withTimezone: true }),
}, (table) => [
	uniqueIndex("una_cuenta_vigente").using("btree", table.beneficiarioId.asc().nullsLast()).where(sql`(estado = ANY (ARRAY['PorVerificar'::estado_cuenta, 'Verificada'::estado_cuenta]))`),
	unique("cuenta_de_beneficiario").on(table.id, table.beneficiarioId),check("cuenta_beneficiario_billetera_check", sql`(billetera ~~ 'https://%'::text)`),check("verificada_con_fecha", sql`((estado = 'Verificada'::estado_cuenta) = (verificada_en IS NOT NULL))`),]);

export const evento = pgTable.withRLS("evento", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	tipoEntidad: text("tipo_entidad").notNull(),
	idEntidad: text("id_entidad").notNull(),
	estadoAnterior: text("estado_anterior"),
	estadoNuevo: text("estado_nuevo"),
	detalle: jsonb().default({}).notNull(),
	creadoEn: timestamp("creado_en", { withTimezone: true }).default(sql`now()`).notNull(),
	actor: text().default("sistema").notNull(),
}, (table) => [
	index("evento_entidad_idx").using("btree", table.tipoEntidad.asc().nullsLast(), table.idEntidad.asc().nullsLast(), table.id.asc().nullsLast()),
check("actor_valido", sql`(actor ~ '^(sistema|entidad|beneficiario|punto|banco)(:[0-9a-f-]{36})?$'::text)`),check("evento_tipo_entidad_check", sql`(tipo_entidad = ANY (ARRAY['programa'::text, 'cuenta'::text, 'cobro'::text, 'beneficiario'::text]))`),]);

export const programa = pgTable.withRLS("programa", {
	id: uuid().defaultRandom().primaryKey(),
	entidad: text().notNull(),
	nombre: text().notNull(),
	tipo: tipoPrograma().notNull(),
	destino: destinoPrograma().notNull(),
	billeteraPrograma: text("billetera_programa").notNull(),
	codigoMoneda: text("codigo_moneda").notNull(),
	escalaMoneda: integer("escala_moneda").notNull(),
	vigenciaInicio: timestamp("vigencia_inicio", { withTimezone: true }).notNull(),
	vigenciaFin: timestamp("vigencia_fin", { withTimezone: true }).notNull(),
	topeTotal: bigint("tope_total", { mode: 'number' }),
	estado: estadoPrograma().default("Borrador").notNull(),
	tokenAcceso: text("token_acceso"),
	urlGestion: text("url_gestion"),
	uriContinuacion: text("uri_continuacion"),
	tokenContinuacion: text("token_continuacion"),
	nonceCliente: text("nonce_cliente"),
	nonceCierre: text("nonce_cierre"),
	urlPermiso: text("url_permiso"),
	aprobacionSolicitadaEn: timestamp("aprobacion_solicitada_en", { withTimezone: true }),
}, () => [
check("activo_con_permiso", sql`((estado <> ALL (ARRAY['Activo'::estado_programa, 'Pausado'::estado_programa])) OR ((token_acceso IS NOT NULL) AND (url_gestion IS NOT NULL)))`),check("destino_segun_tipo", sql`(((tipo = 'subsidio'::tipo_programa) AND (destino = 'libre'::destino_programa)) OR ((tipo = 'bono'::tipo_programa) AND (destino = 'restringido'::destino_programa)))`),check("espera_con_fecha", sql`((estado <> 'EsperandoAprobacion'::estado_programa) OR (aprobacion_solicitada_en IS NOT NULL))`),check("programa_billetera_programa_check", sql`(billetera_programa ~~ 'https://%'::text)`),check("programa_codigo_moneda_check", sql`(codigo_moneda ~ '^[A-Z]{3}$'::text)`),check("programa_entidad_check", sql`((char_length(entidad) >= 3) AND (char_length(entidad) <= 80))`),check("programa_escala_moneda_check", sql`((escala_moneda >= 0) AND (escala_moneda <= 18))`),check("programa_nombre_check", sql`((char_length(nombre) >= 3) AND (char_length(nombre) <= 80))`),check("programa_tope_total_check", sql`(tope_total > 0)`),check("tope_antes_de_aprobar", sql`((estado = 'Borrador'::estado_programa) OR (tope_total IS NOT NULL))`),check("vigencia_valida", sql`(vigencia_fin > vigencia_inicio)`),]);

export const programaPunto = pgTable.withRLS("programa_punto", {
	programaId: uuid("programa_id").notNull().references(() => programa.id, { name: "programa_punto_programa_id_fkey", onDelete: "restrict" } ),
	puntoId: uuid("punto_id").notNull().references(() => punto.id, { name: "programa_punto_punto_id_fkey", onDelete: "restrict" } ),
}, (table) => [
	primaryKey({ columns: [table.programaId, table.puntoId], name: "programa_punto_pkey"}),
]);

export const punto = pgTable.withRLS("punto", {
	id: uuid().defaultRandom().primaryKey(),
	nombre: text().notNull(),
	direccion: text().notNull(),
	billetera: text().notNull(),
	tipo: tipoPunto().notNull(),
}, (table) => [
	unique("punto_billetera_key").on(table.billetera),check("punto_billetera_check", sql`(billetera ~~ 'https://%'::text)`),]);

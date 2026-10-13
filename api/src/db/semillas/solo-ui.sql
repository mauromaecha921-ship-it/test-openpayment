-- =====================================================================
-- Tatú · Semilla «solo UI» (Plan backend § 4.4)
-- El escenario de db/002_datos_prueba.sql, para construir pantallas sin
-- Open Payments. El token es FALSO: nunca paga.
-- Cambios frente a 002: nombres de la demo (D-10), moneda COP (AD-18) y
-- wallets de ejemplo que no existen (D-33: las de 002 son de otras
-- personas). Los retiros nacen en PorConfirmar, como en 002, pero sus
-- eventos empiezan en Solicitado, como los escribe la API (wireframe 05).
-- El primer evento de Rosa lleva "novedad": así lo anota la API.
-- Los nombres, el PIN y el monto van al gobierno simulado (semillas/base.ts).
-- =====================================================================

BEGIN;

INSERT INTO programa (id, entidad, nombre, tipo, destino, billetera_programa,
                      codigo_moneda, escala_moneda, vigencia_inicio, vigencia_fin,
                      tope_total, estado, token_acceso, url_gestion)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Entidad de prueba', 'Subsidio adulto mayor (simulado)',
        'subsidio', 'libre', 'https://ilp.interledger-test.dev/tatu-ejemplo-programa',
        'COP', 2, '2026-10-01T05:00:00.000Z', '2027-01-01T04:59:59.999Z',
        69000000, 'Activo', 'token-falso-solo-demo',
        'https://auth.interledger-test.dev/token/falso');

INSERT INTO punto (id, nombre, direccion, billetera, tipo) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Tienda Marta — corresponsal', 'Calle 1 # 2-3',
   'https://ilp.interledger-test.dev/tatu-ejemplo-punto', 'retiro');

-- Solo la cédula: el nombre lo tiene el gobierno (db/001, «somos pasarela»)
INSERT INTO beneficiario (id, tipo_documento, numero_documento) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'CC', '900000001'),
  ('c0000000-0000-0000-0000-000000000002', 'CC', '900000002'),
  ('c0000000-0000-0000-0000-000000000003', 'CC', '900000003'),
  ('c0000000-0000-0000-0000-000000000004', 'CC', '900000004');

INSERT INTO cuenta_beneficiario (id, beneficiario_id, billetera, estado, verificada_en) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'https://ilp.interledger-test.dev/tatu-ejemplo-ana', 'Verificada', '2026-10-02T00:00:00.000Z'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
   'https://ilp.interledger-test.dev/tatu-ejemplo-luis', 'Verificada', '2026-10-02T00:00:00.000Z');

-- Ana cobra a su cuenta (Solicitado -> Pagando -> Pagado). El trigger de db/001 sube version.
INSERT INTO cobro (id, programa_id, cuenta_id, beneficiario_id, canal, monto, referencia, llave_idempotencia)
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'cuenta', 23000000, 'SUB-0001', 'demo-ana-1');
UPDATE cobro SET estado = 'Pagando',
       url_pago_entrante = 'https://ilp.interledger-test.dev/tatu-ejemplo-ana/incoming-payments/demo',
       url_pago_saliente = 'https://ilp.interledger-test.dev/tatu-ejemplo-programa/outgoing-payments/demo-1'
 WHERE id = 'e0000000-0000-0000-0000-000000000001';
UPDATE cobro SET estado = 'Pagado' WHERE id = 'e0000000-0000-0000-0000-000000000001';

-- Jorge cobra en el punto (PorConfirmar -> Pagando -> Pagado)
INSERT INTO cobro (id, programa_id, punto_id, beneficiario_id, canal, monto, estado, referencia, llave_idempotencia)
VALUES ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
        'retiro', 23000000, 'PorConfirmar', 'SUB-0002', 'demo-jorge-1');
UPDATE cobro SET estado = 'Pagando',
       url_pago_entrante = 'https://ilp.interledger-test.dev/tatu-ejemplo-punto/incoming-payments/demo',
       url_pago_saliente = 'https://ilp.interledger-test.dev/tatu-ejemplo-programa/outgoing-payments/demo-2'
 WHERE id = 'e0000000-0000-0000-0000-000000000002';
UPDATE cobro SET estado = 'Pagado' WHERE id = 'e0000000-0000-0000-0000-000000000002';

-- Rosa: retroactivo de $460.000 que supera el tope -> el banco lo rechaza
INSERT INTO cobro (id, programa_id, punto_id, beneficiario_id, canal, monto, estado, referencia, llave_idempotencia)
VALUES ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
        'retiro', 46000000, 'PorConfirmar', 'SUB-0003', 'demo-rosa-1');
UPDATE cobro SET estado = 'Pagando' WHERE id = 'e0000000-0000-0000-0000-000000000003';
UPDATE cobro SET estado = 'Fallido', motivo_rechazo = 'TopeSuperado'
 WHERE id = 'e0000000-0000-0000-0000-000000000003';

-- Las referencias se escribieron a mano: la secuencia sigue desde la 3
SELECT setval('cobro_referencia_seq', 3);

INSERT INTO evento (tipo_entidad, id_entidad, estado_anterior, estado_nuevo, detalle, actor) VALUES
  ('programa', 'a0000000-0000-0000-0000-000000000001', 'EsperandoAprobacion', 'Activo', '{"texto":"Semilla solo UI: permiso falso."}', 'banco'),
  ('cobro', 'e0000000-0000-0000-0000-000000000001', NULL, 'Solicitado', '{"texto":"Solicitaste el cobro a tu cuenta."}', 'beneficiario:c0000000-0000-0000-0000-000000000001'),
  ('cobro', 'e0000000-0000-0000-0000-000000000001', 'Solicitado', 'Pagando', '{"texto":"Enviando el pago a tu cuenta."}', 'beneficiario:c0000000-0000-0000-0000-000000000001'),
  ('cobro', 'e0000000-0000-0000-0000-000000000001', 'Pagando', 'Pagado', '{"texto":"El pago llegó a la cuenta."}', 'banco'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', NULL, 'Solicitado', '{"texto":"Tienda Marta — corresponsal digitó la cédula."}', 'punto:b0000000-0000-0000-0000-000000000001'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', 'Solicitado', 'PorConfirmar', '{"texto":"Esperando el PIN de la persona."}', 'punto:b0000000-0000-0000-0000-000000000001'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', 'PorConfirmar', 'Pagando', '{"texto":"PIN correcto. Enviando el pago al punto."}', 'beneficiario:c0000000-0000-0000-0000-000000000003'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', 'Pagando', 'Pagado', '{"texto":"Pago recibido. Ya se puede entregar el efectivo."}', 'banco'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', NULL, 'Solicitado', '{"texto":"Tienda Marta — corresponsal digitó la cédula.","novedad":true}', 'punto:b0000000-0000-0000-0000-000000000001'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', 'Solicitado', 'PorConfirmar', '{"texto":"Esperando el PIN de la persona."}', 'punto:b0000000-0000-0000-0000-000000000001'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', 'PorConfirmar', 'Pagando', '{"texto":"PIN correcto. Enviando el pago al punto."}', 'beneficiario:c0000000-0000-0000-0000-000000000004'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', 'Pagando', 'Fallido', '{"texto":"El banco rechazó el pago: el programa llegó a su tope","motivo":"TopeSuperado"}', 'banco');

COMMIT;

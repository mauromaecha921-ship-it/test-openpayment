-- =====================================================================
-- Tatú · Semilla «solo UI» (Plan backend § 4.4)
-- El escenario de db/002_datos_prueba.sql, traducido a SQLite, para
-- construir pantallas sin Open Payments. El token es FALSO: nunca paga.
-- Cambios frente a 002: nombres de la demo (D-10) y moneda COP (AD-18).
-- Los retiros se insertan en PorConfirmar, como en 002, pero sus eventos
-- empiezan en Solicitado, como los escribe la API (wireframe 05). El
-- primer evento de Rosa lleva "novedad": así lo anota la API al solicitar.
-- =====================================================================

BEGIN;

INSERT INTO municipio (codigo_dane, nombre, departamento) VALUES
  ('11001', 'Bogotá, D.C.', 'Bogotá, D.C.'),
  ('05001', 'Medellín',     'Antioquia'),
  ('76001', 'Cali',         'Valle del Cauca');

INSERT INTO programa (id, entidad, nombre, tipo, destino, billetera_programa,
                      codigo_moneda, escala_moneda, vigencia_inicio, vigencia_fin,
                      tope_total, estado, token_acceso, url_gestion)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Entidad de prueba', 'Subsidio adulto mayor (simulado)',
        'subsidio', 'libre', 'https://ilp.interledger-test.dev/programa-subsidio',
        'COP', 2, '2026-10-01T00:00:00.000Z', '2026-12-31T23:59:59.000Z',
        69000000, 'Activo', 'token-falso-solo-demo',
        'https://auth.interledger-test.dev/token/falso');

INSERT INTO punto (id, nombre, direccion, billetera, tipo) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Tienda Marta — corresponsal', 'Calle 1 # 2-3',
   'https://ilp.interledger-test.dev/punto-1', 'retiro');

INSERT INTO beneficiario (id, tipo_documento, numero_documento, fecha_expedicion,
                          primer_nombre, primer_apellido, segundo_apellido,
                          fecha_nacimiento, sexo, celular, municipio_id, estrato,
                          categoria_afiliacion, autoriza_datos, fecha_autorizacion, version_politica)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'CC', '900000001', '1977-07-01',
   'Ana', 'Prueba', 'Uno', '1959-06-02', 'F', '3000000001', '11001', 2,
   'A', 1, '2026-10-01T00:00:00.000Z', 'v1'),
  ('c0000000-0000-0000-0000-000000000002', 'CC', '900000002', '1990-01-15',
   'Luis', 'Prueba', 'Dos', '1972-01-10', 'M', '3000000002', '05001', 1,
   'A', 1, '2026-10-01T00:00:00.000Z', 'v1'),
  ('c0000000-0000-0000-0000-000000000003', 'CC', '900000003', '1972-03-20',
   'Jorge', 'Prueba', 'Tres', '1954-03-01', 'M', NULL, '11001', 1,
   'A', 1, '2026-10-01T00:00:00.000Z', 'v1'),
  ('c0000000-0000-0000-0000-000000000004', 'CC', '900000004', '1985-09-09',
   'Rosa', 'Prueba', 'Cuatro', '1967-09-01', 'F', '3000000004', '76001', 2,
   'A', 1, '2026-10-01T00:00:00.000Z', 'v1');

INSERT INTO cuenta_beneficiario (id, beneficiario_id, billetera, estado, verificada_en) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'https://ilp.interledger-test.dev/ana', 'Verificada', '2026-10-02T00:00:00.000Z'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
   'https://ilp.interledger-test.dev/luis', 'Verificada', '2026-10-02T00:00:00.000Z');

UPDATE secuencia SET valor = 3 WHERE nombre = 'cobro_referencia';

-- Ana cobra a su cuenta (Solicitado -> Pagando -> Pagado)
INSERT INTO cobro (id, programa_id, cuenta_id, beneficiario_id, canal, monto, referencia, llave_idempotencia)
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        'cuenta', 23000000, 'SUB-0001', 'demo-ana-1');
UPDATE cobro SET estado = 'Pagando', version = version + 1,
       url_pago_entrante = 'https://ilp.interledger-test.dev/ana/incoming-payments/demo',
       url_pago_saliente = 'https://ilp.interledger-test.dev/programa-subsidio/outgoing-payments/demo-1'
 WHERE id = 'e0000000-0000-0000-0000-000000000001';
UPDATE cobro SET estado = 'Pagado', version = version + 1
 WHERE id = 'e0000000-0000-0000-0000-000000000001';

-- Jorge cobra en el punto (PorConfirmar -> Pagando -> Pagado)
INSERT INTO cobro (id, programa_id, punto_id, beneficiario_id, canal, monto, estado, referencia, llave_idempotencia)
VALUES ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
        'retiro', 23000000, 'PorConfirmar', 'SUB-0002', 'demo-jorge-1');
UPDATE cobro SET estado = 'Pagando', version = version + 1,
       url_pago_entrante = 'https://ilp.interledger-test.dev/punto-1/incoming-payments/demo',
       url_pago_saliente = 'https://ilp.interledger-test.dev/programa-subsidio/outgoing-payments/demo-2'
 WHERE id = 'e0000000-0000-0000-0000-000000000002';
UPDATE cobro SET estado = 'Pagado', version = version + 1
 WHERE id = 'e0000000-0000-0000-0000-000000000002';

-- Rosa: retroactivo de $460.000 que supera el tope -> el banco lo rechaza
INSERT INTO cobro (id, programa_id, punto_id, beneficiario_id, canal, monto, estado, referencia, llave_idempotencia)
VALUES ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
        'retiro', 46000000, 'PorConfirmar', 'SUB-0003', 'demo-rosa-1');
UPDATE cobro SET estado = 'Pagando', version = version + 1
 WHERE id = 'e0000000-0000-0000-0000-000000000003';
UPDATE cobro SET estado = 'Fallido', motivo_rechazo = 'TopeSuperado', version = version + 1
 WHERE id = 'e0000000-0000-0000-0000-000000000003';

INSERT INTO evento (tipo_entidad, id_entidad, estado_anterior, estado_nuevo, detalle) VALUES
  ('programa', 'a0000000-0000-0000-0000-000000000001', 'EsperandoAprobacion', 'Activo', '{"texto":"Semilla solo UI: permiso falso."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000001', NULL, 'Solicitado', '{"texto":"Solicitaste el cobro a tu cuenta."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000001', 'Solicitado', 'Pagando', '{"texto":"Enviando el pago a tu cuenta."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000001', 'Pagando', 'Pagado', '{"texto":"El pago llegó a la cuenta."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', NULL, 'Solicitado', '{"texto":"Tienda Marta — corresponsal digitó la cédula."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', 'Solicitado', 'PorConfirmar', '{"texto":"Esperando el PIN de la persona."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', 'PorConfirmar', 'Pagando', '{"texto":"PIN correcto. Enviando el pago al punto."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000002', 'Pagando', 'Pagado', '{"texto":"Pago recibido. Ya se puede entregar el efectivo."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', NULL, 'Solicitado', '{"texto":"Tienda Marta — corresponsal digitó la cédula.","novedad":true}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', 'Solicitado', 'PorConfirmar', '{"texto":"Esperando el PIN de la persona."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', 'PorConfirmar', 'Pagando', '{"texto":"PIN correcto. Enviando el pago al punto."}'),
  ('cobro', 'e0000000-0000-0000-0000-000000000003', 'Pagando', 'Fallido', '{"texto":"El banco rechazó el pago: el programa llegó a su tope","motivo":"TopeSuperado"}');

COMMIT;

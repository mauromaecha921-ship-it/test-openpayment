import { ejecutar, uno, varios } from '../conexion.js'

export interface FilaBeneficiario {
  id: string
  tipo_documento: string
  numero_documento: string
  primer_nombre: string
  primer_apellido: string
  estado: 'Activo' | 'Anonimizado'
}

const COLUMNAS = 'id, tipo_documento, numero_documento, primer_nombre, primer_apellido, estado'

/** La persona por su cédula. Los anonimizados no cobran. */
export function porDocumento(documento: string): FilaBeneficiario | undefined {
  return uno<FilaBeneficiario>(
    `SELECT ${COLUMNAS} FROM beneficiario
     WHERE numero_documento = :documento AND estado = 'Activo'
     ORDER BY tipo_documento = 'CC' DESC LIMIT 1`,
    { documento },
  )
}

export function obtener(id: string): FilaBeneficiario | undefined {
  return uno<FilaBeneficiario>(`SELECT ${COLUMNAS} FROM beneficiario WHERE id = :id`, { id })
}

export function listar(): FilaBeneficiario[] {
  return varios<FilaBeneficiario>(`SELECT ${COLUMNAS} FROM beneficiario WHERE estado = 'Activo' ORDER BY numero_documento`)
}

export interface NuevaPersona {
  id: string
  numero_documento: string
  primer_nombre: string
  primer_apellido: string
}

/**
 * Registro del equipo (Plan de ajustes § 2): solo llegan la cédula y la wallet. El esquema pide más
 * campos (fechas, autorización de datos); van con valores fijos del piloto (hallazgo D-31).
 */
export function crear(p: NuevaPersona) {
  ejecutar(
    `INSERT INTO beneficiario (id, tipo_documento, numero_documento, fecha_expedicion, primer_nombre,
                               primer_apellido, fecha_nacimiento, autoriza_datos, fecha_autorizacion,
                               version_politica)
     VALUES (:id, 'CC', :numero_documento, '2000-01-01', :primer_nombre, :primer_apellido, '1970-01-01',
             1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'piloto-equipo')`,
    { ...p },
  )
}

/** Fecha de registro, para la lista del equipo. */
export function creadoEn(id: string): string {
  return uno<{ creado_en: string }>('SELECT creado_en FROM beneficiario WHERE id = :id', { id })!.creado_en
}

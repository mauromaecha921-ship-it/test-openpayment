/**
 * Renovación del token en segundo plano (hallazgo D-35). El token del permiso dura 10 minutos en
 * la Test Wallet: mientras la API esté prendida, se rota antes de que venza, así el permiso dura lo
 * que dure el programa sin que la entidad vuelva a aprobar. Si la API estuvo apagada tanto que el
 * banco ya no acepta la rotación, el programa queda con el permiso vencido y el tablero ofrece
 * «Renovar permiso».
 */
import { config } from '../config.js'
import { log } from '../comun/log.js'
import { varios } from '../db/conexion.js'
import { PermisoVencido, rotarPermiso } from './servicio.js'

/** Una vuelta: rota el token de cada programa Activo o Pausado con permiso vigente. */
export async function renovarTodos(): Promise<{ renovados: number; vencidos: number; fallidos: number }> {
  const programas = varios<{ id: string }>(
    `SELECT id FROM programa
     WHERE estado IN ('Activo', 'Pausado') AND token_acceso IS NOT NULL AND permiso_vencido_en IS NULL`,
  )
  const r = { renovados: 0, vencidos: 0, fallidos: 0 }
  for (const { id } of programas) {
    try {
      await rotarPermiso(id)
      r.renovados += 1
    } catch (e) {
      if (e instanceof PermisoVencido) {
        r.vencidos += 1
        log.warn('El permiso venció en el banco: la entidad tiene que renovarlo', { programa: id })
      } else {
        // Sin respuesta: se intenta otra vez en la próxima vuelta
        r.fallidos += 1
        log.warn('No se pudo renovar el token; se reintenta en la próxima vuelta', { error: e, programa: id })
      }
    }
  }
  return r
}

/** Arranca las vueltas: una al iniciar (el token pudo vencer con la API apagada) y luego cada TOKEN_RENOVAR_CADA_SEG. */
export function iniciarRenovacion(): () => void {
  let corriendo = false
  const vuelta = async () => {
    if (corriendo) return
    corriendo = true
    try {
      const r = await renovarTodos()
      if (r.renovados + r.vencidos + r.fallidos) log.info('Renovación de tokens', r)
    } finally {
      corriendo = false
    }
  }
  const inicial = setTimeout(() => void vuelta(), 2000)
  const reloj = setInterval(() => void vuelta(), config().TOKEN_RENOVAR_CADA_SEG * 1000)
  inicial.unref()
  reloj.unref()
  return () => {
    clearTimeout(inicial)
    clearInterval(reloj)
  }
}

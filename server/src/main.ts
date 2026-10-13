import './certificados.js'
import { crearApp } from './app.js'
import { recuperarAlArrancar } from './cobros/orquestacion.js'
import { baseDeDatos, config } from './config.js'
import { log } from './comun/log.js'
import { abrirBd, cerrarBd } from './db/conexion.js'
import { migrar } from './db/migrar.js'
import { iniciarRenovacion } from './programas/renovacion.js'

const cfg = config()
const base = baseDeDatos()
if (base.aviso) log.warn(base.aviso)
await abrirBd(base)
const nuevas = await migrar()
// Dónde quedan los datos, sin la contraseña (D-44)
log.info(`Base de datos: ${base.descripcion}`, nuevas.length ? { migracionesAplicadas: nuevas } : undefined)

const servidor = crearApp().listen(cfg.PORT, () => {
  log.info(`API en http://localhost:${cfg.PORT}/api`)
  // RNF-05 y P-08: una sola pasada sobre los cobros en Pagando
  recuperarAlArrancar()
    .then((n) => n && log.info('Recuperación al arrancar terminada', { cobrosEnPagando: n }))
    .catch((e) => log.error('Falló la recuperación al arrancar', { error: e }))
  // D-35: el token del permiso dura 10 minutos; se renueva mientras la API esté prendida
  iniciarRenovacion()
})

function apagar() {
  servidor.close(() => {
    void cerrarBd().finally(() => process.exit(0))
  })
}
process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)

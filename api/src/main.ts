import './certificados.js'
import { crearApp } from './app.js'
import { recuperarAlArrancar } from './cobros/orquestacion.js'
import { config, rutaBaseDeDatos } from './config.js'
import { log } from './comun/log.js'
import { abrirBd, cerrarBd } from './db/conexion.js'
import { migrar } from './db/migrar.js'

const cfg = config()
const bd = abrirBd(rutaBaseDeDatos())
const nuevas = migrar(bd)
if (nuevas.length) log.info('Migraciones aplicadas', { nuevas })

const servidor = crearApp().listen(cfg.PORT, () => {
  log.info(`API en http://localhost:${cfg.PORT}/api`)
  // RNF-05 y P-08: una sola pasada sobre los cobros en Pagando
  recuperarAlArrancar()
    .then((n) => n && log.info('Recuperación al arrancar terminada', { cobrosEnPagando: n }))
    .catch((e) => log.error('Falló la recuperación al arrancar', { error: e }))
})

function apagar() {
  servidor.close(() => {
    cerrarBd()
    process.exit(0)
  })
}
process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)

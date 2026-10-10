import { Navigate, useParams } from 'react-router'

import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { rutaDelPrograma } from '@/lib/pantallas'

import ProgramaCerrado from './ProgramaCerrado'
import Tablero from './Tablero'
import { useTablero } from './useTablero'

/** /entidad/programas/:id muestra el tablero, o el resumen del cierre cuando está Cerrado. */
export default function VistaPrograma() {
  const { id = '' } = useParams()
  const consulta = useTablero(id)
  const t = consulta.datos

  if (!t) {
    return (
      <MarcoEntidad>
        {consulta.error ? <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} /> : <Cargando />}
      </MarcoEntidad>
    )
  }
  const estado = t.programa.estado
  if (estado === 'Borrador' || estado === 'EsperandoAprobacion') return <Navigate to={rutaDelPrograma(id, estado)} replace />
  if (estado === 'Cerrado') return <ProgramaCerrado tablero={t} />
  return <Tablero tablero={t} error={consulta.error} recargar={consulta.recargar} />
}

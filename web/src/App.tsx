import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router'

import { API_SIMULADA } from '@/api/client'
import { Cargando } from '@/componentes/Comun'
import { MarcoRol } from '@/componentes/Marcos'
import { Titulo } from '@/componentes/Titulo'
import { RolProvider, useRol } from '@/contexto/Rol'
import CobrarCuenta from '@/vistas/beneficiario/CobrarCuenta'
import CobroPagado from '@/vistas/beneficiario/CobroPagado'
import DondeCobrar from '@/vistas/beneficiario/DondeCobrar'
import EnlazarCuenta from '@/vistas/beneficiario/EnlazarCuenta'
import Historial from '@/vistas/beneficiario/Historial'
import Inicio from '@/vistas/beneficiario/Inicio'
import AprobarEnBanco from '@/vistas/entidad/AprobarEnBanco'
import CerrarPrograma from '@/vistas/entidad/CerrarPrograma'
import ConectarPrograma from '@/vistas/entidad/ConectarPrograma'
import DetalleCobro from '@/vistas/entidad/DetalleCobro'
import VistaPrograma from '@/vistas/entidad/VistaPrograma'
import Entrada from '@/vistas/Entrada'
import Equipo from '@/vistas/Equipo'
import Estado from '@/vistas/Estado'
import CobroEnPunto from '@/vistas/punto/CobroEnPunto'
import MiCaja from '@/vistas/punto/MiCaja'
import NuevoCobro from '@/vistas/punto/NuevoCobro'

// Solo existe en el modo «API simulada»: hace las veces de la Test Wallet.
const BancoSimulado = lazy(() => import('@/api/simulada/BancoSimulado'))

/** Las vistas del beneficiario y del punto necesitan la cédula o el punto elegidos en la entrada. */
function ConRol({ rol, children }: { rol: 'beneficiario' | 'punto'; children: ReactNode }) {
  const sel = useRol()
  const listo = rol === 'beneficiario' ? sel.documento : sel.puntoId
  return listo ? children : <Navigate to="/" replace />
}

function NoExiste() {
  return (
    <MarcoRol>
      <Titulo className="text-[26px]">No encontramos esta página</Titulo>
      <Link to="/">Volver a la entrada</Link>
    </MarcoRol>
  )
}

export default function App() {
  return (
    <RolProvider>
      <Routes>
        <Route path="/" element={<Entrada />} />
        <Route path="/equipo" element={<Equipo />} />
        <Route path="/estado" element={<Estado />} />

        <Route path="/entidad/programas/nuevo" element={<ConectarPrograma />} />
        <Route path="/entidad/programas/:id/editar" element={<ConectarPrograma />} />
        <Route path="/entidad/programas/:id/aprobar" element={<AprobarEnBanco />} />
        <Route path="/entidad/programas/:id/cerrar" element={<CerrarPrograma />} />
        <Route path="/entidad/programas/:id" element={<VistaPrograma />} />
        <Route path="/entidad/cobros/:id" element={<DetalleCobro />} />

        <Route path="/beneficiario" element={<ConRol rol="beneficiario"><Inicio /></ConRol>} />
        <Route path="/beneficiario/cuenta" element={<ConRol rol="beneficiario"><EnlazarCuenta /></ConRol>} />
        <Route path="/beneficiario/cobrar" element={<ConRol rol="beneficiario"><CobrarCuenta /></ConRol>} />
        <Route path="/beneficiario/cobros/:id" element={<ConRol rol="beneficiario"><CobroPagado /></ConRol>} />
        <Route path="/beneficiario/puntos" element={<ConRol rol="beneficiario"><DondeCobrar /></ConRol>} />
        <Route path="/beneficiario/historial" element={<ConRol rol="beneficiario"><Historial /></ConRol>} />

        <Route path="/punto" element={<ConRol rol="punto"><NuevoCobro /></ConRol>} />
        <Route path="/punto/caja" element={<ConRol rol="punto"><MiCaja /></ConRol>} />
        <Route path="/punto/cobros/:id" element={<ConRol rol="punto"><CobroEnPunto /></ConRol>} />

        {API_SIMULADA && (
          <Route
            path="/simulada/banco"
            element={
              <Suspense fallback={<Cargando />}>
                <BancoSimulado />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NoExiste />} />
      </Routes>
    </RolProvider>
  )
}

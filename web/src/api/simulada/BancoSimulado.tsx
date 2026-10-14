import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { ListaDatos } from '@/componentes/Comun'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'

import { consentimiento, resolverConsentimiento } from './servidor'

/**
 * Hace las veces de la pantalla de consentimiento de la Test Wallet en el modo «API simulada».
 * Al aprobar o rechazar imita el callback de la API: cambia el estado y vuelve a la web con
 * `?resultado=`. Con la API real, esta pantalla la muestra el banco, fuera de Tatú.
 */
export default function BancoSimulado() {
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const tipo = busqueda.get('tipo') ?? ''
  const id = busqueda.get('id') ?? ''
  const [datos] = useState(() => consentimiento(tipo, id))

  const responder = (aprobado: boolean) => navegar(resolverConsentimiento(tipo, id, aprobado), { replace: true })

  return (
    // Imita otro banco: siempre en claro, aunque el piloto esté en modo oscuro.
    <div data-tema="claro" className="min-h-dvh bg-[#eef1f6] px-4 py-10 text-foreground">
      <main className="mx-auto flex max-w-[520px] flex-col gap-5 rounded-2xl border border-border bg-background p-6 shadow-sm">
        <span className="self-start rounded-full border border-dashed border-control px-3 py-0.5 text-sm text-muted-foreground">
          Test Wallet simulada · no es tu banco real
        </span>
        {datos ? (
          <>
            <Titulo className="text-2xl">{datos.titulo}</Titulo>
            <ListaDatos className="text-[15px]" filas={datos.filas.map(([a, b]) => [a, <span key={a} className="[overflow-wrap:anywhere]">{b}</span>])} />
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="flex-1" onClick={() => responder(true)}>
                Aprobar
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={() => responder(false)}>
                Rechazar
              </Button>
            </div>
          </>
        ) : (
          <>
            <Titulo className="text-2xl">Esta solicitud ya no está pendiente</Titulo>
            <p className="m-0 text-muted-foreground">Se aprobó, se rechazó, se canceló o venció. Vuelve a la app para ver su estado.</p>
            <Button asChild variant="outline" size="lg">
              <a href="/">Volver a Tatú</a>
            </Button>
          </>
        )}
      </main>
    </div>
  )
}

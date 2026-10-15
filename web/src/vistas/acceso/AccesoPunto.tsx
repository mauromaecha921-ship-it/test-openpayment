import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api } from '@/api/client'
import type { Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'
import { cn } from '@/lib/utils'

import { MarcoAcceso } from './MarcoAcceso'

/** Pantallas L2 y LD2 del prototipo: el punto elige desde qué tienda atiende. */
export default function AccesoPunto() {
  const navegar = useNavigate()
  const rol = useRol()
  const { datos, error, recargar } = usePolling<Punto[]>(() => api.get<Punto[]>('/puntos'), null)
  const [puntoId, setPuntoId] = useState(rol.puntoId ?? '')
  const [busqueda, setBusqueda] = useState('')

  const puntos = datos ?? []
  useEffect(() => {
    if (!datos) return
    setPuntoId((v) => (datos.some((p) => p.id === v) ? v : (datos[0]?.id ?? '')))
  }, [datos])

  const q = busqueda.trim().toLowerCase()
  const visibles = q ? puntos.filter((p) => `${p.nombre} ${p.direccion ?? ''}`.toLowerCase().includes(q)) : puntos
  const elegido = puntos.find((p) => p.id === puntoId)
  const corto = (nombre: string) => nombre.split(' — ')[0]

  const entrar = () => {
    if (!elegido) return
    rol.actualizar({ rol: 'punto', puntoId: elegido.id, puntoNombre: elegido.nombre })
    navegar('/punto')
  }

  return (
    <MarcoAcceso
      titular="Paga subsidios sin adelantar tu caja"
      texto="Entregas el efectivo solo cuando la pantalla dice Pagado, y el reembolso llega a tu billetera en segundos."
      titulo="¿Desde qué punto atiendes?"
      intro="Elige tu tienda para ver tu caja y empezar a pagar."
    >
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-tenue" />
        <input
          aria-label="Buscar punto de retiro"
          placeholder="Buscar por nombre o dirección"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="h-[52px] w-full rounded-xl border-[1.5px] border-control bg-card pr-3.5 pl-11 text-[17px] text-foreground"
        />
      </div>

      {error && !datos && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!datos && !error && <Cargando />}

      {datos && (
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2 p-0 text-base font-bold">Puntos de retiro registrados</legend>
          {visibles.length === 0 && (
            <p className="m-0 rounded-xl border-2 border-dashed border-border px-4 py-3 text-tenue">
              {puntos.length === 0 ? 'Todavía no hay puntos registrados.' : 'Ningún punto coincide con tu búsqueda.'}
            </p>
          )}
          {visibles.map((p) => {
            const marcado = p.id === puntoId
            return (
              <label
                key={p.id}
                className={cn(
                  'flex min-h-[68px] cursor-pointer items-center gap-3.5 rounded-2xl bg-card px-4 py-3',
                  marcado ? 'border-[2.5px] border-primary' : 'border border-border',
                )}
              >
                <input type="radio" name="punto" checked={marcado} onChange={() => setPuntoId(p.id)} className="size-[22px] shrink-0 accent-primary" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-bold">
                    {corto(p.nombre)}
                    {p.tipo === 'compra' && <span className="font-normal text-tenue"> · comercio (bonos)</span>}
                  </span>
                  {p.direccion && <span className="text-[15px] text-muted-foreground">{p.direccion}</span>}
                </span>
              </label>
            )
          })}
        </fieldset>
      )}

      <Button size="lg" className="min-h-14 text-lg font-bold" onClick={entrar} disabled={!elegido}>
        {elegido ? `Entrar como ${corto(elegido.nombre)}` : 'Entrar'}
      </Button>
      {datos && puntos.length === 0 && (
        <Link to="/equipo" className="self-start text-[15px]">
          Agregar un punto en el equipo de prueba
        </Link>
      )}
    </MarcoAcceso>
  )
}

import { ChevronRight, House, Monitor, Smartphone, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'
import type { BeneficiarioDemo, Punto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { ErrorCarga } from '@/componentes/Comun'
import { PantallaCelular, PastillaPrueba } from '@/componentes/Proto'
import { useRol } from '@/contexto/Rol'
import { cn } from '@/lib/utils'

// Prototipo «Main» (Elegir rol), tal cual. Con quién se prueba se elige en el panel de prueba (la
// pestaña del borde derecho); aquí se muestra la selección actual en el texto de cada fila.

export const claseSelect =
  'min-h-12 w-full rounded-lg border border-control bg-background px-3 text-base font-normal text-foreground'

const COLOR = {
  entidad: 'bg-foreground text-background',
  beneficiario: 'bg-primary text-white',
  punto: 'bg-ambar text-noche',
}

function FilaRol({ icono, color, titulo, texto, onClick, deshabilitado }: { icono: ReactNode; color: keyof typeof COLOR; titulo: string; texto: string; onClick: () => void; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[18px] border-[1.5px] border-border bg-card px-4 py-3.5 text-left text-foreground disabled:opacity-60"
    >
      <span aria-hidden className={cn('flex size-11 flex-none items-center justify-center rounded-xl [&_svg]:size-[22px]', COLOR[color])}>
        {icono}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-lg font-bold">{titulo}</span>
        <span className="text-[15px] text-muted-foreground">{texto}</span>
      </span>
      <ChevronRight aria-hidden className="size-5" strokeWidth={2} />
    </button>
  )
}

export default function Entrada() {
  const navegar = useNavigate()
  const rol = useRol()
  const { datos, error, recargar } = usePolling(async () => {
    const [beneficiarios, puntos] = await Promise.all([api.get<BeneficiarioDemo[]>('/beneficiarios/demo'), api.get<Punto[]>('/puntos')])
    return { beneficiarios, puntos }
  }, null)

  // Si todavía no eligió en el panel, se entra con la primera persona y el primer punto
  const persona = datos?.beneficiarios.find((b) => b.documento === rol.documento) ?? datos?.beneficiarios[0]
  const punto = datos?.puntos.find((p) => p.id === rol.puntoId) ?? datos?.puntos[0]
  const puntoCorto = punto?.nombre.split(' — ')[0]

  const entrarEntidad = () => {
    rol.actualizar({ rol: 'entidad' })
    navegar('/entidad')
  }
  const entrarBeneficiario = () => {
    if (!persona) return navegar('/equipo')
    rol.actualizar({ rol: 'beneficiario', documento: persona.documento, nombre: persona.nombre })
    navegar('/beneficiario')
  }
  const entrarPunto = () => {
    if (!punto) return navegar('/equipo')
    rol.actualizar({ rol: 'punto', puntoId: punto.id, puntoNombre: punto.nombre })
    navegar('/punto')
  }

  return (
    <PantallaCelular className="gap-[22px]">
      <div className="flex justify-end">
        <PastillaPrueba />
      </div>
      <div className="flex flex-col items-center gap-2.5 text-center">
        <img src="/marca/tatu-logo-claro.svg" alt="" className="h-auto w-[124px] oscuro:hidden" />
        <img src="/marca/tatu-logo-oscuro.svg" alt="" className="hidden h-auto w-[124px] rounded-3xl oscuro:block" />
        <h1 className="marca m-0 text-[50px]">Tatú</h1>
        <p className="m-0 mt-1.5 max-w-[300px] text-lg leading-[1.4]">La plata del subsidio sale de la cuenta de la entidad solo cuando alguien cobra.</p>
      </div>

      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}

      <div className="flex flex-col gap-3" aria-busy={!datos && !error}>
        <h2 className="m-0 text-base font-semibold text-muted-foreground">¿Cómo quieres entrar?</h2>
        <FilaRol icono={<House />} color="entidad" titulo="Entidad" texto="Sus programas y lo que se ha cobrado" onClick={entrarEntidad} />
        <FilaRol
          icono={<Smartphone />}
          color="beneficiario"
          titulo="Beneficiaria"
          texto={persona ? `${persona.nombre} · sus subsidios por cobrar` : datos ? 'Registra a alguien en el equipo de prueba' : 'Cargando…'}
          onClick={entrarBeneficiario}
          deshabilitado={!datos}
        />
        <FilaRol
          icono={<Store />}
          color="punto"
          titulo="Punto de retiro"
          texto={puntoCorto ? `${puntoCorto} · en el celular` : datos ? 'Agrega un punto en el equipo de prueba' : 'Cargando…'}
          onClick={entrarPunto}
          deshabilitado={!datos}
        />
        <button
          type="button"
          onClick={entrarPunto}
          disabled={!datos}
          className="flex min-h-11 items-center justify-center gap-2 border-0 bg-transparent text-base font-semibold text-foreground underline underline-offset-[3px]"
        >
          <Monitor aria-hidden className="size-[18px]" />
          Punto de retiro en computador
        </button>
      </div>

      <p className="m-0 mt-auto text-center text-[15px] leading-[1.45] text-muted-foreground">
        Quien no usa la app cobra en el punto con su cédula y su PIN. Para probar con otra persona u otro punto, abre el panel de
        prueba (la pestaña del borde derecho).
      </p>
    </PantallaCelular>
  )
}

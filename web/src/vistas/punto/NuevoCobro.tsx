import { ChevronRight, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Cobro, CobroResumen } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Aviso, MensajeError } from '@/componentes/Comun'
import { EstadoCobro } from '@/componentes/EstadoCobro'
import { MarcoPunto } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { useRol } from '@/contexto/Rol'
import { formatHora } from '@/lib/textos'

/** Wireframe 14: el punto digita la cédula; la API busca el subsidio con pago disponible (D-21). */
export default function NuevoCobro() {
  const navegar = useNavigate()
  const { puntoId } = useRol()
  const [documento, setDocumento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Una llave por intento (HU-10): la misma en el doble clic y en el reintento de la misma cédula.
  const llave = useMemo(() => crypto.randomUUID(), [documento])

  const hoy = usePolling(() => api.get<CobroResumen[]>(`/puntos/${puntoId}/cobros?desde=hoy`), null, false, { clave: puntoId })

  const consultar = async () => {
    const cedula = documento.trim()
    if (!/^\d{5,12}$/.test(cedula)) return setError('Digita el número de la cédula, sin puntos ni espacios.')
    setEnviando(true)
    setError(null)
    try {
      const c = await api.post<Cobro>('/cobros', { documento: cedula, canal: 'retiro', puntoId, llaveIdempotencia: llave })
      navegar(`/punto/cobros/${c.id}`)
    } catch (e) {
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  return (
    <MarcoPunto ancho="ancho">
      <Titulo className="text-[28px] md:text-[32px]">Nuevo cobro</Titulo>
      {/* En PC: la cédula a la izquierda y los cobros de hoy a la derecha. */}
      <div className="grid items-start gap-[18px] md:grid-cols-2 md:gap-10">
      <div className="flex min-w-0 flex-col gap-[18px]">
      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault()
          void consultar()
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="cedula" className="text-[17px] font-bold">
            Cédula del beneficiario
          </label>
          <Input
            id="cedula"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Número de cédula"
            value={documento}
            aria-describedby="ayuda-cedula"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setDocumento(e.target.value.replace(/\D/g, ''))
              setError(null)
            }}
            className="h-auto min-h-16 rounded-xl border-2 border-foreground px-4 py-3 text-[30px] tracking-[1px] md:text-[30px]"
          />
        </div>
        <p id="ayuda-cedula" className="m-0 text-muted-foreground">
          Pide la cédula original y digita el número. No necesitas fotos ni papeles.
        </p>
        <MensajeError>{error}</MensajeError>
        <Button type="submit" size="lg" className="min-h-[60px] text-xl" disabled={enviando}>
          {enviando ? 'Consultando…' : 'Consultar'}
        </Button>
      </form>

      <Aviso icono={<TriangleAlert aria-hidden />}>
        Entrega el efectivo solo cuando veas <strong>«Pagado»</strong>.
      </Aviso>
      </div>

      <section className="mt-2 flex min-w-0 flex-col gap-2.5 md:mt-0" aria-labelledby="titulo-hoy">
        <h2 id="titulo-hoy" className="m-0 text-lg font-bold">
          Cobros de hoy
        </h2>
        {hoy.datos?.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {hoy.datos.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/punto/cobros/${c.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-foreground no-underline hover:bg-muted hover:text-foreground"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <strong>{c.persona.nombre ?? c.persona.etiqueta}</strong>
                      <span className="text-muted-foreground">{textoMonto(c.monto, c.moneda)}</span>
                      <time dateTime={c.creado} className="text-sm text-tenue">
                        {formatHora(c.creado, false)}
                      </time>
                    </span>
                    <EstadoCobro estado={c.estado} motivo={c.motivo} />
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border px-4 py-5 text-center text-tenue">
            {hoy.error ? hoy.error : hoy.datos ? 'Todavía no hay cobros hoy.' : 'Cargando…'}
          </div>
        )}
      </section>
      </div>
    </MarcoPunto>
  )
}

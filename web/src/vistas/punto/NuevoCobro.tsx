import { ChevronRight, TriangleAlert, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { CajaPunto, Cobro, CobroResumen, PagosEnPunto } from '@/api/tipos'
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

/** D-36: lo de hoy en una línea, con el enlace a «Mi caja». */
export function CajaDeHoy({ puntoId }: { puntoId: string | null }) {
  const caja = usePolling(() => api.get<CajaPunto>(`/puntos/${puntoId}/resumen?desde=hoy`), 10_000, true, { clave: puntoId })
  const t = caja.datos?.totales[0]
  if (!caja.datos) return null
  const total = <strong>{t ? textoMonto(t.entregado, t.moneda) : '$0'}</strong>
  if (caja.datos.punto.tipo === 'compra') {
    // § 11: una sede de comercio no entrega efectivo; recibe el pago de los bonos
    return (
      <Link to="/punto/caja" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted px-4 py-3 text-foreground no-underline hover:text-foreground">
        <Wallet aria-hidden className="size-5 shrink-0" />
        <span className="flex-1">Hoy vendiste con bonos {total} · ya te pagaron todo</span>
        <span className="inline-flex items-center gap-1 text-enlace">
          Mi caja <ChevronRight aria-hidden className="size-4" />
        </span>
      </Link>
    )
  }
  return (
    <Link
      to="/punto/caja"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted px-4 py-3 text-foreground no-underline hover:text-foreground"
    >
      <Wallet aria-hidden className="size-5 shrink-0" />
      <span className="flex-1">
        Hoy entregaste {total} · ya te reembolsaron todo · <strong>$0</strong> por adelantado
      </span>
      <span className="inline-flex items-center gap-1 text-enlace">
        Mi caja <ChevronRight aria-hidden className="size-4" />
      </span>
    </Link>
  )
}

/** Wireframe 14: el punto digita la cédula; si la persona tiene varios subsidios, elige cuál pagar. */
export default function NuevoCobro() {
  const navegar = useNavigate()
  const { puntoId } = useRol()
  const [documento, setDocumento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Una llave por intento (HU-10): la misma en el doble clic y en el reintento de la misma cédula.
  const llave = useMemo(() => crypto.randomUUID(), [documento])

  // Si la persona tiene subsidios en varios programas, el punto elige cuál pagar
  const [opciones, setOpciones] = useState<PagosEnPunto | null>(null)

  const hoy = usePolling(() => api.get<CobroResumen[]>(`/puntos/${puntoId}/cobros?desde=hoy`), null, false, { clave: puntoId })

  /** Sin programaId, la API elige (D-21) y deja el rechazo en pantalla si no hay nada que pagar (HU-13). */
  const pedir = async (cedula: string, programaId?: string) => {
    setEnviando(true)
    setError(null)
    try {
      const c = await api.post<Cobro>('/cobros', {
        documento: cedula,
        canal: 'retiro',
        puntoId,
        programaId,
        // Una llave por cédula y subsidio: el doble clic en la misma opción no crea dos cobros
        llaveIdempotencia: programaId ? `${llave}-${programaId}` : llave,
      })
      navegar(`/punto/cobros/${c.id}`)
    } catch (e) {
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  const consultar = async () => {
    const cedula = documento.trim()
    if (!/^\d{5,12}$/.test(cedula)) return setError('Digita el número de la cédula, sin puntos ni espacios.')
    setEnviando(true)
    setError(null)
    setOpciones(null)
    let consulta: PagosEnPunto | null = null
    try {
      consulta = await api.get<PagosEnPunto>(`/puntos/${puntoId}/pagos?documento=${cedula}`)
    } catch {
      // Cédula desconocida o liquidación caída: el cobro lo dice como siempre
    }
    if (consulta && consulta.pagos.length > 1) {
      setOpciones(consulta)
      setEnviando(false)
      return
    }
    await pedir(cedula, consulta?.pagos[0]?.programa.id)
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
              setOpciones(null)
            }}
            className="h-auto min-h-16 rounded-xl border-2 border-foreground px-4 py-3 text-[30px] tracking-[1px] md:text-[30px]"
          />
        </div>
        <p id="ayuda-cedula" className="m-0 text-muted-foreground">
          Pide la cédula original y digita el número. No necesitas fotos ni papeles.
        </p>
        <MensajeError>{error}</MensajeError>
        {!opciones && (
          <Button type="submit" size="lg" className="min-h-[60px] text-xl" disabled={enviando}>
            {enviando ? 'Consultando…' : 'Consultar'}
          </Button>
        )}
      </form>

      {opciones && (
        <section aria-labelledby="titulo-opciones" className="flex flex-col gap-3 rounded-2xl border-2 border-foreground p-5">
          <h2 id="titulo-opciones" className="m-0 text-xl font-bold">
            {opciones.persona.nombre} tiene {opciones.pagos.length} subsidios por cobrar
          </h2>
          <p className="m-0 text-muted-foreground">¿Cuál vas a pagar? Cada retiro paga uno; el otro lo puede cobrar después.</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {opciones.pagos.map((p) => (
              <li key={p.programa.id}>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void pedir(documento.trim(), p.programa.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-control bg-background px-4 py-3 text-left text-foreground hover:bg-muted disabled:opacity-60"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="text-2xl">{textoMonto(p.monto, p.moneda)}</strong>
                    <span className="text-[15px] text-muted-foreground">{p.programa.nombre}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-6 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => setOpciones(null)} disabled={enviando}>
            Cancelar
          </Button>
        </section>
      )}

      <Aviso icono={<TriangleAlert aria-hidden />}>
        Entrega el efectivo solo cuando veas <strong>«Pagado»</strong>.
      </Aviso>
      </div>

      <section className="mt-2 flex min-w-0 flex-col gap-2.5 md:mt-0" aria-labelledby="titulo-hoy">
        <CajaDeHoy puntoId={puntoId} />
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

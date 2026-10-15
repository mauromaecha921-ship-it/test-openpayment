import { ChevronRight, ShoppingBag, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Cobro, PagoPendiente, PagosEnPunto } from '@/api/tipos'
import { Aviso, MensajeError } from '@/componentes/Comun'
import { MarcoPunto } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { useRol } from '@/contexto/Rol'
import { irAlCobroDelPunto } from '@/lib/irAlCobro'
import { aUnidades } from '@/lib/montos'

import { CajaDeHoy } from './NuevoCobro'

/** Lo que cubre el bono y lo que paga el cliente: el bono paga min(bono, total) (RN-05). */
function reparto(p: PagoPendiente, total: string) {
  const bono = BigInt(p.monto)
  const t = BigInt(total)
  const cubre = bono < t ? bono : t
  return { cubre: cubre.toString(), resto: (t - cubre).toString() }
}

/**
 * Wireframe 20 · Extra 1 (HU-21, Plan de ajustes § 11): la sede de un comercio cobra una compra con
 * el bono del cliente. Total → cédula → «el bono cubre $X, cobra $Y» → PIN → Pagado.
 */
export default function VentaConBono() {
  const navegar = useNavigate()
  const { puntoId } = useRol()
  const [total, setTotal] = useState('')
  const [documento, setDocumento] = useState('')
  const [opciones, setOpciones] = useState<PagosEnPunto | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Una llave por intento (HU-10): cambia con la cédula y el total
  const llave = useMemo(() => crypto.randomUUID(), [documento, total])

  const limpiar = () => {
    setOpciones(null)
    setError(null)
  }

  /** Sin programaId, la API busca el bono y deja el rechazo en pantalla (HU-13, HU-21). */
  const pedir = async (unidades: string, programaId?: string) => {
    setEnviando(true)
    setError(null)
    try {
      const c = await api.post<Cobro>('/cobros', {
        documento: documento.trim(),
        canal: 'compra',
        puntoId,
        programaId,
        totalCompra: unidades,
        llaveIdempotencia: programaId ? `${llave}-${programaId}` : llave,
      })
      irAlCobroDelPunto(navegar, c)
    } catch (e) {
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  const consultar = async () => {
    // La escala de COP es 2; si el bono es de otra moneda, la API lo dice al cobrar
    const unidades = aUnidades(total, 2)
    if (!unidades || unidades === '0') return setError('Escribe el total de la compra en pesos, sin puntos de miles (por ejemplo, 80000).')
    if (!/^\d{5,12}$/.test(documento.trim())) return setError('Digita el número de la cédula, sin puntos ni espacios.')
    setEnviando(true)
    setError(null)
    setOpciones(null)
    let consulta: PagosEnPunto | null = null
    try {
      consulta = await api.get<PagosEnPunto>(`/puntos/${puntoId}/pagos?documento=${documento.trim()}`)
    } catch {
      // Cédula desconocida: el cobro lo dice como siempre
    }
    if (consulta?.pagos.length) {
      setOpciones(consulta)
      setEnviando(false)
      return
    }
    await pedir(unidades)
  }

  const unidades = aUnidades(total, 2)

  return (
    <MarcoPunto ancho="ancho">
      <Titulo className="text-[28px] md:text-[32px]">Venta con bono</Titulo>
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
              <label htmlFor="total" className="text-[17px] font-bold">
                Total de la compra
              </label>
              <Input
                id="total"
                inputMode="decimal"
                autoComplete="off"
                placeholder="80000"
                value={total}
                onChange={(e) => {
                  setTotal(e.target.value.replace(/[^\d.,]/g, ''))
                  limpiar()
                }}
                className="h-auto min-h-16 rounded-xl border-2 border-foreground px-4 py-3 text-[30px] md:text-[30px]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cedula" className="text-[17px] font-bold">
                Cédula del cliente
              </label>
              <Input
                id="cedula"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Número de cédula"
                value={documento}
                onChange={(e) => {
                  setDocumento(e.target.value.replace(/\D/g, ''))
                  limpiar()
                }}
                className="h-auto min-h-16 rounded-xl border-2 border-foreground px-4 py-3 text-[30px] tracking-[1px] md:text-[30px]"
              />
            </div>
            <MensajeError>{error}</MensajeError>
            {!opciones && (
              <Button type="submit" size="lg" className="min-h-[60px] text-xl" disabled={enviando}>
                {enviando ? 'Consultando…' : 'Consultar bono'}
              </Button>
            )}
          </form>

          {opciones && unidades && (
            <section aria-labelledby="titulo-bonos" className="flex flex-col gap-3 rounded-2xl border-2 border-foreground p-5">
              <h2 id="titulo-bonos" className="m-0 text-xl font-bold">
                {opciones.persona.nombre} tiene {opciones.pagos.length === 1 ? 'un bono que sirve aquí' : `${opciones.pagos.length} bonos que sirven aquí`}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {opciones.pagos.map((p) => {
                  const { cubre, resto } = reparto(p, unidades)
                  return (
                    <li key={p.programa.id}>
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => void pedir(unidades, p.programa.id)}
                        className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-control bg-background px-4 py-3 text-left text-foreground hover:bg-muted disabled:opacity-60"
                      >
                        <ShoppingBag aria-hidden className="size-6 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <strong className="text-xl">El bono cubre {textoMonto(cubre, p.moneda)}</strong>
                          <span className="text-[15px]">
                            {resto === '0' ? 'El cliente no paga nada más' : `Cobra ${textoMonto(resto, p.moneda)} al cliente`}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {p.programa.nombre} · bono de {textoMonto(p.monto, p.moneda)}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="size-6 shrink-0" />
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="m-0 text-sm text-muted-foreground">Al elegirlo, el cliente confirma con su PIN. El bono se usa una sola vez.</p>
              <Button variant="outline" onClick={limpiar} disabled={enviando}>
                Cancelar
              </Button>
            </section>
          )}

          <Aviso icono={<TriangleAlert aria-hidden />}>
            Entrega la compra solo cuando veas <strong>«Pagado»</strong>.
          </Aviso>
        </div>
        <section className="flex min-w-0 flex-col gap-2.5" aria-label="Hoy">
          <CajaDeHoy puntoId={puntoId} />
          <p className="m-0 text-[15px] text-muted-foreground">
            Aquí solo se aceptan bonos con destino: el cliente no recibe efectivo. El bono paga hasta su valor y el resto lo paga el cliente
            por fuera de Tatú.
          </p>
        </section>
      </div>
    </MarcoPunto>
  )
}

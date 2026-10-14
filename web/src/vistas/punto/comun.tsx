import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { CajaPunto, Cobro, CobroResumen, PagosEnPunto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { textoMonto } from '@/componentes/Monto'
import { ChipCobro } from '@/componentes/Proto'
import { formatHora, plural } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { detalleCobro, personaTexto } from '@/vistas/entidad/Tablero'

// Lo que comparten las pantallas del punto en el celular (P0, P1, P1b) y en el computador (PD0, PD1).

/** La caja de hoy (D-36) y los cobros de hoy, que se refrescan mientras la vista está abierta. */
export function useHoy(puntoId: string | null) {
  const caja = usePolling(() => api.get<CajaPunto>(`/puntos/${puntoId}/resumen?desde=hoy`), 10_000, true, { clave: puntoId })
  const cobros = usePolling(() => api.get<CobroResumen[]>(`/puntos/${puntoId}/cobros?desde=hoy`), 5000, true, { clave: puntoId })
  return { caja, cobros }
}

/** Las cifras de la caja ya formateadas, con los textos del prototipo. */
export function cifrasCaja(c: CajaPunto | undefined) {
  const t = c?.totales[0]
  const monto = (v: string | undefined) => (t && v !== undefined ? textoMonto(v, t.moneda) : '$0')
  const enCamino = t && t.pendiente !== '0'
  return {
    entregado: monto(t?.entregado),
    reembolsado: monto(t?.reembolsado),
    adelantado: monto(c?.giradoPorAdelantado),
    pagados: c?.cobros.pagados ?? 0,
    enCurso: c?.cobros.enCurso ?? 0,
    reembolsoTexto: enCamino ? `${monto(t.pendiente)} en camino a tu billetera` : 'Ya te reembolsaron todo',
    adelantadoTexto: c && c.giradoPorAdelantado !== '0' ? 'Por recuperar' : 'Nada por recuperar',
  }
}

/** «SUB-0004 · 10:50 · Tope del banco»: la línea de abajo de cada cobro. */
function lineaCobro(c: CobroResumen) {
  const detalle = detalleCobro(c)
  return [c.estado === 'Rechazado' ? null : c.referencia, formatHora(c.creado, false), detalle].filter(Boolean).join(' · ')
}

/** Prototipo P0: los cobros de hoy en filas con línea arriba; cada uno abre su cobro. */
export function ListaCobrosHoy({ cobros, cargando }: { cobros: CobroResumen[] | undefined; cargando: boolean }) {
  if (!cobros) return <p className="m-0 py-3 text-muted-foreground">{cargando ? 'Cargando…' : 'No pudimos cargar los cobros de hoy.'}</p>
  if (cobros.length === 0) return <p className="m-0 border-t border-border py-3 text-muted-foreground">Todavía no hay cobros hoy.</p>
  return (
    <ul className="m-0 mt-1.5 list-none p-0">
      {cobros.map((c) => (
        <li key={c.id}>
          <Link to={`/punto/cobros/${c.id}`} className="flex items-center gap-3 border-t border-border py-3 text-foreground no-underline hover:text-foreground">
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-base font-bold">{personaTexto(c)}</span>
              <span className="text-sm text-muted-foreground">{lineaCobro(c)}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="text-base font-bold">{textoMonto(c.monto, c.moneda)}</span>
              <ChipCobro estado={c.estado} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const TH = 'px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground'
const TD = 'border-t border-border px-3 py-3.5 text-left align-middle'

/** Prototipo PD0: los cobros de hoy en tabla. */
export function TablaCobrosHoy({ cobros, cargando }: { cobros: CobroResumen[] | undefined; cargando: boolean }) {
  return (
    <div className="relative min-w-0 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-base">
        <thead>
          <tr>
            <th className={TH}>Referencia</th>
            <th className={TH}>Beneficiario</th>
            <th className={cn(TH, 'text-right')}>Valor</th>
            <th className={TH}>Estado</th>
            <th className={TH}>Hora</th>
          </tr>
        </thead>
        <tbody>
          {!cobros?.length && (
            <tr>
              <td colSpan={5} className={cn(TD, 'text-muted-foreground')}>
                {cobros ? 'Todavía no hay cobros hoy.' : cargando ? 'Cargando…' : 'No pudimos cargar los cobros de hoy.'}
              </td>
            </tr>
          )}
          {cobros?.map((c) => {
            const detalle = detalleCobro(c)
            return (
              <tr key={c.id}>
                <td className={TD}>
                  <Link to={`/punto/cobros/${c.id}`} className="font-bold text-foreground hover:text-foreground">
                    {c.estado === 'Rechazado' ? '—' : c.referencia}
                  </Link>
                </td>
                <td className={TD}>{personaTexto(c)}</td>
                <td className={cn(TD, 'text-right')}>
                  <b>{textoMonto(c.monto, c.moneda)}</b>
                </td>
                <td className={TD}>
                  <ChipCobro estado={c.estado} />
                  {detalle && <div className="mt-1 text-sm text-muted-foreground">{detalle}</div>}
                </td>
                <td className={TD}>
                  <time dateTime={c.creado}>{formatHora(c.creado, false)}</time>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Consultar la cédula (P1) y pedir el cobro del subsidio elegido (P1b). Si la persona tiene pagos
 * se muestran siempre, aunque sea uno; si no, se pide igual y la API deja el rechazo en pantalla
 * (HU-13). Una llave por intento (HU-10): la misma en el doble clic y en el reintento.
 */
export function useConsultaCedula(puntoId: string | null) {
  const navegar = useNavigate()
  const [documento, setDocumento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opciones, setOpciones] = useState<PagosEnPunto | null>(null)
  const llave = useMemo(() => crypto.randomUUID(), [documento])

  const pedir = async (programaId?: string) => {
    setEnviando(true)
    setError(null)
    try {
      const c = await api.post<Cobro>('/cobros', {
        documento: documento.trim(),
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
    let consulta: PagosEnPunto | null = null
    try {
      consulta = await api.get<PagosEnPunto>(`/puntos/${puntoId}/pagos?documento=${cedula}`)
    } catch {
      // Cédula desconocida o liquidación caída: el cobro lo dice como siempre
    }
    if (consulta && consulta.pagos.length > 0) {
      setOpciones(consulta)
      setEnviando(false)
      return
    }
    await pedir()
  }

  return {
    documento,
    cambiarDocumento: (v: string) => {
      setDocumento(v.replace(/\D/g, ''))
      setError(null)
      setOpciones(null)
    },
    consultar,
    pedir,
    opciones,
    volver: () => {
      setOpciones(null)
      setError(null)
    },
    enviando,
    error,
  }
}

export type ConsultaCedula = ReturnType<typeof useConsultaCedula>

/** «Tiene 1 pago disponible.» */
export function textoPagos(n: number) {
  return plural(n, 'pago disponible', 'pagos disponibles')
}

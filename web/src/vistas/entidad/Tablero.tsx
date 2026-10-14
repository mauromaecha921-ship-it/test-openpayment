import { Pause, Play, RefreshCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { CobroResumen, Tablero as DatosTablero, Redireccion } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { MensajeError } from '@/componentes/Comun'
import { PantallaEntidad } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import { Boton, BotonEnlace, Caja, ChipCobro, TarjetaCifra } from '@/componentes/Proto'
import { Button } from '@/componentes/ui/button'
import { formatHora, formatSegundos, formatVigencia, MOTIVO_CORTO } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { prepararPestana } from '@/lib/ventana'

import { ChipPrograma } from './TusProgramas'

/** Porcentaje con un decimal, calculado con BigInt. */
export function porcentaje(parte: string, total: string): number {
  const t = BigInt(total)
  if (t === 0n) return 0
  return Number((BigInt(parte) * 1000n) / t) / 10
}

export function personaTexto(c: Pick<CobroResumen, 'persona'>): string {
  const partes = [c.persona.nombre, c.persona.etiqueta].filter(Boolean)
  return partes.join(' · ') + (c.persona.novedad ? ' · novedad' : '')
}


/**
 * D-35: el token del permiso dura 10 minutos y la API lo renueva sola mientras está prendida. Si
 * estuvo apagada mucho tiempo, el banco ya no acepta la renovación: hay que aprobar un permiso
 * nuevo por lo que falta del tope. El tablero se actualiza solo cuando vuelve aprobado.
 */
function AvisoPermisoVencido({ programaId }: { programaId: string }) {
  const [enviando, setEnviando] = useState(false)
  const [esperando, setEsperando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const renovar = async () => {
    const pestana = prepararPestana()
    setEnviando(true)
    setError(null)
    try {
      const r = await api.post<Redireccion>(`/programas/${programaId}/renovar-permiso`)
      setEsperando(r.redirect)
      pestana.ir(r.redirect)
    } catch (e) {
      pestana.cerrar()
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section role="alert" className="flex flex-col gap-3 rounded-xl border-2 border-rechazo bg-rechazo-fondo p-5 text-rechazo">
      <h2 className="m-0 flex items-center gap-2 text-lg font-bold">
        <TriangleAlert aria-hidden className="size-5 shrink-0" />
        El permiso en tu banco venció
      </h2>
      <p className="m-0 text-foreground">
        La plataforma estuvo apagada tanto tiempo que el banco ya no acepta renovarlo sola. Mientras tanto, los cobros fallan sin mover
        dinero. Apruébalo de nuevo en tu banco, una sola vez, por lo que falta del tope; lo ya cobrado se conserva.
      </p>
      <MensajeError>{error}</MensajeError>
      {esperando ? (
        <div className="flex flex-wrap items-center gap-3 text-foreground">
          <span>Esperando tu aprobación en el banco…</span>
          <Button variant="outline" onClick={() => window.open(esperando, '_blank', 'noopener')}>
            Abrir mi banco otra vez
          </Button>
        </div>
      ) : (
        <Button className="self-start" onClick={() => void renovar()} disabled={enviando}>
          <RefreshCw aria-hidden />
          {enviando ? 'Pidiendo la renovación…' : 'Renovar permiso'}
        </Button>
      )}
    </section>
  )
}

/** Lo que devuelve el banco al renovar (?renovacion=aprobada | rechazada | invalida). */
function ResultadoRenovacion() {
  const [busqueda, setBusqueda] = useSearchParams()
  const r = busqueda.get('renovacion')
  if (!r) return null
  const aprobada = r === 'aprobada'
  return (
    <p
      role="status"
      className={cn(
        'm-0 flex flex-wrap items-center gap-3 rounded-xl border-2 px-4 py-3 font-bold',
        aprobada ? 'border-pagado bg-pagado-fondo text-pagado' : 'border-pagando bg-pagando-fondo text-pagando',
      )}
    >
      <span className="flex-1">
        {aprobada
          ? 'Permiso renovado: los cobros vuelven a salir.'
          : r === 'rechazada'
            ? 'No aprobaste la renovación en tu banco; puedes intentarlo de nuevo.'
            : 'No pudimos confirmar la respuesta de tu banco; intenta de nuevo.'}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setBusqueda({}, { replace: true })}>
        Cerrar
      </Button>
    </p>
  )
}

export default function Tablero({ tablero: t, error, recargar }: { tablero: DatosTablero; error: string | null; recargar: () => Promise<unknown> }) {
  const p = t.programa
  const m = p.moneda
  const [enviando, setEnviando] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const pct = porcentaje(t.cobrado, t.autorizado)
  const pausado = p.estado === 'Pausado'

  const alternarPausa = async () => {
    setEnviando(true)
    setErrorAccion(null)
    try {
      await api.post(`/programas/${p.id}/${pausado ? 'reanudar' : 'pausar'}`)
      await recargar()
    } catch (e) {
      setErrorAccion(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const miniDatos: Array<[string, string]> = [
    [textoMonto(t.giradoPorAdelantado, m), 'girado por adelantado'],
    [t.reembolsoSegundos !== null ? formatSegundos(t.reembolsoSegundos) : '—', 'reembolso al punto después del PIN'],
    p.tipo === 'bono'
      ? [String(t.porCanal.compra?.cobros ?? 0), 'pagados en comercios']
      : [`${t.porCanal.cuenta.cobros} · ${t.porCanal.retiro.cobros}`, 'pagados a cuenta · en punto'],
  ]

  return (
    <PantallaEntidad
      quien={p.entidad}
      volver={{ to: '/entidad', texto: 'Tus programas' }}
      subtitulo={`Vigencia: ${formatVigencia(p.vigenciaInicio, p.vigenciaFin, true)}`}
      titulo={p.nombre}
      junto={<ChipPrograma estado={p.estado} grande />}
      acciones={
        <>
          <Boton variante="contorno" medio onClick={() => void alternarPausa()} disabled={enviando}>
            {pausado ? <Play aria-hidden className="size-[18px]" /> : <Pause aria-hidden className="size-[18px]" />}
            {pausado ? 'Reanudar' : 'Pausar'}
          </Boton>
          <BotonEnlace variante="contorno" medio to={`/entidad/programas/${p.id}/cerrar`}>
            Cerrar programa
          </BotonEnlace>
        </>
      }
    >
      <ResultadoRenovacion />
      {p.permisoVencido && <AvisoPermisoVencido programaId={p.id} />}

      {pausado && (
        <p role="status" className="m-0 rounded-[14px] bg-pagando-fondo px-4 py-3 font-bold text-pagando">
          El programa está en pausa: los cobros nuevos se rechazan con «El programa no está recibiendo cobros».
        </p>
      )}
      <MensajeError>{errorAccion}</MensajeError>
      {error && <MensajeError>No pudimos actualizar el tablero: {error}. Lo que ves es de la última consulta.</MensajeError>}

      <div className="flex flex-wrap gap-4">
        <TarjetaCifra etiqueta="Autorizado" apoyo="Tope aprobado en tu banco">
          {textoMonto(t.autorizado, m)}
        </TarjetaCifra>
        <TarjetaCifra etiqueta="Cobrado" apoyo={t.fuente === 'banco' ? 'Leído del permiso en tu banco' : 'Calculado por la plataforma: no pudimos leer el permiso'}>
          {textoMonto(t.cobrado, m)}
        </TarjetaCifra>
        <TarjetaCifra etiqueta="Todavía no ha salido" apoyo="Sigue en la cuenta del programa" noche>
          {textoMonto(t.noHaSalido, m)}
        </TarjetaCifra>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-label="Cobrado del tope"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="flex h-3.5 overflow-hidden rounded-lg bg-pista"
        >
          <div className="bg-foreground oscuro:bg-ambar" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 text-[15px] text-muted-foreground">
          <span>Cobrado: {Math.round(pct)} % del tope</span>
          <span>Tope fijo del permiso: {textoMonto(t.autorizado, m)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {miniDatos.map(([valor, texto]) => (
          <div key={texto} className="flex flex-[1_1_220px] items-center gap-3 rounded-2xl bg-muted px-4 py-3.5">
            <span className="cifra text-[26px]">{valor}</span>
            <span className="text-[15px] leading-[1.3]">{texto}</span>
          </div>
        ))}
      </div>

      <Caja grande as="section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-cobros" className="m-0 text-[21px] font-extrabold">
            Cobros
          </h2>
          <span className="text-[15px] text-muted-foreground">Se actualiza cada 5 s · rechazados y fallidos no movieron dinero</span>
        </div>
        <TablaCobros cobros={t.cobros} />
      </Caja>
    </PantallaEntidad>
  )
}

/** Debajo del chip: «Ya cobrado», «Tope del banco», «Reembolso en 4 s», «En 3 s». */
export function detalleCobro(c: CobroResumen): string | null {
  if (c.estado === 'Pagado' && c.segundosHastaPagado !== null) {
    return c.canal === 'retiro' ? `Reembolso en ${formatSegundos(c.segundosHastaPagado)}` : `En ${formatSegundos(c.segundosHastaPagado)}`
  }
  if (c.motivo) return MOTIVO_CORTO[c.motivo.codigo] ?? c.motivo.mensaje
  return null
}

const TH = 'px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground'
const TD = 'border-t border-border px-3 py-3.5 text-left align-middle'

/** Tabla de cobros del prototipo (E3): referencia, beneficiario, canal, valor, estado, hora y «Ver». */
export function TablaCobros({ cobros }: { cobros: CobroResumen[] }) {
  return (
    <div className="relative min-w-0 overflow-x-auto">
      <table aria-labelledby="titulo-cobros" className="w-full min-w-[760px] border-collapse text-base">
        <thead>
          <tr>
            <th className={TH}>Referencia</th>
            <th className={TH}>Beneficiario</th>
            <th className={TH}>Canal</th>
            <th className={cn(TH, 'text-right')}>Valor</th>
            <th className={TH}>Estado</th>
            <th className={TH}>Hora</th>
            <th className={TH}>
              <span className="sr-only">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cobros.length === 0 && (
            <tr>
              <td colSpan={7} className={cn(TD, 'text-muted-foreground')}>
                Todavía no hay cobros aquí.
              </td>
            </tr>
          )}
          {cobros.map((c) => {
            // D-04: el rechazado lleva referencia en la BD, pero la pantalla muestra «—».
            const sinReferencia = c.estado === 'Rechazado'
            const detalle = detalleCobro(c)
            return (
              <tr key={c.id}>
                <td className={TD}>{sinReferencia ? <span className="text-muted-foreground">—</span> : <b>{c.referencia}</b>}</td>
                <td className={TD}>{personaTexto(c)}</td>
                <td className={TD}>
                  {c.canal === 'retiro' ? (
                    `Punto · ${c.punto?.nombre.split(' — ')[0] ?? '—'}`
                  ) : c.canal === 'compra' ? (
                    `Compra · ${c.punto?.nombre.split(' — ')[0] ?? '—'}`
                  ) : (
                    <>
                      Cuenta · {c.cuenta ? <BilleteraCorta url={c.cuenta.billetera} /> : '—'}
                    </>
                  )}
                </td>
                <td className={cn(TD, 'text-right')}>
                  <b className={c.estado === 'Pagado' ? undefined : 'text-muted-foreground'}>{textoMonto(c.monto, c.moneda)}</b>
                </td>
                <td className={TD}>
                  <ChipCobro estado={c.estado} />
                  {detalle && <div className="mt-1 text-sm text-muted-foreground">{detalle}</div>}
                </td>
                <td className={TD}>
                  <time dateTime={c.creado}>{formatHora(c.creado, false)}</time>
                </td>
                <td className={TD}>
                  <Link
                    to={`/entidad/cobros/${c.id}`}
                    className="inline-flex min-h-11 min-w-11 items-center font-bold"
                    aria-label={`Ver el cobro de ${personaTexto(c)} de las ${formatHora(c.creado, false)}`}
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

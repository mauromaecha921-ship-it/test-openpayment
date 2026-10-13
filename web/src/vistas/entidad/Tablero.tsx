import { CreditCard, Pause, Play, RefreshCw, ShoppingBag, Store, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { CobroResumen, Tablero as DatosTablero, Redireccion } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { CifraGrande } from '@/componentes/CifraGrande'
import { MensajeError, Tarjeta } from '@/componentes/Comun'
import { EstadoCobro } from '@/componentes/EstadoCobro'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { Progress } from '@/componentes/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs'
import { formatHora, formatSegundos, plural } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { prepararPestana } from '@/lib/ventana'

type Filtro = 'todos' | 'pagados' | 'rechazados'

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

function filtrar(cobros: CobroResumen[], filtro: Filtro) {
  if (filtro === 'pagados') return cobros.filter((c) => c.estado === 'Pagado')
  if (filtro === 'rechazados') return cobros.filter((c) => c.estado === 'Rechazado' || c.estado === 'Fallido')
  return cobros
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
  const [filtro, setFiltro] = useState<Filtro>('todos')
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

  return (
    <MarcoEntidad entidad={p.entidad}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-tenue">{p.nombre}</span>
          <div className="flex flex-wrap items-center gap-3">
            <Titulo className="text-[28px] sm:text-[32px]">Tablero</Titulo>
            <span className={cn('rounded-full px-3 py-1 text-sm font-bold', pausado ? 'border-2 border-pagando bg-pagando-fondo text-pagando' : 'bg-primary text-primary-foreground')}>
              {pausado ? 'Pausado' : 'Activo'}
            </span>
            <span className="text-sm text-tenue">Se actualiza cada 5 s</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void alternarPausa()} disabled={enviando}>
            {pausado ? <Play aria-hidden /> : <Pause aria-hidden />}
            {pausado ? 'Reanudar' : 'Pausar'}
          </Button>
          <Button asChild variant="outline" className="border-2 border-foreground">
            <Link to={`/entidad/programas/${p.id}/cerrar`}>Cerrar programa</Link>
          </Button>
        </div>
      </div>

      <ResultadoRenovacion />
      {p.permisoVencido && <AvisoPermisoVencido programaId={p.id} />}

      {pausado && (
        <p role="status" className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 font-bold text-pagando">
          El programa está en pausa: los cobros nuevos se rechazan con «El programa no está recibiendo cobros».
        </p>
      )}
      <MensajeError>{errorAccion}</MensajeError>
      {error && <MensajeError>No pudimos actualizar el tablero: {error}. Lo que ves es de la última consulta.</MensajeError>}

      <div className="flex flex-wrap gap-4">
        <CifraGrande etiqueta="Autorizado" apoyo="El tope que aprobaste en tu banco">
          {textoMonto(t.autorizado, m)}
        </CifraGrande>
        <CifraGrande
          etiqueta="Cobrado"
          apoyo={
            t.fuente === 'banco'
              ? `Leído del permiso en tu banco · ${plural(t.cobrosPagados, 'cobro')}`
              : `Calculado por la plataforma: no pudimos leer el permiso en tu banco · ${plural(t.cobrosPagados, 'cobro')}`
          }
        >
          {textoMonto(t.cobrado, m)}
        </CifraGrande>
        <CifraGrande etiqueta="Todavía no ha salido" apoyo="Sigue en la cuenta del programa" destacada azul>
          {textoMonto(t.noHaSalido, m)}
        </CifraGrande>
      </div>

      <div className="flex flex-col gap-2">
        <Progress
          value={Math.min(100, pct)}
          aria-label={`Cobrado: ${Math.round(pct)} % del tope`}
          aria-valuetext={`${Math.round(pct)} %`}
          className="h-3.5 bg-secondary"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Cobrado {Math.round(pct)} %</span>
          <span>Tope {textoMonto(t.autorizado, m)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Tarjeta className="flex-[2_1_420px] gap-3 py-5">
          <h2 className="m-0 text-lg font-bold">Cobros por canal</h2>
          <div className="flex flex-wrap gap-3">
            {(p.tipo === 'bono'
              ? // § 11: un bono solo se usa en compras de comercios autorizados
                ([['En comercios', ShoppingBag, t.porCanal.compra ?? { cobros: 0, monto: '0' }]] as const)
              : ([
                  ['A la cuenta', CreditCard, t.porCanal.cuenta],
                  ['En un punto', Store, t.porCanal.retiro],
                ] as const)
            ).map(([nombre, Icono, d]) => (
              <div key={nombre} className="flex flex-[1_1_180px] items-center gap-3 rounded-[10px] border border-border px-3.5 py-3">
                <Icono aria-hidden className="size-[22px]" />
                <div className="flex flex-col">
                  <strong>{nombre}</strong>
                  <span className="text-sm text-muted-foreground">
                    {plural(d.cobros, 'cobro')} · {textoMonto(d.monto, m)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
        <Tarjeta className="flex-[1_1_300px] justify-center gap-2 py-5 text-[15px]">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Reembolso al punto</span>
            <strong>{t.reembolsoSegundos !== null ? `${formatSegundos(t.reembolsoSegundos)} tras el PIN` : '—'}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Plata girada por adelantado</span>
            <strong>{textoMonto(t.giradoPorAdelantado, m)}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Sin cobrar todavía</span>
            <strong>{t.sinCobrar ? plural(t.sinCobrar.cedulas, 'cédula') : '—'}</strong>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta className="gap-3.5 py-5">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)} className="gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold" id="titulo-cobros">
            Cobros
          </h2>
            <TabsList aria-label="Mostrar" className="h-auto flex-wrap group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="todos" className="min-h-11 px-3 text-sm text-muted-foreground">
                Todos ({t.cobros.length})
              </TabsTrigger>
              <TabsTrigger value="pagados" className="min-h-11 px-3 text-sm text-muted-foreground">
                Pagados ({t.cobrosPagados})
              </TabsTrigger>
              <TabsTrigger value="rechazados" className="min-h-11 px-3 text-sm text-muted-foreground">
                Rechazados y fallidos ({t.rechazadosYFallidos})
              </TabsTrigger>
            </TabsList>
        </div>
        {(['todos', 'pagados', 'rechazados'] as const).map((f) => (
          <TabsContent key={f} value={f}>
            <TablaCobros cobros={filtrar(t.cobros, f)} />
          </TabsContent>
        ))}
        </Tabs>
      </Tarjeta>
    </MarcoEntidad>
  )
}

export function TablaCobros({ cobros }: { cobros: CobroResumen[] }) {
  return (
    <Table aria-labelledby="titulo-cobros" className="min-w-[860px] text-[15px]">
      <TableHeader>
        <TableRow className="border-b-2 border-foreground hover:bg-transparent">
          {['Referencia', 'Persona', 'Canal', 'Dónde'].map((h) => (
            <TableHead key={h} className="px-2 font-bold text-foreground">
              {h}
            </TableHead>
          ))}
          <TableHead className="px-2 text-right font-bold text-foreground">Monto</TableHead>
          <TableHead className="px-2 font-bold text-foreground">Estado</TableHead>
          <TableHead className="px-2 font-bold text-foreground">Hora</TableHead>
          <TableHead className="px-2">
            <span className="sr-only">Detalle</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cobros.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="px-2 py-4 text-tenue">
              Todavía no hay cobros aquí.
            </TableCell>
          </TableRow>
        )}
        {cobros.map((c) => {
          // D-04: el rechazado lleva referencia en la BD, pero la pantalla muestra «—».
          const sinReferencia = c.estado === 'Rechazado'
          return (
            <TableRow key={c.id}>
              <TableCell className={cn('px-2 py-3', sinReferencia ? 'text-tenue' : 'mono text-sm')}>{sinReferencia ? '—' : c.referencia}</TableCell>
              <TableCell className="px-2 py-3 whitespace-normal">{personaTexto(c)}</TableCell>
              <TableCell className="px-2 py-3">{c.canal === 'cuenta' ? 'Cuenta' : c.canal === 'compra' ? 'Compra' : 'Punto'}</TableCell>
              <TableCell className="px-2 py-3">
                {c.canal === 'retiro' ? (c.punto?.nombre.split(' — ')[0] ?? '—') : c.cuenta ? <BilleteraCorta url={c.cuenta.billetera} className="text-[13px]" /> : '—'}
              </TableCell>
              <TableCell className="px-2 py-3 text-right">{textoMonto(c.monto, c.moneda)}</TableCell>
              <TableCell className="px-2 py-3">
                <EstadoCobro estado={c.estado} motivo={c.motivo} />
              </TableCell>
              <TableCell className="px-2 py-3 text-muted-foreground">
                <time dateTime={c.creado}>{formatHora(c.creado, false)}</time>
              </TableCell>
              <TableCell className="px-2 py-3">
                <Link to={`/entidad/cobros/${c.id}`} className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-label={`Ver el cobro de ${personaTexto(c)} de las ${formatHora(c.creado, false)}`}>
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

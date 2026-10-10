import { Check, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import { resolverBilletera, type EstadoBilletera } from '@/api/billeteras'
import { api, mensajeDeError } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Billetera, Liquidacion, Programa, ProgramaEntrada, Punto } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { Cargando, ErrorCarga, MensajeError, Pastilla, Tarjeta } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { PasosPrograma } from '@/componentes/PasosPrograma'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { RadioGroup, RadioGroupItem } from '@/componentes/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { useRol } from '@/contexto/Rol'
import { aPesos } from '@/lib/montos'
import { rutaDelPrograma } from '@/lib/pantallas'
import { cn } from '@/lib/utils'

function hoyIso() {
  const f = new Date()
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

const FORM_INICIAL: ProgramaEntrada = {
  nombre: 'Pagos de prueba del equipo',
  entidad: 'Entidad de prueba',
  tipo: 'subsidio',
  billetera: '',
  vigenciaInicio: hoyIso(),
  vigenciaFin: `${new Date().getFullYear()}-12-31`,
  // Poco, para no gastar el saldo de prueba de quien paga
  montoPorPersona: '10000',
}

const MONTO_VALIDO = /^\d+(\.\d+)?$/

const resolver = resolverBilletera

export default function ConectarPrograma() {
  const { id } = useParams()
  const navegar = useNavigate()
  const rol = useRol()
  const config = useConfig()

  const [cargado, setCargado] = useState(!id)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [redirigir, setRedirigir] = useState<string | null>(null)
  const [form, setForm] = useState<ProgramaEntrada>(FORM_INICIAL)
  const [billetera, setBilletera] = useState<EstadoBilletera>({ estado: 'vacia' })
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Al editar, se carga el borrador; cualquier otro estado tiene su propia pantalla.
  useEffect(() => {
    let vivo = true
    void api.get<Punto[]>('/puntos').then((p) => vivo && setPuntos(p)).catch(() => undefined)
    if (!id) return
    ;(async () => {
      try {
        const p = await api.get<Programa>(`/programas/${id}`)
        if (!vivo) return
        if (p.estado !== 'Borrador') {
          setRedirigir(rutaDelPrograma(p.id, p.estado))
          return
        }
        rol.actualizar({ rol: 'entidad', programaId: p.id })
        setForm({
          nombre: p.nombre,
          entidad: p.entidad,
          tipo: p.tipo,
          billetera: p.billetera,
          vigenciaInicio: p.vigenciaInicio,
          vigenciaFin: p.vigenciaFin,
          montoPorPersona: aPesos(p.montoPorPersona, p.moneda.escala),
        })
        setBilletera({ estado: 'encontrada', billetera: { id: p.billetera, moneda: p.moneda } })
        setLiquidacion(await api.get<Liquidacion>(`/programas/${id}/liquidacion`))
      } catch (e) {
        if (vivo) setErrorCarga(mensajeDeError(e))
      } finally {
        if (vivo) setCargado(true)
      }
    })()
    return () => {
      vivo = false
    }
  }, [id])

  const cambiar = <K extends keyof ProgramaEntrada>(k: K, v: ProgramaEntrada[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setAviso(null)
    // Otro monto da otro total: hay que volver a calcularlo antes de aprobar
    if (k === 'montoPorPersona') setLiquidacion(null)
  }

  const validarBilletera = async () => {
    if (!form.billetera.trim()) return setBilletera({ estado: 'vacia' })
    setBilletera({ estado: 'buscando' })
    setBilletera(await resolver(form.billetera))
  }

  const problema = (): string | null => {
    if (!form.nombre.trim() || !form.entidad.trim()) return 'Escribe el nombre del programa y de la entidad.'
    if (!form.vigenciaInicio || !form.vigenciaFin) return 'Escribe las fechas de la vigencia.'
    if (form.vigenciaFin < form.vigenciaInicio) return 'La vigencia termina antes de empezar.'
    if (billetera.estado !== 'encontrada') return 'Escribe la wallet del programa y espera a que aparezca «Cuenta encontrada».'
    const monto = form.montoPorPersona?.trim() ?? ''
    if (!MONTO_VALIDO.test(monto) || !/[1-9]/.test(monto)) return 'Escribe el monto por persona en pesos, sin puntos de miles (por ejemplo, 10000).'
    return null
  }

  /** Crea o actualiza el borrador y devuelve su id. */
  const guardar = async (): Promise<string | null> => {
    const p = problema()
    if (p) {
      setError(p)
      return null
    }
    setError(null)
    setGuardando(true)
    try {
      const programa = id
        ? await api.patch<Programa>(`/programas/${id}`, form)
        : await api.post<Programa>('/programas', form)
      rol.actualizar({ rol: 'entidad', programaId: programa.id })
      return programa.id
    } catch (e) {
      setError(mensajeDeError(e))
      return null
    } finally {
      setGuardando(false)
    }
  }

  const conectarLiquidacion = async () => {
    const programaId = await guardar()
    if (!programaId) return
    try {
      setLiquidacion(await api.get<Liquidacion>(`/programas/${programaId}/liquidacion`))
      if (!id) navegar(`/entidad/programas/${programaId}/editar`, { replace: true })
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  const guardarBorrador = async () => {
    const programaId = await guardar()
    if (!programaId) return
    setAviso('Borrador guardado. Todavía no se mueve dinero.')
    if (!id) navegar(`/entidad/programas/${programaId}/editar`, { replace: true })
  }

  const guardarYSeguir = async () => {
    if (!liquidacion) {
      setError('Calcula el total de las personas registradas: será el tope del permiso.')
      return
    }
    if (liquidacion.cedulas === 0) {
      setError('Todavía no hay personas registradas. Regístralas en «Equipo de prueba» y vuelve a calcular.')
      return
    }
    const programaId = await guardar()
    if (programaId) navegar(`/entidad/programas/${programaId}/aprobar`)
  }

  if (redirigir) return <Navigate to={redirigir} replace />

  const moneda = billetera.estado === 'encontrada' ? billetera.billetera.moneda : null

  return (
    <MarcoEntidad entidad={form.entidad || undefined}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-tenue">{id ? 'Borrador' : 'Nuevo programa'}</span>
          <Titulo className="text-[28px] sm:text-[32px]">Conecta tu subsidio</Titulo>
        </div>
        <PasosPrograma estado="Borrador" />
      </div>

      {errorCarga && <ErrorCarga mensaje={errorCarga} reintentar={() => location.reload()} />}
      {!cargado && <Cargando />}

      {cargado && !errorCarga && (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            <Tarjeta>
              <h2 className="m-0 text-xl font-bold">1. Datos del programa</h2>
              <div className="flex flex-wrap gap-4">
                <Campo className="flex-[1_1_260px]" etiqueta="Nombre del programa" value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                <Campo className="flex-[1_1_260px]" etiqueta="Entidad" value={form.entidad} onChange={(e) => cambiar('entidad', e.target.value)} />
              </div>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-sm font-bold">Tipo</legend>
                <RadioGroup value={form.tipo} onValueChange={(v) => cambiar('tipo', v as ProgramaEntrada['tipo'])} className="flex flex-wrap gap-3">
                  <label htmlFor="tipo-subsidio" className={cn('flex flex-[1_1_240px] items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[15px]', form.tipo === 'subsidio' ? 'border-2 border-foreground' : 'border border-control')}>
                    <RadioGroupItem id="tipo-subsidio" value="subsidio" className="mt-0.5 size-5" />
                    <span className="flex flex-col gap-0.5">
                      <strong>Subsidio</strong>
                      <span className="text-muted-foreground">Destino libre: a la cuenta o retiro en un punto</span>
                    </span>
                  </label>
                  <label
                    htmlFor="tipo-bono"
                    className={cn(
                      'flex flex-[1_1_240px] items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[15px]',
                      config.extras.bono ? (form.tipo === 'bono' ? 'border-2 border-foreground' : 'border border-control') : 'border border-dashed border-control text-tenue',
                    )}
                  >
                    <RadioGroupItem id="tipo-bono" value="bono" disabled={!config.extras.bono} className="mt-0.5 size-5" />
                    <span className="flex flex-col gap-0.5">
                      <strong>Bono con destino</strong>
                      <span>Solo en comercios autorizados · extra{!config.extras.bono && ' (apagado)'}</span>
                    </span>
                  </label>
                </RadioGroup>
              </fieldset>
              <div className="flex flex-wrap gap-4">
                <Campo className="flex-[1_1_200px]" etiqueta="Vigencia: inicio" type="date" value={form.vigenciaInicio} onChange={(e) => cambiar('vigenciaInicio', e.target.value)} />
                <Campo className="flex-[1_1_200px]" etiqueta="Vigencia: fin" type="date" value={form.vigenciaFin} min={form.vigenciaInicio} onChange={(e) => cambiar('vigenciaFin', e.target.value)} />
              </div>
            </Tarjeta>

            <Tarjeta className="gap-3">
              <h2 className="m-0 text-xl font-bold">2. Cuenta del programa</h2>
              <Campo
                etiqueta="Dirección de la wallet del programa"
                mono
                placeholder="$ilp.interledger-test.dev/…"
                value={form.billetera}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  cambiar('billetera', e.target.value)
                  setBilletera({ estado: 'vacia' })
                }}
                onBlur={() => void validarBilletera()}
                ayuda="La wallet de quien paga, con saldo de prueba. Si empieza con $ la convertimos a https://."
              />
              <div aria-live="polite">
                {billetera.estado === 'buscando' && <p className="m-0 text-sm text-muted-foreground">Buscando la cuenta…</p>}
                {billetera.estado === 'encontrada' && (
                  <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <Check aria-hidden className="size-[18px] text-pagado" strokeWidth={2.5} />
                    <span className="font-bold">Cuenta encontrada</span>
                    <BilleteraCorta url={billetera.billetera.id} completa className="text-muted-foreground" />
                    <Pastilla className="ml-auto">
                      Moneda: {billetera.billetera.moneda.codigo} · escala {billetera.billetera.moneda.escala}
                    </Pastilla>
                  </div>
                )}
                {billetera.estado === 'noEncontrada' && <MensajeError>{billetera.mensaje}</MensajeError>}
              </div>
            </Tarjeta>

            <Tarjeta className="gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-xl font-bold">3. Personas y monto</h2>
                <Link to="/equipo" className="inline-flex min-h-11 items-center text-[15px]">
                  Registrar personas
                </Link>
              </div>
              <p className="m-0 text-[15px] text-muted-foreground">
                Cada persona registrada en «Equipo de prueba» recibe este monto en su wallet. Regístrenlas antes de aprobar: quien llegue
                después queda por fuera del tope y el banco puede rechazar su cobro.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Campo
                  className="flex-[1_1_200px]"
                  etiqueta={`Monto por persona${moneda ? ` (${moneda.codigo})` : ''}`}
                  inputMode="decimal"
                  placeholder="10000"
                  value={form.montoPorPersona ?? ''}
                  onChange={(e) => cambiar('montoPorPersona', e.target.value.replace(/[^\d.]/g, ''))}
                  ayuda="En pesos, sin puntos de miles."
                />
                <Button variant="outline" className="mb-7 border-foreground" onClick={() => void conectarLiquidacion()} disabled={guardando}>
                  {liquidacion ? 'Volver a calcular' : 'Calcular total'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3" aria-live="polite">
                <div className="flex flex-[1_1_180px] flex-col gap-0.5 rounded-[10px] border border-border px-4 py-3.5">
                  <span className="text-sm text-tenue">Personas registradas</span>
                  <span className="text-[28px] font-bold">{liquidacion ? liquidacion.cedulas : '—'}</span>
                </div>
                <div className="flex flex-[1_1_180px] flex-col gap-0.5 rounded-[10px] border border-border px-4 py-3.5">
                  <span className="text-sm text-tenue">Total a pagar</span>
                  <span className="text-[28px] font-bold">{liquidacion ? textoMonto(liquidacion.total, liquidacion.moneda) : '—'}</span>
                </div>
                <div className="flex flex-[2_1_260px] items-center rounded-[10px] border border-dashed border-control px-4 py-3.5 text-[15px] text-muted-foreground">
                  Este total será el tope del permiso que apruebas en tu banco.
                </div>
              </div>
            </Tarjeta>

            <SeccionPuntos programaId={id ?? null} moneda={moneda} puntos={puntos} alAgregar={(p) => setPuntos((l) => [...l, p])} />
          </div>

          <Tarjeta as="aside" className="flex-[1_1_300px]" aria-labelledby="titulo-resumen">
            <h2 id="titulo-resumen" className="m-0 text-xl font-bold">
              Resumen
            </h2>
            <Pastilla>Borrador</Pastilla>
            <p className="m-0 text-[15px] text-muted-foreground">Todavía no se mueve dinero.</p>
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[15px]">
              <dt className="text-tenue">Tope del permiso</dt>
              <dd className="m-0 text-right font-bold">{liquidacion ? textoMonto(liquidacion.total, liquidacion.moneda) : '—'}</dd>
              <dt className="text-tenue">Personas</dt>
              <dd className="m-0 text-right">{liquidacion?.cedulas ?? '—'}</dd>
              <dt className="text-tenue">Canales</dt>
              <dd className="m-0 text-right">Cuenta y punto</dd>
              <dt className="text-tenue">Puntos</dt>
              <dd className="m-0 text-right">{puntos.length}</dd>
            </dl>
            <MensajeError>{error}</MensajeError>
            {aviso && (
              <p role="status" className="m-0 text-[15px] font-bold text-pagado">
                {aviso}
              </p>
            )}
            <Button size="lg" onClick={() => void guardarYSeguir()} disabled={guardando}>
              Guardar y seguir
            </Button>
            <Button variant="outline" onClick={() => void guardarBorrador()} disabled={guardando}>
              Guardar borrador
            </Button>
          </Tarjeta>
        </div>
      )}
    </MarcoEntidad>
  )
}

function SeccionPuntos({
  programaId,
  moneda,
  puntos,
  alAgregar,
}: {
  programaId: string | null
  moneda: Billetera['moneda'] | null
  puntos: Punto[]
  alAgregar: (p: Punto) => void
}) {
  const [nuevo, setNuevo] = useState({ nombre: '', direccion: '', billetera: '' })
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const agregar = async () => {
    setOk(null)
    if (!nuevo.nombre.trim() || !nuevo.billetera.trim()) return setError('Escribe el nombre y la wallet del punto.')
    setEnviando(true)
    setError(null)
    try {
      // HU-03: la moneda del punto tiene que ser la del programa. La API también lo revisa.
      const w = await resolver(nuevo.billetera)
      if (w.estado !== 'encontrada') return setError(w.estado === 'noEncontrada' ? w.mensaje : 'No encontramos esa cuenta')
      if (moneda && w.billetera.moneda.codigo !== moneda.codigo) {
        return setError(`La wallet del punto usa ${w.billetera.moneda.codigo} y el programa usa ${moneda.codigo}: no se guardó.`)
      }
      const p = await api.post<Punto>('/puntos', { ...nuevo, programaId: programaId ?? undefined })
      alAgregar(p)
      setNuevo({ nombre: '', direccion: '', billetera: '' })
      setOk(`Agregamos «${p.nombre}».`)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta className="gap-3.5">
      <h2 className="m-0 text-xl font-bold">4. Puntos de retiro</h2>
      <div className="rounded-lg border border-border">
        <Table className="min-w-[620px] text-sm">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="px-3 font-bold text-foreground">Nombre</TableHead>
              <TableHead className="px-3 font-bold text-foreground">Dirección</TableHead>
              <TableHead className="px-3 font-bold text-foreground">Wallet</TableHead>
              <TableHead className="px-3 font-bold text-foreground">Moneda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {puntos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="px-3 py-3 text-tenue">
                  Todavía no hay puntos.
                </TableCell>
              </TableRow>
            )}
            {puntos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="px-3 py-2.5 font-bold whitespace-normal">{p.nombre}</TableCell>
                <TableCell className="px-3 py-2.5 whitespace-normal text-muted-foreground">{p.direccion || '—'}</TableCell>
                <TableCell className="px-3 py-2.5">
                  <BilleteraCorta url={p.billetera} completa className="text-[13px]" />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {!p.moneda ? (moneda ? 'Igual al programa' : '—') : !moneda ? p.moneda.codigo : p.moneda.codigo === moneda.codigo ? 'Igual al programa' : (
                    <span className="inline-flex items-center gap-1 font-bold text-rechazo">
                      <TriangleAlert aria-hidden className="size-4" /> {p.moneda.codigo}: distinta
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Campo className="flex-[1_1_160px]" etiqueta="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Campo className="flex-[1_1_160px]" etiqueta="Dirección (opcional)" value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
        <Campo
          className="flex-[2_1_220px]"
          etiqueta="Wallet del punto"
          mono
          placeholder="$ilp.interledger-test.dev/…"
          spellCheck={false}
          value={nuevo.billetera}
          onChange={(e) => setNuevo({ ...nuevo, billetera: e.target.value })}
        />
        <Button variant="outline" className="border-foreground" onClick={() => void agregar()} disabled={enviando}>
          Agregar punto
        </Button>
      </div>
      <MensajeError>{error}</MensajeError>
      {ok && (
        <p role="status" className="m-0 text-[15px] font-bold text-pagado">
          {ok}
        </p>
      )}
      <p className="m-0 text-sm text-tenue">La wallet del punto debe usar la misma moneda del programa; si no, no se guarda.</p>
    </Tarjeta>
  )
}

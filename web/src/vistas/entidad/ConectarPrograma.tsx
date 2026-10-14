import { Check, Store, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { resolverBilletera, type EstadoBilletera } from '@/api/billeteras'
import { api, mensajeDeError } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Billetera, Categoria, Comercio, Liquidacion, Programa, ProgramaEntrada, Punto } from '@/api/tipos'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Campo } from '@/componentes/Campo'
import { Cargando, ErrorCarga, MensajeError } from '@/componentes/Comun'
import { PantallaEntidad } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import { Boton, Caja, claseEnlaceSuave, FilaDato } from '@/componentes/Proto'
import { RadioGroup, RadioGroupItem } from '@/componentes/ui/radio-group'
import { useRol } from '@/contexto/Rol'
import { aPesos } from '@/lib/montos'
import { rutaDelPrograma } from '@/lib/pantallas'
import { plural } from '@/lib/textos'
import { cn } from '@/lib/utils'

import { ChipPrograma } from './TusProgramas'

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

// Registrar personas o comercios lleva a «Equipo de prueba» y de ahí se vuelve aquí. Lo escrito y sin
// guardar se deja en sessionStorage (misma pestaña) y se recupera al volver, también con «Atrás».
const CLAVE_PENDIENTE = 'tatu.programa-pendiente'

function guardarPendiente(clave: string, form: ProgramaEntrada) {
  try {
    sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ clave, form }))
  } catch {
    // Sin almacenamiento: al volver se ve lo último guardado
  }
}

function leerPendiente(clave: string): ProgramaEntrada | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_PENDIENTE)
    if (!crudo) return null
    const p = JSON.parse(crudo) as { clave: string; form: ProgramaEntrada }
    return p.clave === clave ? p.form : null
  } catch {
    return null
  }
}

function borrarPendiente() {
  try {
    sessionStorage.removeItem(CLAVE_PENDIENTE)
  } catch {
    // nada que borrar
  }
}

/** A «Equipo de prueba», con la ruta para volver a terminar el programa. */
function rutaEquipo(volver: string, seccion: 'personas' | 'comercios') {
  // Las personas se registran arriba, junto al aviso; los comercios están más abajo
  return `/equipo?volver=${encodeURIComponent(volver)}${seccion === 'comercios' ? '#titulo-comercios' : ''}`
}

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
  // § 11: para un bono, las categorías y los comercios que las tienen
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [comercios, setComercios] = useState<Comercio[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // § 11: las categorías y los comercios, solo si los bonos están prendidos (EXTRA_BONO)
  useEffect(() => {
    if (!config.extras.bono) return
    let vivo = true
    void api.get<Categoria[]>('/categorias').then((c) => vivo && setCategorias(c)).catch(() => undefined)
    void api.get<Comercio[]>('/comercios').then((c) => vivo && setComercios(c)).catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [config.extras.bono])

  // Al editar, se carga el borrador; cualquier otro estado tiene su propia pantalla. Si se fue a
  // registrar personas sin guardar, lo que había escrito vuelve encima.
  useEffect(() => {
    let vivo = true
    void api.get<Punto[]>('/puntos').then((p) => vivo && setPuntos(p.filter((x) => x.tipo !== 'compra'))).catch(() => undefined)
    const pendiente = leerPendiente(id ?? 'nuevo')
    // Se borra al aplicarlo, no al leerlo: si el efecto se corta (otra carga), sigue ahí
    const recuperar = async (f: ProgramaEntrada) => {
      setForm(f)
      borrarPendiente()
      setAviso('Volviste del equipo de prueba: recuperamos lo que tenías escrito. Si registraste personas, calcula el total otra vez.')
      if (f.billetera.trim()) {
        setBilletera({ estado: 'buscando' })
        const b = await resolver(f.billetera)
        if (vivo) setBilletera(b)
      }
    }
    if (!id) {
      if (pendiente) void recuperar(pendiente)
      return
    }
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
          categorias: p.categorias ?? [],
        })
        setBilletera({ estado: 'encontrada', billetera: { id: p.billetera, moneda: p.moneda } })
        // Siempre se pide de nuevo: si registró personas en el equipo, el total cambió
        const l = await api.get<Liquidacion>(`/programas/${id}/liquidacion`)
        if (!vivo) return
        if (pendiente) {
          await recuperar(pendiente)
          // Con otro monto, el total del servidor ya no sirve
          if (pendiente.montoPorPersona === aPesos(p.montoPorPersona, p.moneda.escala)) setLiquidacion(l)
        } else {
          setLiquidacion(l)
        }
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
    if (form.tipo === 'bono' && !form.categorias?.length) return 'Elige al menos una categoría de comercio que acepte el bono.'
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

  /** Guarda lo escrito y va a registrar; «Volver» en el equipo trae de vuelta aquí. */
  const irAlEquipo = (seccion: 'personas' | 'comercios') => {
    guardarPendiente(id ?? 'nuevo', form)
    navegar(rutaEquipo(id ? `/entidad/programas/${id}/editar` : '/entidad/programas/nuevo', seccion))
  }

  if (redirigir) return <Navigate to={redirigir} replace />

  const moneda = billetera.estado === 'encontrada' ? billetera.billetera.moneda : null

  return (
    <PantallaEntidad
      quien={form.entidad || undefined}
      volver={{ to: '/entidad', texto: 'Tus programas' }}
      subtitulo={id ? 'Borrador' : 'Nuevo programa'}
      titulo="Conecta tu programa"
    >
      {errorCarga && <ErrorCarga mensaje={errorCarga} reintentar={() => location.reload()} />}
      {!cargado && <Cargando />}

      {cargado && !errorCarga && (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            <Caja grande as="section">
              <TituloSeccion n={1}>Datos del programa</TituloSeccion>
              <div className="flex flex-wrap gap-3.5">
                <Campo proto="escritorio" className="min-w-[200px] flex-[1_1_100%]" etiqueta="Entidad" value={form.entidad} onChange={(e) => cambiar('entidad', e.target.value)} />
                <Campo proto="escritorio" className="min-w-[200px] flex-[1_1_100%]" etiqueta="Nombre del programa" value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                <Campo proto="escritorio" className="min-w-[200px] flex-[1_1_40%]" etiqueta="Inicio de la vigencia" type="date" value={form.vigenciaInicio} onChange={(e) => cambiar('vigenciaInicio', e.target.value)} />
                <Campo
                  proto="escritorio"
                  className="min-w-[200px] flex-[1_1_40%]"
                  etiqueta="Fin de la vigencia"
                  type="date"
                  value={form.vigenciaFin}
                  min={form.vigenciaInicio}
                  onChange={(e) => cambiar('vigenciaFin', e.target.value)}
                />
                <Campo
                  proto="escritorio"
                  className="min-w-[200px] flex-[1_1_100%]"
                  etiqueta="Cuenta del programa (wallet)"
                  placeholder="$ilp.interledger-test.dev/…"
                  value={form.billetera}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    cambiar('billetera', e.target.value)
                    setBilletera({ estado: 'vacia' })
                  }}
                  onBlur={() => void validarBilletera()}
                  ayuda="La wallet de quien paga, con saldo de prueba."
                />
              </div>
              <div aria-live="polite">
                {billetera.estado === 'buscando' && <p className="m-0 text-[15px] text-muted-foreground">Buscando la cuenta…</p>}
                {billetera.estado === 'encontrada' && (
                  <div className="inline-flex flex-wrap items-center gap-2 text-[15px] font-semibold text-azul">
                    <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
                    Cuenta encontrada · {nombreMoneda(billetera.billetera.moneda)}, escala {billetera.billetera.moneda.escala}
                  </div>
                )}
                {billetera.estado === 'noEncontrada' && <MensajeError>{billetera.mensaje}</MensajeError>}
              </div>
              {config.extras.bono ? (
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 p-0 text-[15px] font-bold">Tipo</legend>
                  <RadioGroup value={form.tipo} onValueChange={(v) => cambiar('tipo', v as ProgramaEntrada['tipo'])} className="flex flex-wrap gap-3">
                    {TIPOS.map(([valor, nombre, texto]) => (
                      <label
                        key={valor}
                        htmlFor={`tipo-${valor}`}
                        className={cn(
                          'flex flex-[1_1_240px] items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[15px]',
                          form.tipo === valor ? 'border-2 border-foreground' : 'border-[1.5px] border-border',
                        )}
                      >
                        <RadioGroupItem id={`tipo-${valor}`} value={valor} className="mt-0.5 size-5" />
                        <span className="flex flex-col gap-0.5">
                          <strong>{nombre}</strong>
                          <span className="text-muted-foreground">{texto}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              ) : (
                <span className="text-[15px] text-muted-foreground">Tipo: subsidio de destino libre. Se cobra a una cuenta verificada o en un punto de retiro.</span>
              )}
            </Caja>

            <Caja grande as="section">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TituloSeccion n={2}>Liquidación</TituloSeccion>
                <button type="button" onClick={() => irAlEquipo('personas')} className={CLASE_ENLACE_AZUL}>
                  Registrar personas
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Campo
                  proto="escritorio"
                  className="flex-[1_1_220px]"
                  etiqueta={`${form.tipo === 'bono' ? 'Valor del bono por persona' : 'Monto por persona'}${moneda ? ` (${moneda.codigo})` : ''}`}
                  inputMode="decimal"
                  placeholder="10000"
                  value={form.montoPorPersona ?? ''}
                  onChange={(e) => cambiar('montoPorPersona', e.target.value.replace(/[^\d.]/g, ''))}
                  ayuda="En pesos, sin puntos de miles."
                />
                <Boton variante="contorno" medio className="mb-[26px]" onClick={() => void conectarLiquidacion()} disabled={guardando}>
                  {liquidacion ? 'Volver a calcular' : 'Calcular total'}
                </Boton>
              </div>
              <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1" aria-live="polite">
                <div className="rounded-[14px] bg-background p-4">
                  <div className="text-[15px] text-muted-foreground">Cédulas con pago</div>
                  <div className="cifra text-[30px]">{liquidacion ? liquidacion.cedulas : '—'}</div>
                </div>
                <div className="rounded-[14px] bg-background p-4">
                  <div className="text-[15px] text-muted-foreground">Total liquidado · será el tope del permiso</div>
                  <div className="cifra text-[30px] [overflow-wrap:anywhere]">{liquidacion ? textoMonto(liquidacion.total, liquidacion.moneda) : '—'}</div>
                </div>
              </div>
              <span className="text-[15px] leading-[1.45] text-muted-foreground">
                Cada persona registrada en «Equipo de prueba» recibe este monto. Regístrenlas antes de aprobar: quien llegue después queda
                por fuera del tope y el banco puede rechazar su cobro.
              </span>
            </Caja>

            {form.tipo === 'bono' ? (
              <SeccionCategorias
                categorias={categorias}
                comercios={comercios}
                elegidas={form.categorias ?? []}
                cambiar={(c) => cambiar('categorias', c)}
                irAlEquipo={() => irAlEquipo('comercios')}
              />
            ) : (
              <SeccionPuntos programaId={id ?? null} moneda={moneda} puntos={puntos} alAgregar={(p) => setPuntos((l) => [...l, p])} />
            )}
          </div>

          <Caja grande as="section" className="flex-[1_1_280px]">
            <h2 className="sr-only">Resumen</h2>
            <span className="text-[15px] text-muted-foreground">Estado</span>
            <ChipPrograma estado="Borrador" grande />
            <span className="text-base leading-[1.4]">Todavía no se mueve dinero.</span>
            <div aria-hidden className="h-px bg-border" />
            <FilaDato etiqueta="Tope del permiso">{liquidacion ? textoMonto(liquidacion.total, liquidacion.moneda) : '—'}</FilaDato>
            <FilaDato etiqueta="Beneficiarios">{liquidacion?.cedulas ?? '—'}</FilaDato>
            <FilaDato etiqueta="Canales">{form.tipo === 'bono' ? 'Compra en comercios' : 'Cuenta y punto'}</FilaDato>
            <FilaDato etiqueta={form.tipo === 'bono' ? 'Categorías' : 'Puntos'}>{form.tipo === 'bono' ? (form.categorias?.length ?? 0) : puntos.length}</FilaDato>
            <MensajeError>{error}</MensajeError>
            {aviso && (
              <p role="status" className="m-0 text-[15px] font-bold text-pagado">
                {aviso}
              </p>
            )}
            <Boton medio className="w-full" onClick={() => void guardarYSeguir()} disabled={guardando}>
              Guardar y continuar
            </Boton>
            <button type="button" onClick={() => void guardarBorrador()} disabled={guardando} className={cn(claseEnlaceSuave(), 'border-0 bg-transparent text-base')}>
              Guardar borrador
            </button>
          </Caja>
        </div>
      )}
    </PantallaEntidad>
  )
}

const TIPOS = [
  ['subsidio', 'Subsidio', 'Destino libre: a una cuenta verificada o en un punto de retiro'],
  ['bono', 'Bono con destino', 'Solo en comercios autorizados · extra'],
] as const

const CLASE_ENLACE_AZUL = 'min-h-11 border-0 bg-transparent p-0 text-base font-bold text-azul underline underline-offset-[3px]'

function nombreMoneda(m: Billetera['moneda']) {
  return m.codigo === 'COP' ? 'pesos de prueba (COP)' : m.codigo
}

/** «① Datos del programa»: el número en círculo Noche y el título de la sección. */
function TituloSeccion({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-full bg-foreground font-extrabold text-background">
        {n}
      </span>
      <h2 className="m-0 text-[21px] font-extrabold">{children}</h2>
    </div>
  )
}

/** § 11: un bono no se cobra en puntos de retiro: lo aceptan los comercios verificados de sus categorías. */
function SeccionCategorias({
  categorias,
  comercios,
  elegidas,
  cambiar,
  irAlEquipo,
}: {
  categorias: Categoria[]
  comercios: Comercio[]
  elegidas: string[]
  cambiar: (c: string[]) => void
  irAlEquipo: () => void
}) {
  const sedesVerificadas = (categoria: string) =>
    comercios.filter((c) => c.categoria === categoria && c.verificado).reduce((n, c) => n + c.sedes.length, 0)
  return (
    <Caja grande as="section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloSeccion n={3}>Dónde se usa el bono</TituloSeccion>
        <button type="button" onClick={irAlEquipo} className={CLASE_ENLACE_AZUL}>
          Registrar comercios
        </button>
      </div>
      <p className="m-0 text-[15px] text-muted-foreground">
        El bono no se cobra en efectivo ni a la cuenta: se usa como parte del pago de una compra. Lo aceptan las sedes de comercios
        verificados (con el RUT y el RUES) cuya actividad está en las categorías que elijas.
      </p>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="sr-only">Categorías que aceptan el bono</legend>
        {categorias.map((c) => {
          const marcada = elegidas.includes(c.id)
          const sedes = sedesVerificadas(c.id)
          return (
            <label
              key={c.id}
              className={cn('flex items-start gap-3 rounded-[14px] px-3.5 py-3 text-[15px]', marcada ? 'border-2 border-foreground' : 'border-[1.5px] border-border')}
            >
              <input
                type="checkbox"
                className="mt-1 size-5 accent-foreground"
                checked={marcada}
                onChange={(e) => cambiar(e.target.checked ? [...elegidas, c.id] : elegidas.filter((x) => x !== c.id))}
              />
              <span className="flex flex-col gap-0.5">
                <strong>{c.nombre}</strong>
                <span className="text-muted-foreground">{c.actividades.map((a) => a.nombre).join(' · ')}</span>
                <span className={cn('text-sm', sedes ? 'text-pagado' : 'text-muted-foreground')}>
                  {sedes ? `${sedes} ${sedes === 1 ? 'sede verificada' : 'sedes verificadas'}` : 'Todavía no hay comercios verificados en esta categoría'}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>
    </Caja>
  )
}

/** Prototipo: «③ Puntos de retiro», con el resumen y «Gestionar puntos» (abre la lista y el alta). */
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
  const [abierta, setAbierta] = useState(false)
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

  const nombres = puntos.map((p) => p.nombre.split(' — ')[0]).join(', ')
  const monedaDistinta = (p: Punto) => moneda && p.moneda && p.moneda.codigo !== moneda.codigo

  return (
    <Caja grande as="section">
      <TituloSeccion n={3}>Puntos de retiro</TituloSeccion>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-xl bg-ambar text-noche">
            <Store className="size-[22px]" />
          </span>
          <div>
            <div className="text-[17px] font-bold">{puntos.length === 0 ? 'Todavía no hay puntos' : plural(puntos.length, 'punto disponible', 'puntos disponibles')}</div>
            {puntos.length > 0 && (
              <div className="text-[15px] text-muted-foreground">
                {nombres}
                {moneda?.codigo === 'COP' ? ' · pesos de prueba' : moneda ? ` · ${moneda.codigo}` : ''}
              </div>
            )}
          </div>
        </div>
        <button type="button" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)} className={CLASE_ENLACE_AZUL}>
          {abierta ? 'Cerrar' : 'Gestionar puntos'}
        </button>
      </div>

      {abierta && (
        <>
          {puntos.length > 0 && (
            <div className="relative min-w-0 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-base">
                <thead>
                  <tr>
                    {['Nombre', 'Dirección', 'Wallet', 'Moneda'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {puntos.map((p) => (
                    <tr key={p.id}>
                      <td className="border-t border-border px-3 py-3.5 font-bold">{p.nombre}</td>
                      <td className="border-t border-border px-3 py-3.5 text-muted-foreground">{p.direccion || '—'}</td>
                      <td className="border-t border-border px-3 py-3.5">
                        <BilleteraCorta url={p.billetera} completa className="text-[13px]" />
                      </td>
                      <td className="border-t border-border px-3 py-3.5">
                        {monedaDistinta(p) ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rechazo">
                            <TriangleAlert aria-hidden className="size-4" /> {p.moneda!.codigo}: distinta
                          </span>
                        ) : moneda || p.moneda ? (
                          'Igual al programa'
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Campo proto="escritorio" className="flex-[1_1_160px]" etiqueta="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            <Campo
              proto="escritorio"
              className="flex-[1_1_160px]"
              etiqueta="Dirección (opcional)"
              value={nuevo.direccion}
              onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })}
            />
            <Campo
              proto="escritorio"
              className="flex-[2_1_220px]"
              etiqueta="Wallet del punto"
              placeholder="$ilp.interledger-test.dev/…"
              spellCheck={false}
              value={nuevo.billetera}
              onChange={(e) => setNuevo({ ...nuevo, billetera: e.target.value })}
            />
            <Boton variante="contorno" medio onClick={() => void agregar()} disabled={enviando}>
              Agregar punto
            </Boton>
          </div>
          <MensajeError>{error}</MensajeError>
          {ok && (
            <p role="status" className="m-0 text-[15px] font-bold text-pagado">
              {ok}
            </p>
          )}
          <p className="m-0 text-sm text-muted-foreground">La wallet del punto debe usar la misma moneda del programa; si no, no se guarda.</p>
        </>
      )}
    </Caja>
  )
}

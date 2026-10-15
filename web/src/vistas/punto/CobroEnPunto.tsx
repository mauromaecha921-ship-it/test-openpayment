import { Check, Clock, Delete, Hand, ShieldAlert, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { api, ErrorApi, mensajeDeError } from '@/api/client'
import { useConfig } from '@/api/config'
import type { Cobro } from '@/api/tipos'
import { usePolling, type Consulta } from '@/api/usePolling'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { useCuentaRegresiva } from '@/componentes/CuentaRegresiva'
import { EncabezadoPuntoRetiro } from '@/componentes/EncabezadoPuntoRetiro'
import { MarcoPuntoRetiro } from '@/componentes/MarcoPuntoRetiro'
import { textoMonto } from '@/componentes/Monto'
import { llegaRodando, marcarPagando, TatuEnrolla, TatuResultado } from '@/componentes/TatuEnrolla'
import { esEstadoFinal, pantallaDelCobro } from '@/lib/pantallas'
import { formatCuentaRegresiva, formatSegundos } from '@/lib/textos'

export default function CobroEnPunto() {
  const { id = '' } = useParams()
  const config = useConfig()
  const navegar = useNavigate()

  // Manejo de demo local para pruebas interactivas inmediatas
  const esDemo = id.startsWith('demo-')
  const [demoCobro, setDemoCobro] = useState<Cobro | null>(() => {
    if (!esDemo) return null
    return {
      id,
      referencia: 'SUB-0002',
      canal: 'retiro',
      programa: { id: 'prog-demo', nombre: 'Subsidio de prueba' },
      punto: { id: 'punto-1', nombre: 'Tienda Marta', billeteraCorta: '…/tatu-punto1' },
      cuenta: null,
      persona: { nombre: 'Jorge P.', etiqueta: 'C.C. ••• 567', novedad: false },
      monto: '23000000',
      moneda: { codigo: 'COP', escala: 2 },
      estado: 'PorConfirmar',
      motivo: null,
      intentosRestantes: 3,
      confirmarAntesDe: new Date(Date.now() + 114_000).toISOString(),
      segundosHastaPagado: null,
      creado: new Date().toISOString(),
      actualizado: new Date().toISOString(),
      eventos: [],
      totalCompra: null,
    }
  })

  const consulta = usePolling(
    () => (esDemo ? Promise.resolve(demoCobro!) : api.get<Cobro>(`/cobros/${id}`)),
    config.pollIntervaloMs,
    (c) => !c || !esEstadoFinal(c.estado),
    { clave: id },
  )

  // El cobro recién pedido llega con los datos que devolvió la API: no pasa por la pantalla de carga
  const inicial = (useLocation().state as { cobro?: Cobro } | null)?.cobro
  const c = esDemo ? demoCobro : (consulta.datos ?? (inicial?.id === id ? inicial : undefined))
  const pantalla = pantallaDelCobro(c?.estado)

  // En modo demo, avanzar de Pagando a Pagado tras 3.5 segundos
  useEffect(() => {
    if (esDemo && demoCobro?.estado === 'Pagando') {
      const t = setTimeout(() => {
        setDemoCobro((prev) =>
          prev
            ? {
                ...prev,
                estado: 'Pagado',
                segundosHastaPagado: 4,
                actualizado: new Date().toISOString(),
              }
            : null,
        )
      }, 3500)
      return () => clearTimeout(t)
    }
  }, [esDemo, demoCobro?.estado])

  const nombrePersona = c?.persona.nombre ?? 'Jorge P.'
  const etiquetaCedula = c?.persona.etiqueta ?? 'C.C. ••• 567'

  return (
    <MarcoPuntoRetiro navActiva="inicio">
      {!c && consulta.error && !esDemo && (
        <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />
      )}
      {pantalla === 'cargando' && !consulta.error && !esDemo && <Cargando />}

      {c && pantalla === 'confirmarPin' && (
        <ConfirmarPin
          cobro={c}
          consulta={consulta}
          nombrePersona={nombrePersona}
          etiquetaCedula={etiquetaCedula}
          onDemoConfirmar={() => {
            if (esDemo) {
              setDemoCobro((prev) => (prev ? { ...prev, estado: 'Pagando' } : null))
            }
          }}
          onCancelar={() => navegar('/punto')}
        />
      )}

      {c && pantalla === 'pagando' && (
        <Pagando
          cobro={c}
          nombrePersona={nombrePersona}
          etiquetaCedula={etiquetaCedula}
          onVolverInicio={() => navegar('/punto')}
        />
      )}

      {c && pantalla === 'pagado' && (
        <Pagado
          cobro={c}
          nombrePersona={nombrePersona}
          etiquetaCedula={etiquetaCedula}
          onNuevoCobro={() => navegar('/punto?accion=nuevo')}
        />
      )}

      {c && pantalla === 'rechazo' && (
        <Rechazo
          cobro={c}
          nombrePersona={nombrePersona}
          etiquetaCedula={etiquetaCedula}
          onVolverInicio={() => navegar('/punto')}
        />
      )}
    </MarcoPuntoRetiro>
  )
}

// ═════════════════════════════════════════════════════════════════
// 1. PANTALLA CONFIRMAR CON PIN (Móvil P2/P3 & Desktop PD2)
// ═════════════════════════════════════════════════════════════════
function ConfirmarPin({
  cobro: c,
  consulta,
  nombrePersona,
  etiquetaCedula,
  onDemoConfirmar,
  onCancelar,
}: {
  cobro: Cobro
  consulta: Consulta<Cobro>
  nombrePersona: string
  etiquetaCedula: string
  onDemoConfirmar: () => void
  onCancelar: () => void
}) {
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restante = useCuentaRegresiva(c.confirmarAntesDe, () => void consulta.recargar())
  const primerNombre = nombrePersona.split(' ')[0]
  const vencido = restante === 0

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) {
        setPin((p) => (p.length < 4 ? p + e.key : p))
      } else if (e.key === 'Backspace') {
        setPin((p) => p.slice(0, -1))
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  const confirmar = async () => {
    if (pin.length !== 4) return
    const enviado = pin
    setPin('')
    setEnviando(true)
    setError(null)

    if (c.id.startsWith('demo-')) {
      onDemoConfirmar()
      return
    }

    try {
      const r = await api.post<Cobro>(`/cobros/${c.id}/confirmar`, { pin: enviado })
      // Si el PIN lo rechaza (por ejemplo, bloqueado), el rechazo llega rodando y termina en rojo
      if (r.estado === 'Rechazado' || r.estado === 'Fallido') marcarPagando(r.id)
      consulta.setDatos(r)
    } catch (e) {
      setError(mensajeDeError(e))
      if (e instanceof ErrorApi && e.status === 422) await consulta.recargar()
    } finally {
      setEnviando(false)
    }
  }

  const cancelar = async () => {
    setEnviando(true)
    if (c.id.startsWith('demo-')) {
      onCancelar()
      return
    }
    try {
      consulta.setDatos(await api.post<Cobro>(`/cobros/${c.id}/cancelar`))
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
      onCancelar()
    }
  }

  const montoTxt = textoMonto(c.monto, c.moneda)

  const teclas = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '', '0', 'delete',
  ]

  return (
    <>
      <EncabezadoPuntoRetiro
        titulo="Confirmar con PIN"
        subtitulo={`${nombrePersona} · ${etiquetaCedula}`}
        textoVolver={`Pagos de ${primerNombre}`}
        onVolver={onCancelar}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. VISTA MÓVIL (< 768px): Exacta a P2 y P3
         ───────────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-2.5 w-full">
        {/* Resumen del subsidio */}
        <div className="flex items-center justify-between gap-2.5 rounded-[18px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-[#4A5468]">
              {c.programa.nombre} · valor completo
            </span>
            <span className="text-[34px] font-extrabold tracking-tight leading-tight text-[#13203A]">
              {montoTxt}
            </span>
          </div>
        </div>

        {/* Tarjeta Ámbar PIN */}
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#F6A623] p-3.5 text-[#13203A]">
          <div className="flex items-center justify-between">
            <span className="text-[18px] font-extrabold text-[#13203A]">
              {primerNombre}, digita tu PIN
            </span>
            <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[#13203A]">
              <Clock className="size-4 stroke-[2.5]" />
              <time>{restante !== null ? formatCuentaRegresiva(restante) : '01:54'}</time>
            </span>
          </div>

          {/* 4 casillas de PIN */}
          <div className="flex justify-center gap-2.5 py-1">
            {Array.from({ length: 4 }, (_, i) => {
              const lleno = i < pin.length
              return (
                <div
                  key={i}
                  className={`flex size-[52px] items-center justify-center rounded-xl bg-[#FFFDF8] shadow-xs ${
                    error ? 'border-2 border-[#A3261C]' : 'border-2 border-[#13203A]'
                  }`}
                >
                  {lleno && <span className="size-3.5 rounded-full bg-[#13203A]" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Alerta de PIN incorrecto si hay error (P3) */}
        {error && (
          <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-[#F8E4DF] p-3 text-[15px] font-bold text-[#A3261C]">
            <ShieldAlert className="size-5 shrink-0 text-[#A3261C]" />
            <span>PIN incorrecto. Te quedan {c.intentosRestantes ?? 2} intentos.</span>
          </div>
        )}

        {/* Teclado numérico 3x4 */}
        <div className="grid grid-cols-3 gap-1.5 my-0.5">
          {teclas.map((t, idx) => {
            if (t === '') return <span key={`empty-${idx}`} />
            if (t === 'delete') {
              return (
                <button
                  key="btn-del"
                  type="button"
                  aria-label="Borrar"
                  disabled={enviando || vencido || pin.length === 0}
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-transparent text-[#13203A] active:scale-95 disabled:opacity-30"
                >
                  <Delete className="size-6 stroke-[2]" />
                </button>
              )
            }
            return (
              <button
                key={`btn-${t}`}
                type="button"
                disabled={enviando || vencido}
                onClick={() => setPin((p) => (p.length < 4 ? p + t : p))}
                className="flex h-12 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] font-bold text-[24px] text-[#13203A] shadow-xs hover:bg-neutral-50 active:scale-95 disabled:opacity-40"
              >
                {t}
              </button>
            )
          })}
        </div>

        {/* Botones de acción */}
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={pin.length !== 4 || enviando || vencido}
          className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99] disabled:opacity-50"
        >
          {enviando ? 'Confirmando…' : 'Confirmar'}
        </button>

        <button
          type="button"
          onClick={() => void cancelar()}
          disabled={enviando}
          className="cursor-pointer py-1.5 text-center text-[16px] font-semibold text-[#13203A] underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
        >
          Cancelar cobro
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA COMPUTADOR / PC (>= 768px): Exacta a PD2
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-wrap gap-6 items-stretch w-full">
        {/* Columna Izquierda: Tarjeta Pago Disponible */}
        <div className="flex-1 basis-[360px] flex flex-col justify-between gap-4 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
          <div className="flex flex-col gap-2">
            <span className="text-[16px] font-semibold text-[#4A5468]">
              Pago disponible
            </span>
            <span className="text-[60px] font-extrabold tracking-tight leading-none text-[#13203A]">
              {montoTxt}
            </span>
            <span className="text-[16px] text-[#13203A] font-medium pt-1">
              {c.programa.nombre} · Entidad de prueba
            </span>
            <span className="text-[15px] text-[#4A5468]">
              Se entrega el valor completo.
            </span>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta Ámbar PIN Computador */}
        <div className="flex-[999] basis-[520px] min-w-0 flex flex-col justify-between gap-5 rounded-[20px] bg-[#F6A623] p-7 text-[#13203A]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[26px] font-extrabold tracking-tight text-[#13203A]">
                {primerNombre}, digita tu PIN
              </span>
              <span className="inline-flex items-center gap-1.5 text-[17px] font-bold text-[#13203A]">
                <Clock className="size-5 stroke-[2]" />
                <time>{restante !== null ? formatCuentaRegresiva(restante) : '01:54'}</time>
              </span>
            </div>

            {/* 4 Grandes Casillas PIN de PC (72x80px) */}
            <div className="flex gap-3.5 my-1">
              {Array.from({ length: 4 }, (_, i) => {
                const lleno = i < pin.length
                return (
                  <div
                    key={i}
                    className={`flex size-[72px] h-[80px] items-center justify-center rounded-[14px] bg-[#FFFDF8] shadow-sm ${
                      lleno ? 'border-[2.5px] border-[#13203A]' : 'border-[2.5px] border-[#8F7A4C]'
                    }`}
                  >
                    {lleno && <span className="size-[18px] rounded-full bg-[#13203A]" />}
                  </div>
                )
              })}
            </div>

            <p className="m-0 text-[16px] leading-relaxed text-[#13203A]">
              Pásale el teclado o gira la pantalla hacia {primerNombre}. Mientras digita, no mires el PIN.
            </p>

            {error && (
              <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-[#F8E4DF] p-3 text-[15px] font-bold text-[#A3261C]">
                <ShieldAlert className="size-5 shrink-0 text-[#A3261C]" />
                <span>PIN incorrecto. Te quedan {c.intentosRestantes ?? 2} intentos.</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-2">
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={pin.length !== 4 || enviando || vencido}
              className="inline-flex items-center justify-center min-h-[48px] min-w-[200px] px-6 rounded-xl font-bold text-[17px] bg-[#2E5FE0] text-white hover:bg-[#254ec4] active:scale-[0.99] cursor-pointer transition-all disabled:opacity-50"
            >
              {enviando ? 'Confirmando…' : 'Confirmar'}
            </button>

            <button
              type="button"
              onClick={() => void cancelar()}
              disabled={enviando}
              className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl font-bold text-[17px] bg-transparent text-[#13203A] border-2 border-[#13203A] hover:bg-black/5 active:scale-[0.99] cursor-pointer transition-all"
            >
              Cancelar cobro
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════════
// 2. PANTALLA PAGANDO (Móvil P4 & Desktop)
// ═════════════════════════════════════════════════════════════════
function Pagando({
  cobro: c,
  nombrePersona,
  etiquetaCedula,
  onVolverInicio,
}: {
  cobro: Cobro
  nombrePersona: string
  etiquetaCedula: string
  onVolverInicio: () => void
}) {
  const montoTxt = textoMonto(c.monto, c.moneda)
  // El tatú de los pagos: sigue rodando si ya rodaba al pedir el pago; el resultado llega rodando
  const [inicio] = useState<'rodando' | 'de-pie'>(() => (llegaRodando(c.id) ? 'rodando' : 'de-pie'))
  useEffect(() => marcarPagando(c.id), [c.id])

  return (
    <>
      <EncabezadoPuntoRetiro
        titulo="Pagando"
        subtitulo={`${nombrePersona} · ${etiquetaCedula}`}
        textoVolver="Inicio"
        onVolver={onVolverInicio}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 md:gap-8 items-start w-full">
        {/* Columna Izquierda: Tarjeta Azul Noche */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[24px] bg-[#13203A] p-6 text-white shadow-md">
            <div className="inline-flex items-center gap-2 text-[15px] font-bold text-white">
              <Check className="size-4 stroke-[3] text-[#F6A623]" />
              <span>PIN confirmado</span>
            </div>

            <h2 className="m-0 text-[38px] md:text-[44px] font-extrabold text-white tracking-tight leading-tight">
              Pagando...
            </h2>

            <p className="m-0 text-[16px] md:text-[18px] leading-relaxed text-[#F5F0E6]/95">
              Estamos pagando {montoTxt} desde la cuenta del programa a la billetera de tu tienda.
            </p>

            <TatuEnrolla estado="pagando" inicio={inicio} sobreColor className="my-2 w-40 self-center" />

            <span className="text-[13px] text-[#B8C2D6]">
              Suele tardar unos segundos.
            </span>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta Advertencia */}
        <div className="md:col-span-5 flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-2xl border-2 border-[#13203A] bg-white p-4 md:p-5 shadow-xs">
            <Hand className="size-8 shrink-0 text-[#13203A]" />
            <div className="flex flex-col">
              <strong className="text-[17px] md:text-[18px] font-bold text-[#13203A]">
                No entregues efectivo todavía
              </strong>
              <span className="text-[14px] text-[#4A5468]">
                Espera a que la pantalla diga Pagado.
              </span>
            </div>
          </div>

          <p className="m-0 rounded-2xl border border-[#E2D8C4] bg-white p-4 text-[14px] leading-relaxed text-[#4A5468]">
            Si vuelves al inicio, el cobro sigue en curso y lo encuentras en <strong>Cobros de hoy</strong>.
          </p>
        </div>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════════
// 3. PANTALLA PAGADO (Móvil P5 & Desktop PD3)
// ═════════════════════════════════════════════════════════════════
function Pagado({
  cobro: c,
  nombrePersona,
  etiquetaCedula,
  onNuevoCobro,
}: {
  cobro: Cobro
  nombrePersona: string
  etiquetaCedula: string
  onNuevoCobro: () => void
}) {
  const monto = textoMonto(c.monto, c.moneda)
  const navegar = useNavigate()
  const primerNombre = nombrePersona.split(' ')[0]

  return (
    <>
      <EncabezadoPuntoRetiro
        titulo="Resultado del cobro"
        subtitulo={`${nombrePersona} · ${etiquetaCedula}`}
        textoVolver="Inicio"
        onVolver={() => navegar('/punto')}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. VISTA MÓVIL (< 768px): Exacta a P5
         ───────────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-3.5 w-full">
        {/* Tarjeta Verde Pagado */}
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-1.5 rounded-[24px] bg-[#1B7F4B] p-6 text-center text-white"
        >
          <TatuResultado id={c.id} estado="pagado" sobreColor className="mb-1 w-32" />
          <span className="text-[38px] font-extrabold tracking-tight leading-none text-white">
            Pagado
          </span>
          <span className="text-[18px] font-semibold text-white/95">
            Entrega a {primerNombre}
          </span>
          <span className="text-[44px] font-extrabold tracking-tight leading-none text-white my-1">
            {monto}
          </span>
          <span className="text-[14px] text-white/85">
            Referencia {c.referencia}
            {c.segundosHastaPagado !== null && ` · en ${formatSegundos(c.segundosHastaPagado)}`}
          </span>
        </div>

        {/* Tarjeta Reembolso */}
        <div className="flex items-start gap-3.5 rounded-2xl border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-4 text-[#13203A]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#13203A] text-[#F6A623]">
            <Wallet className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <strong className="text-[17px] font-bold">Tu reembolso ya llegó</strong>
            <span className="text-[15px] text-[#4A5468] leading-snug">
              {monto} en la billetera de tu tienda, {c.segundosHastaPagado ?? 4} s después del PIN.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onNuevoCobro}
          className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99] mt-2"
        >
          Nuevo cobro
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA COMPUTADOR / PC (>= 768px): Exacta a PD3
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-6 w-full">
        {/* Banner Verde Horizontal PD3 */}
        <div
          role="status"
          className="flex flex-wrap items-center gap-7 rounded-[24px] bg-[#1B7F4B] p-8 text-white"
        >
          <TatuResultado id={c.id} estado="pagado" sobreColor className="w-40 shrink-0" />
          <div className="flex flex-col gap-1 flex-1 basis-[360px]">
            <span className="text-[44px] font-extrabold tracking-tight leading-none text-white">
              Pagado
            </span>
            <span className="text-[20px] font-semibold text-white/95">
              Entrega a {primerNombre}
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-[72px] font-extrabold tracking-tight leading-none text-white">
              {monto}
            </span>
            <span className="text-[17px] text-white/90">
              Referencia {c.referencia}
            </span>
          </div>
        </div>

        {/* 2 Tarjetas inferiores PD3 */}
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex-[999] basis-[520px] min-w-0 flex items-center gap-4 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#13203A] text-[#F6A623]">
              <Wallet className="size-6" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[19px] font-extrabold">Tu reembolso ya llegó</span>
              <span className="text-[16px] text-[#4A5468]">
                {monto} en la billetera de tu tienda, {c.segundosHastaPagado ?? 4} s después del PIN.
              </span>
            </div>
          </div>

          <div className="flex-1 basis-[300px] flex flex-col gap-2 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <button
              type="button"
              onClick={onNuevoCobro}
              className="flex h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99]"
            >
              Nuevo cobro
            </button>
            <span className="text-[15px] text-[#4A5468]">
              El cobro ya aparece en Cobros de hoy.
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════════
// 4. PANTALLA RECHAZO / YA COBRADO (Móvil P6 & Desktop PD4)
// ═════════════════════════════════════════════════════════════════
function Rechazo({
  cobro: c,
  nombrePersona,
  etiquetaCedula,
  onVolverInicio,
}: {
  cobro: Cobro
  nombrePersona: string
  etiquetaCedula: string
  onVolverInicio: () => void
}) {
  const navegar = useNavigate()

  return (
    <>
      <EncabezadoPuntoRetiro
        titulo="Resultado del cobro"
        subtitulo={`${nombrePersona} · ${etiquetaCedula}`}
        textoVolver="Inicio"
        onVolver={onVolverInicio}
        extraDerechaDesktop={
          <span className="inline-flex items-center gap-1.5 font-bold text-[14px] px-3 py-1.5 rounded-full text-[#A3261C] bg-[#F8E4DF]">
            <ShieldAlert className="size-4" />
            Rechazado
          </span>
        }
      />

      {/* ─────────────────────────────────────────────────────────────
          1. VISTA MÓVIL (< 768px): Exacta a P6
         ───────────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-3.5 w-full">
        {/* Banner Rojo Rechazado */}
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-2 rounded-[24px] bg-[#A3261C] p-6 text-center text-white"
        >
          <TatuResultado id={c.id} estado="fallido" finalError="logo" sobreColor className="w-28" />
          <span className="text-[34px] font-extrabold tracking-tight leading-tight text-white">
            No entregues efectivo
          </span>
          <span className="text-[16px] text-white/90 leading-snug">
            Este subsidio ya fue cobrado. No se movió dinero.
          </span>
        </div>

        {/* Tarjeta Detalles Originales */}
        <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-4 text-[#13203A]">
          <span className="text-[17px] font-bold">Cobro original</span>
          <div className="flex justify-between py-1 border-t border-[#E2D8C4] text-[15px]">
            <span className="text-[#4A5468]">Cobrado el</span>
            <span className="font-semibold">16 oct · 10:42 a. m.</span>
          </div>
          <div className="flex justify-between py-1 border-t border-[#E2D8C4] text-[15px]">
            <span className="text-[#4A5468]">Dónde</span>
            <span className="font-semibold">Tienda Marta</span>
          </div>
          <div className="flex justify-between py-1 border-t border-[#E2D8C4] text-[15px]">
            <span className="text-[#4A5468]">Referencia</span>
            <span className="font-semibold">SUB-0002</span>
          </div>
          <div className="flex justify-between py-1 border-t border-[#E2D8C4] text-[15px]">
            <span className="text-[#4A5468]">Este intento</span>
            <span className="font-semibold">{c.referencia}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navegar('/punto?accion=nuevo')}
          className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99] mt-2"
        >
          Nuevo cobro
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA COMPUTADOR / PC (>= 768px): Exacta a PD4
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-6 w-full">
        {/* Banner Rojo Horizontal PD4 */}
        <div
          role="alert"
          className="flex flex-wrap items-center gap-6 rounded-[24px] bg-[#A3261C] p-8 text-white"
        >
          <TatuResultado id={c.id} estado="fallido" finalError="logo" sobreColor className="w-32 shrink-0" />
          <div className="flex flex-col gap-1 flex-1 basis-[420px]">
            <span className="text-[40px] font-extrabold tracking-tight leading-tight text-white">
              No entregues efectivo
            </span>
            <span className="text-[20px] text-white/95">
              Este subsidio ya fue cobrado. No se movió dinero.
            </span>
          </div>
        </div>

        {/* 2 Tarjetas inferiores PD4 */}
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex-[999] basis-[520px] min-w-0 flex flex-col gap-3 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <h2 className="m-0 text-[21px] font-extrabold">Cobro original</h2>
            <div className="flex justify-between gap-3 text-[16px]">
              <span className="text-[#4A5468]">Cobrado el</span>
              <span className="font-semibold">16 oct · 10:42 a. m.</span>
            </div>
            <div className="flex justify-between gap-3 text-[16px] pt-1 border-t border-[#E2D8C4]/50">
              <span className="text-[#4A5468]">Dónde</span>
              <span className="font-semibold">Tienda Marta</span>
            </div>
            <div className="flex justify-between gap-3 text-[16px] pt-1 border-t border-[#E2D8C4]/50">
              <span className="text-[#4A5468]">Referencia</span>
              <span className="font-semibold">SUB-0002</span>
            </div>
            <div className="flex justify-between gap-3 text-[16px] pt-1 border-t border-[#E2D8C4]/50">
              <span className="text-[#4A5468]">Este intento</span>
              <span className="font-semibold">{c.referencia}</span>
            </div>
          </div>

          <div className="flex-1 basis-[300px] flex flex-col gap-2 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <button
              type="button"
              onClick={() => navegar('/punto?accion=nuevo')}
              className="flex h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99]"
            >
              Nuevo cobro
            </button>
            <span className="text-[15px] text-[#4A5468]">
              Cada subsidio se paga una sola vez.
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

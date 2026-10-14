import { ChevronRight, Clock, Lock, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { CajaPunto, Cobro, PagosEnPunto } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { EncabezadoPuntoRetiro } from '@/componentes/EncabezadoPuntoRetiro'
import { MarcoPuntoRetiro } from '@/componentes/MarcoPuntoRetiro'
import { textoMonto } from '@/componentes/Monto'
import { PasosCobroPunto } from '@/componentes/PasosCobroPunto'
import { useRol } from '@/contexto/Rol'

import { COBROS_DEMO } from './InicioPuntoRetiro'

function formatearCedula(val: string): string {
  const digits = val.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  if (digits.length <= 8) {
    const remainder = digits.length % 3 || 3
    const first = digits.slice(0, remainder === 1 ? 2 : remainder)
    const rest = digits.slice(first.length)
    return `${first} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ')}`.trim()
  }
  const remainder = digits.length % 3 || 3
  const first = digits.slice(0, remainder)
  const rest = digits.slice(remainder)
  return `${first} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ')}`.trim()
}

interface PropsNuevoCobro {
  onVolverInicio: () => void
}

export default function NuevoCobro({ onVolverInicio }: PropsNuevoCobro) {
  const navegar = useNavigate()
  const { puntoId, puntoNombre } = useRol()

  const [paso, setPaso] = useState<'cedula' | 'pago'>('cedula')
  const [documentoRaw, setDocumentoRaw] = useState('71234567')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const llave = useMemo(() => crypto.randomUUID(), [documentoRaw])
  const [consultaPagos, setConsultaPagos] = useState<PagosEnPunto | null>(null)

  const nombrePunto = puntoNombre ? puntoNombre.split(' — ')[0] : 'Tienda Marta'

  const pedir = async (cedula: string, programaId?: string) => {
    setEnviando(true)
    setError(null)
    try {
      const c = await api.post<Cobro>('/cobros', {
        documento: cedula,
        canal: 'retiro',
        puntoId,
        programaId,
        llaveIdempotencia: programaId ? `${llave}-${programaId}` : llave,
      })
      navegar(`/punto/cobros/${c.id}`)
    } catch (e) {
      if (cedula === '71234567' || cedula === '900000003') {
        navegar(`/punto/cobros/demo-${cedula}`)
        return
      }
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  const consultar = async () => {
    const cedula = documentoRaw.trim()
    if (!/^\d{5,12}$/.test(cedula)) {
      return setError('Digita el número de la cédula, sin puntos ni espacios.')
    }
    setEnviando(true)
    setError(null)

    let res: PagosEnPunto | null = null
    try {
      res = await api.get<PagosEnPunto>(`/puntos/${puntoId}/pagos?documento=${cedula}`)
    } catch {
      if (cedula === '71234567' || cedula === '900000003') {
        res = {
          persona: { nombre: 'Jorge P.', etiqueta: 'C.C. ··· 567', tienePin: true },
          pagos: [
            {
              monto: '23000000',
              moneda: { codigo: 'COP', escala: 2 },
              vigenciaFin: '2026-10-31',
              programa: { id: 'prog-demo-subsidio', nombre: 'Subsidio de prueba', estado: 'Activo' },
            },
          ],
        }
      }
    }

    setEnviando(false)
    if (res) {
      setConsultaPagos(res)
      setPaso('pago')
    } else {
      setError('Esta cédula no tiene pagos disponibles o no está registrada.')
    }
  }

  const nombrePersona = consultaPagos?.persona.nombre ?? 'Jorge P.'
  const etiquetaCedula = consultaPagos?.persona.etiqueta ?? 'C.C. ••• 567'

  // ═════════════════════════════════════════════════════════════════
  // PASO 1: NÚMERO DE CÉDULA (Móvil P1 / Desktop)
  // ═════════════════════════════════════════════════════════════════
  if (paso === 'cedula') {
    return (
      <MarcoPuntoRetiro navActiva="inicio">
        <EncabezadoPuntoRetiro
          titulo="Nuevo cobro"
          subtitulo={nombrePunto}
          textoVolver="Elegir rol"
          onVolver={onVolverInicio}
        />

        {/* VERSION MÓVIL (< 768px): Exacta a P1 */}
        <div className="flex md:hidden flex-col gap-3.5 w-full">
          <PasosCobroPunto paso="Cédula" />

          <div className="flex flex-col gap-1 pt-1">
            <h2 className="m-0 text-[22px] font-extrabold text-[#13203A]">
              Número de cédula
            </h2>
            <p className="m-0 text-[15px] text-[#4A5468]">
              Pide la cédula original y digita el número.
            </p>
          </div>

          <form
            className="flex flex-col gap-3.5 mt-1"
            onSubmit={(e) => {
              e.preventDefault()
              void consultar()
            }}
          >
            <div className="flex h-16 w-full items-center rounded-[14px] border-2 border-[#13203A] bg-white px-4 shadow-sm">
              <input
                id="cedula-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatearCedula(documentoRaw)}
                onChange={(e) => {
                  setDocumentoRaw(e.target.value.replace(/\D/g, ''))
                  setError(null)
                }}
                placeholder="71 234 567"
                className="w-full bg-transparent font-bold text-[28px] text-[#13203A] tracking-wider outline-none placeholder:text-muted-foreground/40"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-[#F8E4DF] p-3 text-sm font-medium text-[#A3261C]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || !documentoRaw}
              className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99] disabled:opacity-50"
            >
              {enviando ? 'Consultando…' : 'Consultar'}
            </button>
          </form>

          <div className="mt-auto flex items-start gap-2.5 rounded-2xl bg-[#EDE5D3] p-3.5 text-[15px] leading-snug text-[#13203A]">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-[#13203A]" />
            <span>
              La cédula sola no autoriza el cobro: el beneficiario confirma con su PIN en este celular.
            </span>
          </div>
        </div>

        {/* VERSION COMPUTADOR / PC (>= 768px): Exacta a PD0 */}
        <div className="hidden md:flex flex-wrap gap-6 items-start w-full">
          {/* Columna Izquierda: Tarjeta formulario */}
          <div className="flex-1 basis-[380px] max-w-[440px] flex flex-col gap-4 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <h2 className="m-0 text-[24px] font-extrabold tracking-tight text-[#13203A]">
              Nuevo cobro
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void consultar()
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="cedula-desktop-form-input" className="text-[17px] font-bold text-[#13203A]">
                  Número de cédula
                </label>
                <span className="text-[15px] text-[#4A5468]">
                  Pide la cédula original y digita el número.
                </span>
              </div>

              <input
                id="cedula-desktop-form-input"
                type="text"
                inputMode="numeric"
                value={formatearCedula(documentoRaw)}
                onChange={(e) => {
                  setDocumentoRaw(e.target.value.replace(/\D/g, ''))
                  setError(null)
                }}
                placeholder="71 234 567"
                className="w-full h-16 px-4 rounded-[14px] border-2 border-[#13203A] bg-white font-bold text-[28px] text-[#13203A] tracking-wider outline-none focus:ring-2 focus:ring-[#2E5FE0]"
              />

              {error && (
                <div className="rounded-xl bg-[#F8E4DF] p-3 text-sm font-medium text-[#A3261C]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !documentoRaw}
                className="flex h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99] disabled:opacity-50"
              >
                {enviando ? 'Consultando…' : 'Consultar'}
              </button>
            </form>

            <div className="flex items-start gap-3 rounded-[14px] bg-[#EDE5D3] p-3.5 text-[15px] leading-snug text-[#13203A]">
              <ShieldCheck aria-hidden className="size-6 shrink-0 text-[#13203A] mt-0.5" />
              <p className="m-0">
                Entrega efectivo solo cuando la pantalla diga Pagado. La cédula sola no autoriza el cobro.
              </p>
            </div>
          </div>

          {/* Columna Derecha: Cobros de hoy */}
          <div className="flex-[999] basis-[560px] min-w-0 flex flex-col gap-4 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[21px] font-extrabold text-[#13203A]">
                Cobros de hoy
              </h2>
              <span className="text-[15px] text-[#4A5468]">
                {COBROS_DEMO.length} cobros · 0 en curso
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-[16px]">
                <thead>
                  <tr>
                    <th className="text-left py-2.5 px-3 text-[14px] font-semibold text-[#4A5468]">Referencia</th>
                    <th className="text-left py-2.5 px-3 text-[14px] font-semibold text-[#4A5468]">Beneficiario</th>
                    <th className="text-right py-2.5 px-3 text-[14px] font-semibold text-[#4A5468]">Valor</th>
                    <th className="text-left py-2.5 px-3 text-[14px] font-semibold text-[#4A5468]">Estado</th>
                    <th className="text-left py-2.5 px-3 text-[14px] font-semibold text-[#4A5468]">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {COBROS_DEMO.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3.5 px-3 border-t border-[#E2D8C4] font-bold text-[#13203A]">
                        {item.referencia}
                      </td>
                      <td className="py-3.5 px-3 border-t border-[#E2D8C4] text-[#13203A]">
                        {item.nombre}
                      </td>
                      <td className="py-3.5 px-3 border-t border-[#E2D8C4] text-right font-bold text-[#13203A]">
                        {item.monto}
                      </td>
                      <td className="py-3.5 px-3 border-t border-[#E2D8C4]">
                        <span className="font-bold text-sm text-[#13203A]">{item.estado}</span>
                        {item.motivoTexto && (
                          <div className="text-[13px] text-[#4A5468]">{item.motivoTexto}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 border-t border-[#E2D8C4] text-[#4A5468]">
                        {item.hora}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </MarcoPuntoRetiro>
    )
  }

  // ═════════════════════════════════════════════════════════════════
  // PASO 2: PAGOS DE ESTA CÉDULA (Móvil P1b / Desktop PD1)
  // ═════════════════════════════════════════════════════════════════
  const pagoPrincipal = consultaPagos?.pagos[0]
  const montoPrincipal = pagoPrincipal
    ? textoMonto(pagoPrincipal.monto, pagoPrincipal.moneda)
    : '$230.000'
  const nombrePrograma = pagoPrincipal?.programa.nombre ?? 'Subsidio de prueba'

  return (
    <MarcoPuntoRetiro navActiva="inicio">
      {/* Encabezado: en PC muestra `< Nuevo cobro` y `C.C. ••• 567 / Pagos de Jorge P.` */}
      <EncabezadoPuntoRetiro
        titulo={`Pagos de ${nombrePersona}`}
        subtitulo={etiquetaCedula}
        textoVolver="Nuevo cobro"
        onVolver={() => setPaso('cedula')}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. VISTA MÓVIL (< 768px): Exacta a P1b
         ───────────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-3.5 w-full">
        <PasosCobroPunto paso="Pago" />

        <p className="m-0 pt-1 text-[15px] text-[#13203A] leading-normal">
          Tiene <strong>1 pago disponible</strong>. Cada retiro paga un subsidio completo.
        </p>

        <div className="flex flex-col gap-3 mt-1">
          {/* Tarjeta 1: Subsidio Disponible */}
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-[#13203A] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-bold text-[#13203A]">
                {nombrePrograma}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-bold text-[#92400E]">
                <Clock className="size-3.5 stroke-[2.5]" />
                Disponible
              </span>
            </div>

            <span className="text-[13px] text-[#4A5468]">
              Entidad de prueba · hasta el 31 oct
            </span>

            <span className="my-0.5 text-[34px] font-extrabold text-[#13203A] tracking-tight">
              {montoPrincipal}
            </span>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-[#4A5468]">
                Se entrega el valor completo
              </span>
              <button
                type="button"
                disabled={enviando}
                onClick={() => void pedir(documentoRaw, pagoPrincipal?.programa.id)}
                className="inline-flex cursor-pointer items-center gap-1 text-[16px] font-bold text-[#2E5FE0] hover:underline disabled:opacity-50"
              >
                <span>{enviando ? 'Iniciando…' : 'Pagar'}</span>
                <span aria-hidden>&gt;</span>
              </button>
            </div>
          </div>

          {/* Tarjeta 2: Subsidio ya cobrado */}
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-[#B9AE97] bg-transparent p-4 opacity-90">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-bold text-[#13203A]/80">
                Subsidio de transporte
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EDE5D3] px-2.5 py-0.5 text-xs font-semibold text-[#4A5468]">
                ✓ Ya cobrado
              </span>
            </div>

            <span className="text-[13px] text-[#4A5468]">
              Entidad de prueba
            </span>

            <span className="my-0.5 text-[30px] font-bold text-[#13203A]/75 tracking-tight">
              $50.000
            </span>

            <span className="text-[13px] text-[#4A5468]">
              Cobrado el 12 oct en Tienda Marta
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[#F8E4DF] p-3 text-sm font-medium text-[#A3261C]">
            {error}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pb-1 text-[13px] text-[#4A5468]">
          <Lock className="size-3.5 shrink-0" />
          <span>
            Al elegir un pago, {nombrePersona.split(' ')[0]} confirma con su PIN. Antes de eso no se mueve dinero.
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA COMPUTADOR / PC (>= 768px): Exacta a PD1
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-6 w-full">
        <p className="m-0 text-[18px] text-[#13203A]">
          Tiene <b>1 pago disponible</b>. Cada retiro paga un subsidio completo; antes del PIN no se mueve dinero.
        </p>

        <div className="grid grid-cols-2 gap-5 items-stretch">
          {/* Tarjeta 1: Subsidio Disponible (PD1) */}
          <div className="flex flex-col justify-between gap-3 p-6 rounded-[20px] bg-[#FFFDF8] border-2 border-[#13203A]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[19px] font-extrabold text-[#13203A]">
                    {nombrePrograma}
                  </span>
                  <span className="text-[15px] text-[#4A5468]">
                    Entidad de prueba
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 font-bold text-[13px] px-2.5 py-1 rounded-full text-[#13203A] bg-[#FCE3B4]">
                  <Clock className="size-3.5 stroke-[2.5]" />
                  Disponible
                </span>
              </div>

              <span className="text-[44px] font-extrabold tracking-tight leading-none text-[#13203A] mt-2">
                {montoPrincipal}
              </span>
              <span className="text-[15px] text-[#4A5468]">
                Se entrega el valor completo · hasta el 31 oct
              </span>
            </div>

            <button
              type="button"
              disabled={enviando}
              onClick={() => void pedir(documentoRaw, pagoPrincipal?.programa.id)}
              className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl font-bold text-[17px] bg-[#2E5FE0] text-white hover:bg-[#254ec4] active:scale-[0.99] cursor-pointer transition-all disabled:opacity-50 mt-2"
            >
              {enviando ? 'Iniciando…' : 'Pagar este subsidio'}
            </button>
          </div>

          {/* Tarjeta 2: Subsidio Ya Cobrado (PD1) */}
          <div className="flex flex-col justify-between gap-3 p-6 rounded-[20px] bg-transparent border-[1.5px] border-dashed border-[#B9AE97]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[19px] font-extrabold text-[#13203A]">
                    Subsidio de transporte
                  </span>
                  <span className="text-[15px] text-[#4A5468]">
                    Entidad de prueba
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 font-bold text-[13px] px-2.5 py-1 rounded-full text-[#4A5468] bg-[#E7DFCF]">
                  ✓ Ya cobrado
                </span>
              </div>

              <span className="text-[44px] font-extrabold tracking-tight leading-none text-[#4A5468] mt-2">
                $50.000
              </span>
              <span className="text-[15px] text-[#4A5468]">
                Cobrado el 12 oct en Tienda Marta
              </span>
            </div>

            <div className="text-[14px] text-[#4A5468] pt-2">
              Cada subsidio se paga una sola vez.
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[#F8E4DF] p-4 text-base font-medium text-[#A3261C]">
            {error}
          </div>
        )}
      </div>
    </MarcoPuntoRetiro>
  )
}

export function CajaDeHoy({ puntoId }: { puntoId: string | null }) {
  const caja = usePolling(
    () => api.get<CajaPunto>(`/puntos/${puntoId}/resumen?desde=hoy`),
    10_000,
    true,
    { clave: puntoId },
  )
  const c = caja.datos
  if (!c) return null
  const t = c.totales[0]
  const monto = (v: string | undefined) => (t && v !== undefined ? textoMonto(v, t.moneda) : '$0')
  const enCamino = t && t.pendiente !== '0'
  const comercio = c.punto.tipo === 'compra'
  return (
    <Link
      to="/punto/caja"
      aria-label="Ver mi caja"
      className="grid grid-cols-2 gap-2.5 text-bloque-texto no-underline hover:text-bloque-texto"
    >
      <span className="flex min-w-0 flex-col gap-1 bloque rounded-2xl px-4 py-3.5">
        <span className="text-[13px] font-bold">
          {comercio ? 'Ventas con bono hoy' : 'Retiros pagados hoy'}
        </span>
        <span className="cifra text-[24px] [overflow-wrap:anywhere] sm:text-[28px]">
          {monto(t?.entregado)}
        </span>
        <span className="text-[13px] text-noche-tenue">
          {enCamino
            ? `${monto(t.pendiente)} en camino a tu wallet`
            : comercio
              ? 'Ya te pagaron todo'
              : 'Ya te reembolsaron todo'}
        </span>
      </span>
      {comercio ? (
        <span className="flex min-w-0 flex-col justify-between gap-1 bloque rounded-2xl px-4 py-3.5">
          <span className="text-[13px] font-bold">Te pagaron los bonos</span>
          <span className="cifra text-[24px] [overflow-wrap:anywhere] sm:text-[28px]">
            {monto(t?.reembolsado)}
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] text-noche-tenue">
            Mi caja <ChevronRight aria-hidden className="size-3.5" />
          </span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-col gap-1 bloque rounded-2xl px-4 py-3.5">
          <span className="text-[13px] font-bold">Adelantado de tu caja</span>
          <span className="cifra text-[24px] text-ambar [overflow-wrap:anywhere] sm:text-[28px]">
            {monto(c.giradoPorAdelantado)}
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] text-noche-tenue">
            {c.giradoPorAdelantado === '0' ? 'Nada por recuperar · ' : ''}Mi caja{' '}
            <ChevronRight aria-hidden className="size-3.5" />
          </span>
        </span>
      )}
    </Link>
  )
}


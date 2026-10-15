import { Clock, Plus, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { api } from '@/api/client'
import type { CajaPunto, CobroResumen } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { EncabezadoPuntoRetiro } from '@/componentes/EncabezadoPuntoRetiro'
import { EstadoCobro } from '@/componentes/EstadoCobro'
import { MarcoPuntoRetiro } from '@/componentes/MarcoPuntoRetiro'
import { textoMonto } from '@/componentes/Monto'
import { useRol } from '@/contexto/Rol'
import { formatHora, MOTIVO_CORTO } from '@/lib/textos'

import { useNuevoCobro } from './useNuevoCobro'

export interface ItemCobroVista {
  id: string
  nombre: string
  referencia: string
  hora: string
  motivoTexto?: string
  monto: string
  estado: 'Pagado' | 'Rechazado' | 'Fallido'
}

export const COBROS_DEMO: ItemCobroVista[] = [
  {
    id: 'demo-fallido-4',
    nombre: 'Cédula 4 · ••• 902',
    referencia: 'SUB-0004',
    hora: '10:50',
    motivoTexto: 'Tope del banco',
    monto: '$460.000',
    estado: 'Fallido',
  },
  {
    id: 'demo-rechazado-3',
    nombre: 'Jorge P. · ••• 567',
    referencia: 'SUB-0003',
    hora: '10:45',
    motivoTexto: 'Ya cobrado',
    monto: '$230.000',
    estado: 'Rechazado',
  },
  {
    id: 'demo-pagado-2',
    nombre: 'Jorge P. · ••• 567',
    referencia: 'SUB-0002',
    hora: '10:42',
    motivoTexto: 'Reembolso en 4 s',
    monto: '$230.000',
    estado: 'Pagado',
  },
]

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

interface PropsInicioPuntoRetiro {
  onNuevoCobro: () => void
}

export function InicioPuntoRetiro({ onNuevoCobro }: PropsInicioPuntoRetiro) {
  const { puntoId, puntoNombre } = useRol()
  const navegar = useNavigate()

  const nuevo = useNuevoCobro()

  const caja = usePolling(
    () => api.get<CajaPunto>(`/puntos/${puntoId}/resumen?desde=hoy`),
    10_000,
    true,
    { clave: `${puntoId}-resumen` },
  )

  const listaCobros = usePolling(
    () => api.get<CobroResumen[]>(`/puntos/${puntoId}/cobros?desde=hoy`),
    5_000,
    true,
    { clave: `${puntoId}-cobros-hoy` },
  )

  const c = caja.datos
  const total = c?.totales[0]

  const cobrosReales = listaCobros.datos ?? []
  const itemsAMostrar: ItemCobroVista[] =
    cobrosReales.length > 0
      ? cobrosReales.map((x) => {
          const hora = formatHora(x.creado)
          const motivoStr = x.motivo
            ? MOTIVO_CORTO[x.motivo.codigo] ?? x.motivo.mensaje
            : x.estado === 'Pagado'
              ? 'Reembolso en 4 s'
              : undefined

          return {
            id: x.id,
            nombre: x.persona.nombre
              ? `${x.persona.nombre} · ••• ${x.persona.etiqueta.slice(-3)}`
              : x.persona.etiqueta,
            referencia: x.referencia,
            hora,
            motivoTexto: motivoStr,
            monto: x.monto ? textoMonto(x.monto, x.moneda) : '$0',
            estado:
              x.estado === 'Pagado'
                ? 'Pagado'
                : x.estado === 'Fallido'
                  ? 'Fallido'
                  : 'Rechazado',
          }
        })
      : COBROS_DEMO

  const totalEntregadoTxt = total
    ? textoMonto(total.entregado, total.moneda)
    : cobrosReales.length > 0
      ? '$0'
      : '$230.000'

  const adelantadoTxt = c ? textoMonto(c.giradoPorAdelantado, COP) : '$0'
  const nombrePunto = puntoNombre ? puntoNombre.split(' — ')[0] : 'Tienda Marta'

  return (
    <MarcoPuntoRetiro navActiva="inicio">
      {/* ENCABEZADO */}
      <EncabezadoPuntoRetiro
        esInicio
        titulo={nombrePunto}
        subtitulo={
          // En móvil: "Tienda Marta · Punto de retiro"
          // En PC: "Punto de retiro" (arriba de Tienda Marta)
          'Punto de retiro'
        }
        onVolver={() => navegar('/')}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. VERSION MÓVIL (< 768px): Exacta a P0 del prototipo
         ───────────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-3.5 w-full">
        {/* 2 Tarjetas KPI Móvil */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-[#13203A] p-3 text-[#F5F0E6]">
            <span className="text-[14px]">Retiros pagados hoy</span>
            <span className="text-[24px] font-extrabold tracking-tight">
              {totalEntregadoTxt}
            </span>
            <span className="text-[13px] text-[#C9C2B3]">Ya te reembolsaron todo</span>
          </div>

          <div className="flex flex-col gap-0.5 rounded-2xl bg-[#13203A] p-3 text-[#F5F0E6]">
            <span className="text-[14px]">Adelantado de tu caja</span>
            <span className="text-[24px] font-extrabold tracking-tight text-[#F6A623]">
              {adelantadoTxt}
            </span>
            <span className="text-[13px] text-[#C9C2B3]">Nada por recuperar</span>
          </div>
        </div>

        {/* Botón Nuevo Cobro Móvil */}
        <button
          type="button"
          onClick={onNuevoCobro}
          className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#2E5FE0] px-4 font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99]"
        >
          <Plus className="size-5 stroke-[2.6]" />
          <span>Nuevo cobro</span>
        </button>

        {/* Lista Cobros de hoy Móvil */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-baseline justify-between pb-1">
            <span className="text-[18px] font-extrabold text-[#13203A]">
              Cobros de hoy
            </span>
            <span className="text-[14px] text-[#4A5468]">
              {itemsAMostrar.length} {itemsAMostrar.length === 1 ? 'cobro' : 'cobros'}
            </span>
          </div>

          <ul className="m-0 flex list-none flex-col p-0">
            {itemsAMostrar.map((item) => {
              const detalle = [item.referencia, item.hora, item.motivoTexto]
                .filter(Boolean)
                .join(' · ')

              const contenido = (
                <div className="flex items-center gap-3 py-3 border-t border-[#E2D8C4]">
                  <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                    <span className="font-bold text-[16px] text-[#13203A] truncate">
                      {item.nombre}
                    </span>
                    <span className="text-[14px] text-[#4A5468] truncate">
                      {detalle}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-bold text-[16px] text-[#13203A]">
                      {item.monto}
                    </span>
                    <EstadoCobro estado={item.estado} soloEstado />
                  </div>
                </div>
              )

              return (
                <li key={item.id}>
                  {item.id.startsWith('demo-') ? (
                    contenido
                  ) : (
                    <Link
                      to={`/punto/cobros/${item.id}`}
                      className="block text-foreground no-underline"
                    >
                      {contenido}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {/* Banner de seguridad Móvil */}
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#EDE5D3] p-3 text-[15px] leading-snug text-[#13203A] mt-auto">
          <ShieldCheck aria-hidden className="size-5 shrink-0 text-[#13203A]" />
          <span>Entrega efectivo solo cuando la pantalla diga Pagado.</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VERSION COMPUTADOR / PC (>= 768px): Exacta a PD0
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-6 w-full">
        {/* 3 Tarjetas KPI Computador */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-5 text-[#13203A]">
            <span className="text-[16px] font-semibold text-[#13203A]">Retiros pagados hoy</span>
            <span className="text-[38px] font-extrabold tracking-tight leading-tight text-[#13203A]">
              {totalEntregadoTxt}
            </span>
            <span className="text-[15px] text-[#4A5468]">
              {itemsAMostrar.filter((x) => x.estado === 'Pagado').length} retiro
            </span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-5 text-[#13203A]">
            <span className="text-[16px] font-semibold text-[#13203A]">Te reembolsaron</span>
            <span className="text-[38px] font-extrabold tracking-tight leading-tight text-[#13203A]">
              {totalEntregadoTxt}
            </span>
            <span className="text-[15px] text-[#4A5468]">
              Todo lo pagado ya está en tu billetera
            </span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-[20px] border-[1.5px] border-[#13203A] bg-[#13203A] p-5 text-[#F5F0E6]">
            <span className="text-[16px] font-semibold text-[#F5F0E6]">Adelantado de tu caja</span>
            <span className="text-[38px] font-extrabold tracking-tight leading-tight text-[#F6A623]">
              {adelantadoTxt}
            </span>
            <span className="text-[15px] text-[#C9C2B3]">Nada por recuperar</span>
          </div>
        </div>

        {/* 2 Columnas PC: Formulario Izquierda + Tabla Derecha */}
        <div className="flex flex-wrap gap-6 items-start">
          {/* Columna Izquierda: el cobro se hace aquí mismo (cédula → pagos → Pagar) */}
          <div className="flex-1 basis-[380px] max-w-[440px] flex flex-col gap-4 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            {!nuevo.consulta ? (
              <>
                <h2 className="m-0 text-[24px] font-extrabold tracking-tight text-[#13203A]">Nuevo cobro</h2>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void nuevo.consultar()
                  }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1">
                    <label htmlFor="cedula-desktop-input" className="text-[17px] font-bold text-[#13203A]">
                      Número de cédula
                    </label>
                    <span className="text-[15px] text-[#4A5468]">Pide la cédula original y digita el número.</span>
                  </div>

                  <input
                    id="cedula-desktop-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatearCedula(nuevo.cedula)}
                    onChange={(e) => {
                      nuevo.setCedula(e.target.value.replace(/\D/g, ''))
                      nuevo.setError(null)
                    }}
                    placeholder="71 234 567"
                    className="w-full h-16 px-4 rounded-[14px] border-2 border-[#13203A] bg-white font-bold text-[28px] text-[#13203A] tracking-wider outline-none focus:ring-2 focus:ring-[#2E5FE0]"
                  />

                  {nuevo.error && <div className="rounded-xl bg-[#F8E4DF] p-3 text-sm font-medium text-[#A3261C]">{nuevo.error}</div>}

                  <button
                    type="submit"
                    disabled={!nuevo.cedula || nuevo.enviando}
                    className="flex h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-[#2E5FE0] font-bold text-[18px] text-white shadow-sm transition-all hover:bg-[#254ec4] active:scale-[0.99] disabled:opacity-50"
                  >
                    {nuevo.enviando ? 'Consultando…' : 'Consultar'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] text-[#4A5468]">{nuevo.consulta.persona.etiqueta}</span>
                  <h2 className="m-0 text-[24px] font-extrabold tracking-tight text-[#13203A]">Pagos de {nuevo.consulta.persona.nombre}</h2>
                </div>
                <p className="m-0 text-[15px] text-[#13203A]">
                  {nuevo.consulta.pagos.length === 0 ? (
                    'No tiene pagos disponibles.'
                  ) : (
                    <>
                      Tiene <b>{nuevo.consulta.pagos.length} {nuevo.consulta.pagos.length === 1 ? 'pago disponible' : 'pagos disponibles'}</b>. Antes del PIN no se mueve dinero.
                    </>
                  )}
                </p>

                {nuevo.consulta.pagos.map((pg) => (
                  <div key={pg.programa.id} className="flex flex-col gap-2 rounded-2xl border-2 border-[#13203A] bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[17px] font-bold">{pg.programa.nombre}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FCE3B4] px-2.5 py-0.5 text-[13px] font-bold">
                        <Clock className="size-3.5 stroke-[2.5]" />
                        Disponible
                      </span>
                    </div>
                    <span className="text-[34px] font-extrabold leading-none tracking-tight">{textoMonto(pg.monto, pg.moneda)}</span>
                    <span className="text-[14px] text-[#4A5468]">Se entrega el valor completo</span>
                    <button
                      type="button"
                      disabled={nuevo.enviando}
                      onClick={() => void nuevo.pagar(pg.programa.id)}
                      className="mt-1 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[#2E5FE0] font-bold text-[17px] text-white transition-all hover:bg-[#254ec4] disabled:opacity-50"
                    >
                      {nuevo.enviando ? 'Iniciando…' : 'Pagar este subsidio'}
                    </button>
                  </div>
                ))}

                {nuevo.error && <div className="rounded-xl bg-[#F8E4DF] p-3 text-sm font-medium text-[#A3261C]">{nuevo.error}</div>}

                <button
                  type="button"
                  onClick={nuevo.otraCedula}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-[#13203A] font-bold text-[16px] text-[#13203A] hover:bg-[#13203A]/5"
                >
                  Otra cédula
                </button>
              </>
            )}

            <div className="flex items-start gap-3 rounded-[14px] bg-[#EDE5D3] p-3.5 text-[15px] leading-snug text-[#13203A]">
              <ShieldCheck aria-hidden className="size-6 shrink-0 text-[#13203A] mt-0.5" />
              <p className="m-0">Entrega efectivo solo cuando la pantalla diga Pagado. La cédula sola no autoriza el cobro.</p>
            </div>
          </div>

          {/* Columna Derecha: Tabla Cobros de hoy PC */}
          <div className="flex-[999] basis-[560px] min-w-0 flex flex-col gap-4 rounded-[20px] border-[1.5px] border-[#E2D8C4] bg-[#FFFDF8] p-6 text-[#13203A]">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[21px] font-extrabold text-[#13203A]">
                Cobros de hoy
              </h2>
              <span className="text-[15px] text-[#4A5468]">
                {itemsAMostrar.length} cobros · 0 en curso
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
                  {itemsAMostrar.map((item) => (
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
                        <div className="flex flex-col gap-0.5">
                          <EstadoCobro estado={item.estado} soloEstado />
                          {item.motivoTexto && (
                            <span className="text-[13px] text-[#4A5468]">
                              {item.motivoTexto}
                            </span>
                          )}
                        </div>
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
      </div>
    </MarcoPuntoRetiro>
  )
}

const COP = { codigo: 'COP', escala: 2 }

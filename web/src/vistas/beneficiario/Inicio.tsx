import { Check, ChevronRight, Clock, CreditCard, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { formatFecha } from '@/lib/textos'

import { TarjetaCobrado } from './Historial'
import { useResumen } from './useResumen'

function Opcion({ to, icono, titulo, texto }: { to: string; icono: ReactNode; titulo: string; texto: string }) {
  return (
    <Link to={to} className="flex min-h-20 items-center gap-3.5 rounded-[14px] border border-control px-4 py-3.5 text-foreground no-underline hover:bg-muted hover:text-foreground">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary [&_svg]:size-[22px]">
        {icono}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <strong className="text-xl">{titulo}</strong>
        <span className="text-[15px] text-muted-foreground">{texto}</span>
      </span>
      <ChevronRight aria-hidden className="size-[22px]" />
    </Link>
  )
}

export default function Inicio() {
  const { datos: r, error, recargar } = useResumen()

  return (
    <MarcoBeneficiario ancho="ancho">
      {!r && error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!r && !error && <Cargando />}
      {r && (
        <>
          <Titulo className="text-[26px] md:text-[32px]">Hola, {r.persona.nombre}</Titulo>

          {/* En PC: a la izquierda el saldo y cómo cobrarlo; a la derecha, la cuenta y el último cobro. */}
          <div className="grid items-start gap-[18px] md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-8">
          <div className="flex min-w-0 flex-col gap-[18px]">
          {r.pago ? (
            <>
              <section className="flex flex-col gap-1 rounded-2xl border-2 border-foreground p-[22px]">
                <span className="text-lg">Tienes</span>
                <span className="text-[44px] leading-[1.05] font-bold [overflow-wrap:anywhere] min-[380px]:text-[52px]">{textoMonto(r.pago.monto, r.pago.moneda)}</span>
                <span className="text-[17px] text-muted-foreground">{r.pago.programa.nombre}</span>
                <span className="mt-2 flex items-center gap-1.5">
                  <Clock aria-hidden className="size-[18px] shrink-0" />
                  Puedes cobrarlo hasta el {formatFecha(r.pago.vigenciaFin)}
                </span>
              </section>
              {r.pago.programa.estado === 'Pausado' && (
                <p className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 text-pagando">
                  La entidad pausó los cobros por un momento. Intenta más tarde.
                </p>
              )}

              <h2 className="mt-1 mb-0 text-[21px] font-bold">¿Cómo lo quieres cobrar?</h2>
              <Opcion
                to={r.cuenta?.estado === 'Verificada' ? '/beneficiario/cobrar' : '/beneficiario/cuenta'}
                icono={<CreditCard />}
                titulo="A mi cuenta"
                texto={r.cuenta?.estado === 'Verificada' ? 'Llega en segundos a tu billetera' : 'Primero enlaza tu billetera'}
              />
              <Opcion
                to="/beneficiario/puntos"
                icono={<Store />}
                titulo="En un punto"
                texto={r.persona.tienePin ? 'En efectivo, con tu cédula y tu PIN' : 'Solo si registraste un PIN'}
              />
            </>
          ) : r.ultimoCobro ? (
            <TarjetaCobrado cobro={r.ultimoCobro} />
          ) : (
            <section className="flex flex-col gap-2 rounded-2xl border border-control p-[22px]">
              <h2 className="m-0 text-xl font-bold">Todavía no tienes pagos disponibles</h2>
              <p className="m-0 text-muted-foreground">Cuando la entidad active tu subsidio, lo verás aquí.</p>
            </section>
          )}
          </div>

          <aside className="flex min-w-0 flex-col gap-[18px]">
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[15px] text-muted-foreground md:rounded-2xl md:border md:border-border md:p-5">
            {r.cuenta?.estado === 'Verificada' ? (
              <>
                <Check aria-hidden className="size-4 text-pagado" strokeWidth={2.5} />
                <span>
                  Tu cuenta <BilleteraCorta url={r.cuenta.billetera} /> está verificada.
                </span>
                <Link to="/beneficiario/cuenta" className="inline-flex min-h-11 items-center">
                  Cambiar
                </Link>
              </>
            ) : (
              <>
                <span>{r.cuenta?.estado === 'PorVerificar' ? 'Tu cuenta está por verificar.' : 'Todavía no tienes una cuenta enlazada.'}</span>
                <Link to="/beneficiario/cuenta" className="inline-flex min-h-11 items-center">
                  Enlazar mi cuenta
                </Link>
              </>
            )}
          </p>
          {/* En PC sobra espacio: el último cobro también se ve cuando hay un pago nuevo. */}
          {r.pago && r.ultimoCobro && (
            <div className="hidden md:block">
              <TarjetaCobrado cobro={r.ultimoCobro} />
            </div>
          )}
          </aside>
          </div>
        </>
      )}
    </MarcoBeneficiario>
  )
}

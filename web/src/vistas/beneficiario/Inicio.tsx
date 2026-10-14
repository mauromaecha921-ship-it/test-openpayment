import { Check, ChevronRight, Clock, CreditCard, ShoppingBag, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { PagoPendiente } from '@/api/tipos'
import { Cargando, ErrorCarga } from '@/componentes/Comun'
import { CuentaDestino } from '@/componentes/CuentaDestino'
import { MarcoBeneficiario } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { sumarMontos } from '@/lib/montos'
import { formatFecha } from '@/lib/textos'

import { TarjetaCobrado } from './Historial'
import { useResumen } from './useResumen'

/** Colores del ícono, como en la entrada del prototipo: cuenta en azul, punto y comercio en ámbar. */
const COLOR_OPCION = {
  cuenta: 'bg-primary text-primary-foreground',
  punto: 'bg-ambar text-noche',
}

function Opcion({ to, icono, color, titulo, texto }: { to: string; icono: ReactNode; color: keyof typeof COLOR_OPCION; titulo: string; texto: string }) {
  return (
    <Link to={to} className="flex min-h-20 items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 text-foreground no-underline hover:border-control hover:text-foreground">
      <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[22px] ${COLOR_OPCION[color]}`}>
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

function AvisoPausa() {
  return (
    <p className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 text-pagando">
      La entidad pausó los cobros por un momento. Intenta más tarde.
    </p>
  )
}

/**
 * «A mi cuenta» va a cobrar aunque no haya cuenta enlazada: la API prueba la cédula como llave Bre-B
 * (Plan Bre-B, RN-17). Solo una wallet que espera la aprobación en el banco manda a terminarla.
 */
function rutaCuenta(porVerificar: boolean, programaId: string) {
  return porVerificar ? '/beneficiario/cuenta' : `/beneficiario/cobrar?programa=${programaId}`
}

/** Subsidios en varios programas: cada uno en su tarjeta, con sus dos formas de cobrarlo. */
function VariosPagos({ pagos, porVerificar, tienePin }: { pagos: PagoPendiente[]; porVerificar: boolean; tienePin: boolean }) {
  const misma = pagos.every((p) => p.moneda.codigo === pagos[0]!.moneda.codigo)
  return (
    <>
      <section className="bloque flex flex-col gap-1 rounded-2xl p-[22px]">
        <span className="text-lg font-bold">Tienes {pagos.length} subsidios por cobrar</span>
        {misma && (
          <span className="cifra text-[40px] [overflow-wrap:anywhere]">
            {textoMonto(sumarMontos(...pagos.map((p) => p.monto)), pagos[0]!.moneda)}
          </span>
        )}
        <span className="text-[15px] text-noche-tenue">Cada uno se cobra por separado: a tu cuenta o en un punto.</span>
      </section>
      <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" aria-label="Subsidios por cobrar">
        {pagos.map((p) => (
          <li key={p.programa.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[17px] font-bold">{p.programa.nombre}</span>
              <span className="cifra text-[32px]">{textoMonto(p.monto, p.moneda)}</span>
              <span className="flex items-center gap-1.5 text-[15px] text-muted-foreground">
                <Clock aria-hidden className="size-4 shrink-0" />
                Hasta el {formatFecha(p.vigenciaFin)}
              </span>
            </div>
            {p.programa.estado === 'Pausado' ? (
              <AvisoPausa />
            ) : p.programa.tipo === 'bono' ? (
              // § 11: un bono con destino no se cobra: se usa al pagar en un comercio autorizado
              <Button asChild className="mt-auto">
                <Link to={`/beneficiario/bono/${p.programa.id}`}>
                  <ShoppingBag aria-hidden />
                  Dónde usar el bono
                </Link>
              </Button>
            ) : (
              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild className="flex-1">
                  <Link to={rutaCuenta(porVerificar, p.programa.id)}>
                    <CreditCard aria-hidden />A mi cuenta
                  </Link>
                </Button>
                {tienePin && (
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/beneficiario/puntos">
                      <Store aria-hidden />
                      En un punto
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
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
          {r.pagos.length === 1 && r.pago ? (
            <>
              <section className="bloque flex flex-col gap-1 rounded-2xl p-[22px]">
                <span className="text-[17px] font-bold">Tienes por cobrar · {r.pago.programa.nombre}</span>
                <span className="cifra text-[40px] [overflow-wrap:anywhere] min-[380px]:text-[46px] md:text-[52px]">{textoMonto(r.pago.monto, r.pago.moneda)}</span>
                <span className="mt-1 flex items-center gap-1.5 text-ambar">
                  <Clock aria-hidden className="size-[18px] shrink-0" />
                  Cóbralo hasta el {formatFecha(r.pago.vigenciaFin)}
                </span>
              </section>
              {r.pago.programa.estado === 'Pausado' && <AvisoPausa />}

              {r.pago.programa.tipo === 'bono' ? (
                <>
                  <h2 className="mt-1 mb-0 text-[21px] font-bold">Es un bono con destino</h2>
                  <Opcion
                    to={`/beneficiario/bono/${r.pago.programa.id}`}
                    icono={<ShoppingBag />}
                    color="punto"
                    titulo="Úsalo en un comercio autorizado"
                    texto={r.persona.tienePin ? 'Al pagar tu compra, con tu cédula y tu PIN' : 'Necesitas un PIN para usarlo'}
                  />
                </>
              ) : (
                <>
                  <h2 className="mt-1 mb-0 text-[21px] font-bold">¿Cómo lo quieres cobrar?</h2>
                  <Opcion
                    to={rutaCuenta(r.cuenta?.estado === 'PorVerificar', r.pago.programa.id)}
                    icono={<CreditCard />}
                    color="cuenta"
                    titulo="A mi cuenta"
                    texto={
                      r.cuenta?.estado === 'Verificada'
                        ? 'Llega en segundos a tu cuenta'
                        : r.cuenta?.estado === 'PorVerificar'
                          ? 'Termina de verificar tu billetera'
                          : 'Con tu cédula como llave Bre-B, sin enlazar nada'
                    }
                  />
                  <Opcion
                    to="/beneficiario/puntos"
                    icono={<Store />}
                    color="punto"
                    titulo="En un punto"
                    texto={r.persona.tienePin ? 'En efectivo, con tu cédula y tu PIN' : 'Solo si registraste un PIN'}
                  />
                </>
              )}
            </>
          ) : r.pagos.length > 1 ? (
            <VariosPagos pagos={r.pagos} porVerificar={r.cuenta?.estado === 'PorVerificar'} tienePin={r.persona.tienePin} />
          ) : r.ultimoCobro ? (
            <TarjetaCobrado cobro={r.ultimoCobro} />
          ) : (
            <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-[22px]">
              <h2 className="m-0 text-xl font-bold">Todavía no tienes pagos disponibles</h2>
              <p className="m-0 text-muted-foreground">Cuando la entidad active tu subsidio, lo verás aquí.</p>
            </section>
          )}
          </div>

          <aside className="flex min-w-0 flex-col gap-[18px]">
          <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-0 rounded-2xl bg-muted px-4 py-2.5 text-[15px] text-foreground md:p-5">
            <CreditCard aria-hidden className="mr-1 size-[18px] shrink-0" />
            {r.cuenta?.estado === 'Verificada' ? (
              <>
                <Check aria-hidden className="size-4 text-pagado" strokeWidth={2.5} />
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  Tu cuenta <CuentaDestino cuenta={r.cuenta} /> está verificada.
                </span>
                <Link to="/beneficiario/cuenta" className="inline-flex min-h-11 items-center">
                  Cambiar
                </Link>
              </>
            ) : (
              <>
                <span>
                  {r.cuenta?.estado === 'PorVerificar'
                    ? 'Tu cuenta está por verificar.'
                    : 'Todavía no tienes una cuenta enlazada. Si tu cédula es tu llave Bre-B, cobras sin enlazar nada.'}
                </span>
                <Link to="/beneficiario/cuenta" className="inline-flex min-h-11 items-center">
                  {r.cuenta?.estado === 'PorVerificar' ? 'Enlazar mi cuenta' : 'Enlazar otra llave'}
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

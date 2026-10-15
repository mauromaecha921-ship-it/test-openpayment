import { Ban, Check, ChevronLeft, Clock, Landmark, Lock, type LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

import type { EstadoCobro, Motivo } from '@/api/tipos'
import { MOTIVO_CORTO } from '@/lib/textos'
import { cn } from '@/lib/utils'

import { Titulo } from './Titulo'

// Piezas del prototipo del equipo (D:\PRE-Hackathon\FRORNT Y ESTILO VISUAL\tatu-prototipo.html),
// con sus medidas exactas. Los colores van por tokens para que el modo oscuro siga funcionando
// (Plan apego al prototipo § 3).

// ── Pantalla de celular ───────────────────────────────────────────────────────

/** `.screen.phone`: columna de 480 px como máximo, con borde a los lados desde 560 px. */
export function PantallaCelular({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          'mx-auto box-border flex min-h-dvh w-full max-w-[480px] flex-col gap-4 bg-background px-5 pt-[18px] pb-6 text-foreground tabular-nums min-[560px]:border-x min-[560px]:border-border',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** «Dinero de prueba», como en el prototipo. Lleva a /estado, que dice si los pagos son reales. */
export function PastillaPrueba({ sobreBloque = false }: { sobreBloque?: boolean }) {
  return (
    <Link
      to="/estado"
      title="Todo usa la Interledger Test Wallet. Mira el estado de los pagos"
      className={cn(
        'flex-none rounded-full border-[1.5px] px-2.5 py-[5px] text-[13px] font-semibold no-underline',
        sobreBloque ? 'border-bloque-texto text-bloque-texto hover:text-bloque-texto' : 'border-foreground text-foreground hover:text-foreground',
      )}
    >
      Dinero de prueba
    </Link>
  )
}

const claseCuadroVolver =
  'flex size-11 flex-none items-center justify-center rounded-xl border-[1.5px] border-border bg-card text-foreground hover:text-foreground'

/**
 * Cabecera del celular: ‹ en un cuadro de 44 px, luego el logo con «Tatú» (inicio de un rol) o el
 * título con su subtítulo, y «Dinero de prueba» a la derecha.
 */
export function CabeceraCelular({
  volver,
  etiquetaVolver = 'Volver',
  alVolver,
  titulo,
  subtitulo,
  marca = false,
}: {
  volver?: string
  etiquetaVolver?: string
  alVolver?: () => void
  titulo?: string
  subtitulo?: ReactNode
  marca?: boolean
}) {
  const icono = <ChevronLeft aria-hidden className="size-6" strokeWidth={2.4} />
  return (
    <header className="flex items-center gap-2.5">
      {alVolver ? (
        <button type="button" aria-label={etiquetaVolver} onClick={alVolver} className={claseCuadroVolver}>
          {icono}
        </button>
      ) : (
        volver && (
          <Link to={volver} aria-label={etiquetaVolver} className={claseCuadroVolver}>
            {icono}
          </Link>
        )
      )}
      {marca ? (
        <>
          <LogoChico className="w-8" />
          <span className="marca text-[21px] [line-height:normal]">Tatú</span>
        </>
      ) : (
        <div className="flex min-w-0 flex-col">
          <span className="text-lg leading-[1.2] font-extrabold">{titulo}</span>
          {subtitulo && <span className="truncate text-sm text-muted-foreground">{subtitulo}</span>}
        </div>
      )}
      <span className="ml-auto flex-none">
        <PastillaPrueba />
      </span>
    </header>
  )
}

/** El ícono del logo: el de trazo Noche en claro y el oscuro (con su fondo) en modo oscuro. */
export function LogoChico({ className, sobreBloque = false }: { className?: string; sobreBloque?: boolean }) {
  return (
    <>
      <img src="/marca/tatu-icono-pequeno.svg" alt="" aria-hidden className={cn('h-auto flex-none oscuro:hidden', sobreBloque && 'hidden', className)} />
      <img
        src="/marca/tatu-logo-oscuro.svg"
        alt=""
        aria-hidden
        className={cn('hidden h-auto flex-none rounded-lg oscuro:block', sobreBloque && 'block', className)}
      />
    </>
  )
}

// ── Pantalla de escritorio (entidad y punto) ──────────────────────────────────

export interface PestanaEscritorio {
  to: string
  texto: string
  fin?: boolean
}

/**
 * Barra Noche del prototipo (contenido de 1.240 px) y, debajo, el botón ‹, el subtítulo y el
 * título de 34 px. `acciones` va a la derecha del título.
 */
export function PantallaEscritorio({
  pestanas,
  quien,
  volver,
  subtitulo,
  titulo,
  junto,
  acciones,
  children,
  sinContenedor = false,
}: {
  pestanas: PestanaEscritorio[]
  quien: string
  volver?: { to: string; texto: string }
  subtitulo?: ReactNode
  titulo?: ReactNode
  /** Un chip junto al título («Activo»). */
  junto?: ReactNode
  acciones?: ReactNode
  children: ReactNode
  /** Para el modal de cerrar: el contenido ocupa todo el ancho. */
  sinContenedor?: boolean
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground tabular-nums">
      <header className="bloque">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-6 px-8 py-3 max-sm:px-4">
          <Link to="/" aria-label="Volver a elegir rol" className="flex items-center gap-2.5 text-bloque-texto no-underline hover:text-bloque-texto">
            <LogoChico sobreBloque className="w-[38px]" />
            <span className="marca text-2xl [line-height:normal]">Tatú</span>
          </Link>
          <nav aria-label="Secciones" className="flex flex-wrap gap-[22px]">
            {pestanas.map((p) => (
              <NavLink
                key={p.to}
                to={p.to}
                end={p.fin}
                className={({ isActive }) =>
                  cn(
                    'border-b-[3px] px-0.5 py-2.5 text-base text-bloque-texto no-underline hover:text-bloque-texto',
                    isActive ? 'border-ambar font-bold' : 'border-transparent font-medium',
                  )
                }
              >
                {p.texto}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3.5">
            <PastillaPrueba sobreBloque />
            <span className="text-[15px]">{quien}</span>
          </div>
        </div>
      </header>
      {sinContenedor ? (
        children
      ) : (
        <main className="mx-auto box-border flex w-full max-w-[1240px] flex-col gap-[22px] px-8 pt-6 pb-14 max-sm:px-4">
          {volver && <BotonVolver to={volver.to}>{volver.texto}</BotonVolver>}
          {(titulo || subtitulo) && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                {subtitulo && <span className="text-[15px] text-muted-foreground">{subtitulo}</span>}
                <TituloPantalla className="text-[34px] max-[880px]:text-[28px]">{titulo}</TituloPantalla>
              </div>
              {junto}
              {acciones && <div className="ml-auto flex flex-wrap gap-3">{acciones}</div>}
            </div>
          )}
          {children}
        </main>
      )}
    </div>
  )
}

/** «‹ Tus programas»: el botón de volver del escritorio. */
export function BotonVolver({ to, children, onClick }: { to?: string; children: ReactNode; onClick?: () => void }) {
  const clase =
    'inline-flex min-h-11 items-center gap-2 self-start rounded-xl border-[1.5px] border-border bg-card py-0 pr-3.5 pl-2 text-base font-bold text-foreground no-underline hover:text-foreground'
  const icono = <ChevronLeft aria-hidden className="size-[22px]" strokeWidth={2.4} />
  if (onClick || !to) {
    return (
      <button type="button" onClick={onClick} className={clase}>
        {icono}
        {children}
      </button>
    )
  }
  return (
    <Link to={to} className={clase}>
      {icono}
      {children}
    </Link>
  )
}

// ── Títulos ───────────────────────────────────────────────────────────────────

/** h1 del prototipo: 800 al 125 % (el foco va aquí al cambiar de pantalla). */
export function TituloPantalla({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Titulo base="titulo-proto" className={className}>
      {children}
    </Titulo>
  )
}

// ── Botones ───────────────────────────────────────────────────────────────────

type VarianteBoton = 'primario' | 'contorno' | 'peligro'

const VARIANTE: Record<VarianteBoton, string> = {
  primario: 'border-primary bg-primary text-white hover:bg-[#2450c4] hover:text-white',
  contorno: 'border-foreground bg-transparent text-foreground hover:bg-muted hover:text-foreground',
  peligro: 'border-rechazo-relleno bg-rechazo-relleno text-white hover:bg-[#7f1d16] hover:text-white',
}

/** Botón de celular: 56 px, radio 14, 18 px 700. `medio`: el de escritorio (48 px, radio 12, 17 px). */
export function claseBoton(variante: VarianteBoton = 'primario', medio = false) {
  return cn(
    'inline-flex items-center justify-center gap-2 border-2 font-bold no-underline disabled:pointer-events-none disabled:opacity-50',
    medio ? 'min-h-12 rounded-xl px-[22px] text-[17px]' : 'min-h-14 w-full rounded-[14px] px-4 text-lg',
    variante === 'primario' && !medio && 'border-0',
    VARIANTE[variante],
  )
}

export function Boton({
  variante = 'primario',
  medio = false,
  className,
  ...resto
}: ComponentProps<'button'> & { variante?: VarianteBoton; medio?: boolean }) {
  return <button type="button" className={cn(claseBoton(variante, medio), className)} {...resto} />
}

export function BotonEnlace({
  variante = 'primario',
  medio = false,
  className,
  ...resto
}: ComponentProps<typeof Link> & { variante?: VarianteBoton; medio?: boolean }) {
  return <Link className={cn(claseBoton(variante, medio), className)} {...resto} />
}

/** «Ir al inicio», «Cancelar cobro»: texto subrayado de 44 px de alto. */
export function claseEnlaceSuave() {
  return 'flex min-h-11 items-center justify-center text-[17px] font-semibold text-foreground underline underline-offset-[3px] hover:text-foreground'
}

// ── Tarjetas, filas y avisos ──────────────────────────────────────────────────

/** Tarjeta del prototipo: fondo crema, borde de 1,5 px y radio 18 (celular) o 20 con 24 px (escritorio). */
export function Caja({ children, className, grande = false, as: Etiqueta = 'div' }: { children: ReactNode; className?: string; grande?: boolean; as?: 'div' | 'section' }) {
  return (
    <Etiqueta className={cn('flex min-w-0 flex-col border-[1.5px] border-border bg-card', grande ? 'gap-4 rounded-[20px] p-6' : 'gap-2.5 rounded-[18px] p-4', className)}>
      {children}
    </Etiqueta>
  )
}

/** «Cuenta que paga ··· /entidad»: etiqueta a la izquierda, dato a la derecha. */
export function FilaDato({ etiqueta, children }: { etiqueta: ReactNode; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-base">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

/** Tarjeta de cifra del escritorio: radio 20, cifra de 38 px; `noche` la pinta en Noche y ámbar. */
export function TarjetaCifra({ etiqueta, children, apoyo, noche = false }: { etiqueta: string; children: ReactNode; apoyo?: ReactNode; noche?: boolean }) {
  return (
    <div className={cn('flex flex-[1_1_220px] flex-col gap-1.5 rounded-[20px] border-[1.5px] px-[22px] py-5', noche ? 'bloque border-bloque' : 'border-border bg-card')}>
      <span className="text-base font-semibold">{etiqueta}</span>
      <span className={cn('cifra text-[38px] leading-[1.05] [overflow-wrap:anywhere]', noche && 'text-ambar')}>{children}</span>
      {apoyo && <span className={cn('text-[15px]', noche ? 'text-noche-tenue' : 'text-muted-foreground')}>{apoyo}</span>}
    </div>
  )
}

/** Recuadro arena con ícono: «Entrega efectivo solo cuando la pantalla diga Pagado». */
export function AvisoArena({ icono: Icono, children, className }: { icono: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl bg-muted p-3.5 text-base leading-[1.4]', className)}>
      <Icono aria-hidden className="mt-px size-[22px] flex-none" strokeWidth={2} />
      <p className="m-0">{children}</p>
    </div>
  )
}

/** Nota gris con ícono, sin fondo («Al elegir un pago, Jorge confirma con su PIN…»). */
export function NotaGris({ icono: Icono = Lock, children, className }: { icono?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 text-[15px] leading-[1.4] text-muted-foreground', className)}>
      <Icono aria-hidden className="mt-0.5 size-[18px] flex-none" strokeWidth={2} />
      <span>{children}</span>
    </div>
  )
}

/** Número en círculo: lleno (Noche o ámbar) o con borde. */
export function NumeroCirculo({ n, tono = 'noche', className }: { n: number; tono?: 'noche' | 'ambar' | 'borde'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[30px] flex-none items-center justify-center rounded-full font-extrabold',
        tono === 'noche' && 'bg-foreground text-background',
        tono === 'ambar' && 'bg-ambar text-noche',
        tono === 'borde' && 'border-2 border-foreground',
        className,
      )}
    >
      {n}
    </span>
  )
}

// ── Chips ─────────────────────────────────────────────────────────────────────

type TonoChip = 'pagado' | 'rechazo' | 'disponible' | 'neutro' | 'activo' | 'cerrado' | 'pagando'

const TONO_CHIP: Record<TonoChip, string> = {
  pagado: 'bg-pagado-relleno text-white',
  rechazo: 'bg-rechazo-fondo text-rechazo',
  disponible: 'bg-pagando-fondo text-foreground',
  neutro: 'bg-pista text-foreground',
  activo: 'bg-activo-fondo text-activo',
  cerrado: 'bg-cerrado text-[#f5f0e6]',
  pagando: 'bg-pagando-fondo text-pagando',
}

/** Chip del prototipo: 13 px 700, radio 999, con su ícono. `grande`: 14 px (junto a un título). */
export function Chip({ tono, icono: Icono, children, grande = false, className }: { tono: TonoChip; icono?: LucideIcon; children: ReactNode; grande?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-[5px] self-start rounded-full font-bold whitespace-nowrap',
        grande ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-[13px]',
        TONO_CHIP[tono],
        className,
      )}
    >
      {Icono && <Icono aria-hidden className="size-3.5" strokeWidth={2.5} />}
      {children}
    </span>
  )
}

const CHIP_COBRO: Record<EstadoCobro, { tono: TonoChip; icono: LucideIcon; texto: string }> = {
  Solicitado: { tono: 'neutro', icono: Clock, texto: 'Solicitado' },
  PorConfirmar: { tono: 'neutro', icono: Clock, texto: 'Por confirmar' },
  Pagando: { tono: 'pagando', icono: Clock, texto: 'Pagando' },
  Pagado: { tono: 'pagado', icono: Check, texto: 'Pagado' },
  Rechazado: { tono: 'rechazo', icono: Ban, texto: 'Rechazado' },
  Fallido: { tono: 'rechazo', icono: Landmark, texto: 'Fallido' },
}

/** El estado de un cobro como chip del prototipo; `conMotivo` agrega «· Ya cobrado». */
export function ChipCobro({ estado, motivo, conMotivo = false, grande = false }: { estado: EstadoCobro; motivo?: Motivo | null; conMotivo?: boolean; grande?: boolean }) {
  const c = CHIP_COBRO[estado]
  const corto = conMotivo && motivo ? (MOTIVO_CORTO[motivo.codigo] ?? motivo.mensaje) : null
  return (
    <Chip tono={c.tono} icono={c.icono} grande={grande}>
      {c.texto}
      {corto && ` · ${corto}`}
    </Chip>
  )
}

// ── Pasos del cobro en el punto ───────────────────────────────────────────────

const PASOS = ['Cédula', 'Pago', 'PIN', 'Resultado'] as const
export type PasoPunto = (typeof PASOS)[number]

/** Cédula · Pago · PIN · Resultado: barra de 4 px y el nombre debajo, como en el prototipo. */
export function PasosCobroPunto({ paso }: { paso: PasoPunto }) {
  const actual = PASOS.indexOf(paso)
  return (
    <ol aria-label={`Paso ${actual + 1} de 4`} className="m-0 flex list-none gap-1.5 p-0">
      {PASOS.map((texto, i) => (
        <li key={texto} aria-current={i === actual ? 'step' : undefined} className="flex flex-1 flex-col gap-1">
          <span aria-hidden className={cn('h-1 rounded', i <= actual ? 'bg-foreground' : 'bg-border')} />
          <span className={cn('text-[13px]', i <= actual ? 'text-foreground' : 'text-muted-foreground', i === actual ? 'font-bold' : 'font-medium')}>{texto}</span>
        </li>
      ))}
    </ol>
  )
}

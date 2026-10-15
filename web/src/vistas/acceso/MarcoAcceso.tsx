import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Titulo } from '@/componentes/Titulo'

interface Props {
  /** Panel izquierdo (solo en pantallas anchas). */
  titular: string
  texto: string
  titulo: string
  intro: string
  children: ReactNode
}

/**
 * Pantalla de acceso de un rol (LD1, LD2 y L1 del prototipo): a la izquierda el panel Noche con la
 * promesa; a la derecha, el formulario. En el celular queda solo el formulario, con la marca arriba.
 */
export function MarcoAcceso({ titular, texto, titulo, intro, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="bloque hidden flex-[1_1_40%] flex-col justify-between gap-6 px-12 py-14 md:flex">
        <Marca grande />
        <div className="flex max-w-[460px] flex-col gap-4">
          <h2 className="titular m-0 text-[34px] lg:text-[38px]">{titular}</h2>
          <p className="m-0 text-lg leading-normal text-noche-tenue">{texto}</p>
        </div>
        <span className="self-start rounded-full border-[1.5px] border-bloque-texto px-3 py-1.5 text-sm font-bold">Dinero de prueba</span>
      </aside>

      <main className="flex flex-[1_1_60%] flex-col px-5 py-4 md:items-center md:justify-center md:px-8 md:py-12">
        <div className="flex items-center justify-between md:hidden">
          <Marca />
          <span className="rounded-full border-[1.5px] border-foreground px-2.5 py-0.5 text-[13px] font-bold">Dinero de prueba</span>
        </div>
        <div className="flex w-full max-w-[480px] flex-1 flex-col gap-5 pt-3 md:flex-none md:pt-0">
          <Link to="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 font-bold text-foreground no-underline hover:text-foreground">
            <ChevronLeft aria-hidden className="size-[22px]" strokeWidth={2.4} />
            Cambiar de rol
          </Link>
          <div className="flex flex-col gap-2">
            <Titulo className="text-[30px] md:text-[34px]">{titulo}</Titulo>
            <p className="m-0 text-[17px] leading-snug">{intro}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

function Marca({ grande }: { grande?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <img src="/marca/tatu-logo-oscuro.svg" alt="" className={grande ? 'size-12 rounded-2xl' : 'size-10 rounded-xl'} />
      <span className={`marca ${grande ? 'text-3xl' : 'text-2xl'}`}>Tatú</span>
    </span>
  )
}

/** Recuadro con candado que cierra el formulario. */
export function NotaAcceso({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2.5 rounded-[14px] bg-muted px-4 py-3.5 text-[15px] leading-snug">{children}</div>
}

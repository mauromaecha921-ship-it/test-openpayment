import { useState } from 'react'

import { MarcoRol } from '@/componentes/Marcos'
import { TatuAnimado, type EstadoTatu } from '@/componentes/TatuAnimado'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'

const VARIANTES = [
  { id: 'rodar', titulo: 'A · Solo rodar', texto: 'Rueda mientras paga; al quedar pagado termina la vuelta y se detiene derecho.' },
  {
    id: 'cerradura',
    titulo: 'B · Rodar y abrir la cerradura',
    texto: 'Además la cerradura late mientras paga; al quedar pagado se pone verde con un salto corto.',
  },
] as const

/**
 * Demo de las dos variantes del tatú en «Pagando…». Se eligió la B (EsperaPagando y TatuPagado). Las dos
 * variantes comparten el estado para compararlas lado a lado.
 */
export default function DemoTatu() {
  const [estado, setEstado] = useState<EstadoTatu>('pagando')
  const [paraPunto, setParaPunto] = useState(true)
  const [sinMovimiento, setSinMovimiento] = useState(false)

  return (
    <MarcoRol ancho="ancho" rol="Demo">
      <div className="flex flex-col gap-2">
        <Titulo className="text-[28px] md:text-[34px]">El tatú en «Pagando…»</Titulo>
        <p className="m-0 max-w-[640px] text-muted-foreground">
          Las dos variantes con el mismo estado. Prueba pagar y volver, y cómo queda para quien pide menos movimiento en su
          sistema.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => setEstado((e) => (e === 'pagando' ? 'pagado' : 'pagando'))}>
          {estado === 'pagando' ? 'Simular que quedó pagado' : 'Volver a «Pagando…»'}
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" className="size-5 accent-primary" checked={paraPunto} onChange={(e) => setParaPunto(e.target.checked)} />
          Verlo como el punto
        </label>
        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={sinMovimiento}
            onChange={(e) => setSinMovimiento(e.target.checked)}
          />
          Sin movimiento (preferencia del sistema)
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {VARIANTES.map((v) => (
          <section key={v.id} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-xl font-bold">{v.titulo}</h2>
              <p className="m-0 text-[15px] text-muted-foreground">{v.texto}</p>
            </div>

            <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
              <TatuAnimado
                key={String(sinMovimiento)}
                estado={estado}
                variante={v.id}
                sinMovimiento={sinMovimiento || undefined}
                className="size-28"
              />
              {estado === 'pagando' ? (
                <>
                  <p className="m-0 mt-2 text-[28px] leading-tight font-bold">Pagando…</p>
                  {paraPunto && <p className="m-0 text-lg font-bold">No entregues el efectivo todavía.</p>}
                </>
              ) : (
                <>
                  <p className="m-0 mt-2 text-[28px] leading-tight font-bold text-pagado">Pagado</p>
                  <p className="m-0 text-lg">{paraPunto ? 'Ya puedes entregar el efectivo.' : 'La plata ya está en tu cuenta.'}</p>
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h2 className="m-0 text-lg font-bold">Tamaños</h2>
        <div className="flex flex-wrap items-end gap-8">
          {(['size-16', 'size-28', 'size-40'] as const).map((t) => (
            <TatuAnimado key={t + String(sinMovimiento)} estado={estado} variante="cerradura" sinMovimiento={sinMovimiento || undefined} className={t} />
          ))}
        </div>
      </section>
    </MarcoRol>
  )
}

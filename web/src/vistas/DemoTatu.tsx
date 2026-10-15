import { useState } from 'react'

import { MarcoRol } from '@/componentes/Marcos'
import { TatuAnimado, type EstadoTatu } from '@/componentes/TatuAnimado'
import { TatuEnrolla } from '@/componentes/TatuEnrolla'
import { TatuGemini } from '@/componentes/TatuGemini'
import { POSES, VIEWBOX_POSES } from '@/componentes/tatuPoses'
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
  const [vuelta, setVuelta] = useState(0)
  const [falloC, setFalloC] = useState(false)
  const [finalError, setFinalError] = useState<'de-pie' | 'logo'>('logo')

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
        <Button
          size="lg"
          onClick={() => {
            // Al volver a «Pagando…», C y D empiezan de nuevo
            if (estado === 'pagado') setVuelta((v) => v + 1)
            setFalloC(false)
            setEstado((e) => (e === 'pagando' ? 'pagado' : 'pagando'))
          }}
        >
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

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-bold">C · Se enrolla (lámina de poses, coreografía de Gemini)</h2>
            <p className="m-0 max-w-[560px] text-[15px] text-muted-foreground">
              La que usa la app en los pagos. De pie y alerta, se agazapa, arquea el lomo, se enrolla y cae como bolita.
              Mientras paga rueda con las cuatro bolitas dibujadas. Si sale bien, frena, asoma la cabeza (pose 8) y pasa
              al logo con la cerradura verde; si sale mal, frena y se desenrolla hasta quedar de pie.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-11 items-center gap-2 text-[15px]">
              Al fallar
              <select
                className="min-h-11 rounded-lg border border-control bg-background px-2"
                value={finalError}
                onChange={(e) => setFinalError(e.target.value as 'de-pie' | 'logo')}
              >
                <option value="logo">logo con cerradura roja (la app)</option>
                <option value="de-pie">vuelve a pararse</option>
              </select>
            </label>
            <Button variant="outline" onClick={() => setFalloC(true)} disabled={falloC || estado === 'pagado'}>
              Simular que falló
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEstado('pagando')
                setFalloC(false)
                setVuelta((v) => v + 1)
              }}
            >
              Repetir desde el principio
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
          <TatuEnrolla key={`${vuelta}-${sinMovimiento}`} estado={falloC ? 'fallido' : estado} finalError={finalError} sinMovimiento={sinMovimiento || undefined} className="w-56" />
          <p className="m-0 mt-2 text-[28px] leading-tight font-bold">{falloC ? 'El pago falló' : estado === 'pagando' ? 'Pagando…' : 'Pagado'}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 border-t border-border pt-4">
          {POSES.map((d, i) => (
            <figure key={i} className="m-0 flex flex-col items-center gap-1">
              <svg viewBox={VIEWBOX_POSES} className="h-12 w-[68px]">
                <path d={d} fill="var(--foreground)" fillRule="evenodd" />
              </svg>
              <figcaption className="text-xs text-muted-foreground">{i + 1}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-bold">D · Dibujo de Gemini, adaptado</h2>
            <p className="m-0 max-w-[560px] text-[15px] text-muted-foreground">
              Los dibujos a trazo de Gemini con las fases de la app: camina con rebote, se agacha, se encorva y la bolita
              gira entera mientras paga. Al quedar pagado termina la vuelta derecho y salta al logo oficial. Colores del
              tema, en claro y oscuro.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setEstado('pagando')
              setVuelta((v) => v + 1)
            }}
          >
            Repetir desde el principio
          </Button>
        </div>
        <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
          <TatuGemini key={`${vuelta}-${sinMovimiento}`} estado={estado} sinMovimiento={sinMovimiento || undefined} className="h-32 w-[154px]" />
          <p className="m-0 mt-2 text-[28px] leading-tight font-bold">{estado === 'pagando' ? 'Pagando…' : 'Pagado'}</p>
        </div>
      </section>

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

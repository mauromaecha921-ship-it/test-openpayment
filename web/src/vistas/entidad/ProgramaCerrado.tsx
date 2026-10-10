import { Lock } from 'lucide-react'
import { useState } from 'react'

import type { Tablero } from '@/api/tipos'
import { Tarjeta } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { PasosPrograma } from '@/componentes/PasosPrograma'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { sumarMontos } from '@/lib/montos'
import { formatFechaHora, plural } from '@/lib/textos'

import { TablaCobros } from './Tablero'

/** Wireframe 07. Las cifras salen del evento de cierre, leídas antes de revocar el permiso (D-18). */
export default function ProgramaCerrado({ tablero: t }: { tablero: Tablero }) {
  const p = t.programa
  const m = p.moneda
  const cierre = t.cierre ?? { autorizado: t.autorizado, cobrado: t.cobrado, nuncaSalio: t.noHaSalido, cerradoEn: null }
  const [verTodos, setVerTodos] = useState(false)

  const pagados = t.cobros.filter((c) => c.estado === 'Pagado')
  const aCuenta = pagados.filter((c) => c.canal === 'cuenta')
  const enPunto = pagados.filter((c) => c.canal === 'retiro')
  const monto = (l: typeof pagados) => textoMonto(sumarMontos('0', ...l.map((c) => c.monto ?? '0')), m)

  return (
    <MarcoEntidad entidad={p.entidad}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-tenue">{p.nombre}</span>
          <Titulo className="text-[28px] sm:text-[32px]">Cierre del programa</Titulo>
        </div>
        <PasosPrograma estado="Cerrado" />
      </div>

      <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
        <Lock aria-hidden className="size-6" />
        <strong className="text-[17px]">Programa cerrado. Revocamos el permiso en tu banco.</strong>
        {cierre.cerradoEn && (
          <time dateTime={cierre.cerradoEn} className="ml-auto text-sm text-tenue">
            {formatFechaHora(cierre.cerradoEn)}
          </time>
        )}
      </div>

      <section className="flex flex-col items-start gap-2 rounded-[14px] border-2 border-foreground bg-card p-6 sm:p-8">
        <h2 className="m-0 text-lg font-normal text-muted-foreground">Nunca salió de tu cuenta</h2>
        <span className="text-[44px] leading-[1.05] font-bold text-enlace [overflow-wrap:anywhere] sm:text-[64px]">{textoMonto(cierre.nuncaSalio, m)}</span>
        <p className="m-0 text-[17px] text-muted-foreground">No hay nada que reintegrar: lo que no se cobró sigue en la cuenta del programa.</p>
      </section>

      <div className="flex flex-wrap gap-4">
        {(
          [
            ['Autorizado', cierre.autorizado],
            ['Cobrado', cierre.cobrado],
            ['Girado por adelantado', t.giradoPorAdelantado],
          ] as const
        ).map(([etiqueta, valor]) => (
          <section key={etiqueta} className="flex flex-[1_1_220px] flex-col gap-1 rounded-xl border border-border bg-card px-6 py-5">
            <h2 className="m-0 text-[15px] font-normal text-muted-foreground">{etiqueta}</h2>
            <span className="text-[30px] font-bold">{textoMonto(valor, m)}</span>
          </section>
        ))}
      </div>

      <Tarjeta className="gap-3 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold" id="titulo-cobros">
            Resumen de cobros
          </h2>
          <Button variant="link" className="h-auto px-0 text-[15px] font-normal text-enlace" onClick={() => setVerTodos((v) => !v)} aria-expanded={verTodos}>
            {verTodos ? 'Ocultar los cobros' : 'Ver todos los cobros'}
          </Button>
        </div>
        <Table className="min-w-[520px] text-[15px]">
          <TableHeader>
            <TableRow className="border-b-2 border-foreground hover:bg-transparent">
              <TableHead className="px-2 font-bold text-foreground">Resultado</TableHead>
              <TableHead className="px-2 text-right font-bold text-foreground">Cobros</TableHead>
              <TableHead className="px-2 text-right font-bold text-foreground">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(
              [
                ['Pagados a la cuenta', String(aCuenta.length), monto(aCuenta)],
                ['Pagados en un punto', String(enPunto.length), monto(enPunto)],
                ['Rechazados o fallidos (no movieron dinero)', String(t.rechazadosYFallidos), textoMonto('0', m)],
                ['Sin cobrar al cierre', t.sinCobrar ? plural(t.sinCobrar.cedulas, 'cédula') : '—', t.sinCobrar ? textoMonto(t.sinCobrar.monto, m) : '—'],
              ] as const
            ).map(([a, b, c]) => (
              <TableRow key={a} className="hover:bg-transparent">
                <TableCell className="px-2 py-3 whitespace-normal">{a}</TableCell>
                <TableCell className="px-2 py-3 text-right">{b}</TableCell>
                <TableCell className="px-2 py-3 text-right">{c}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="m-0 text-sm text-tenue">Desde ahora, todo intento de cobro se rechaza con «El programa está cerrado y ya no recibe cobros».</p>
        {verTodos && <TablaCobros cobros={t.cobros} />}
      </Tarjeta>
    </MarcoEntidad>
  )
}

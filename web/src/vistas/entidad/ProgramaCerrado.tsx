import { Lock } from 'lucide-react'
import { useState } from 'react'

import type { Tablero } from '@/api/tipos'
import { PantallaEntidad } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import { BotonEnlace, Caja, FilaDato, TarjetaCifra } from '@/componentes/Proto'
import { formatFechaHora, formatVigencia, plural } from '@/lib/textos'

import { TablaCobros } from './Tablero'
import { ChipPrograma } from './TusProgramas'

/** Prototipo E5 (wireframe 07). Las cifras salen del evento de cierre, leídas antes de revocar el permiso (D-18). */
export default function ProgramaCerrado({ tablero: t }: { tablero: Tablero }) {
  const p = t.programa
  const m = p.moneda
  const cierre = t.cierre ?? { autorizado: t.autorizado, cobrado: t.cobrado, nuncaSalio: t.noHaSalido, cerradoEn: null }
  const [verTodos, setVerTodos] = useState(false)

  const pagados = t.cobros.filter((c) => c.estado === 'Pagado')
  const rechazados = t.cobros.filter((c) => c.estado === 'Rechazado').length
  const fallidos = t.cobros.filter((c) => c.estado === 'Fallido').length

  return (
    <PantallaEntidad
      quien={p.entidad}
      volver={{ to: '/entidad', texto: 'Tus programas' }}
      subtitulo={`Vigencia: ${formatVigencia(p.vigenciaInicio, p.vigenciaFin, true)}`}
      titulo={p.nombre}
      junto={<ChipPrograma estado="Cerrado" grande />}
    >
      <section className="bloque flex flex-wrap items-center gap-7 rounded-3xl p-8 max-sm:p-6">
        <div className="flex flex-[1_1_420px] flex-col gap-2 max-sm:flex-[1_1_100%]">
          <h2 className="m-0 text-lg font-normal">Nunca salió de tu cuenta</h2>
          <span className="cifra text-[72px] leading-none text-ambar [overflow-wrap:anywhere] max-sm:text-[48px]">{textoMonto(cierre.nuncaSalio, m)}</span>
          <span className="max-w-[520px] text-[17px] leading-[1.45]">No hay nada que reintegrar: lo que no se cobró sigue en la cuenta del programa.</span>
        </div>
        <img src="/marca/tatu-logo-oscuro.svg" alt="" className="h-auto w-40 flex-none rounded-3xl" />
      </section>

      <div className="flex flex-wrap gap-4">
        <TarjetaCifra etiqueta="Autorizado">{textoMonto(cierre.autorizado, m)}</TarjetaCifra>
        <TarjetaCifra etiqueta="Cobrado">{textoMonto(cierre.cobrado, m)}</TarjetaCifra>
        <TarjetaCifra etiqueta="Girado por adelantado">{textoMonto(t.giradoPorAdelantado, m)}</TarjetaCifra>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Caja grande as="section" className="flex-[999_1_520px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-cobros" className="m-0 text-[21px] font-extrabold">
              Resumen de cobros
            </h2>
            <button
              type="button"
              aria-expanded={verTodos}
              onClick={() => setVerTodos((v) => !v)}
              className="min-h-11 border-0 bg-transparent p-0 text-base font-bold text-azul underline underline-offset-[3px]"
            >
              {verTodos ? 'Ocultar los cobros' : 'Ver todos los cobros'}
            </button>
          </div>
          <FilaDato etiqueta="Pagados a una cuenta">{pagados.filter((c) => c.canal === 'cuenta').length}</FilaDato>
          <FilaDato etiqueta="Pagados en un punto">{pagados.filter((c) => c.canal === 'retiro').length}</FilaDato>
          {p.tipo === 'bono' && <FilaDato etiqueta="Pagados en comercios">{pagados.filter((c) => c.canal === 'compra').length}</FilaDato>}
          <FilaDato etiqueta="Rechazados">{rechazados}</FilaDato>
          <FilaDato etiqueta="Fallidos">{fallidos}</FilaDato>
          <FilaDato etiqueta="Cédulas sin cobrar al cierre">{t.sinCobrar ? plural(t.sinCobrar.cedulas, 'cédula') : '—'}</FilaDato>
          {verTodos && <TablaCobros cobros={t.cobros} />}
        </Caja>

        <Caja grande as="section" className="flex-[1_1_320px]">
          <div className="flex items-center gap-3">
            <Lock aria-hidden className="size-[22px]" strokeWidth={2} />
            <h2 className="m-0 text-lg font-extrabold">Permiso revocado</h2>
          </div>
          <span className="text-base leading-[1.45]">
            Revocamos el permiso en tu banco{cierre.cerradoEn ? ` el ${formatFechaHora(cierre.cerradoEn)}` : ''}. Ya nadie puede cobrar en este programa.
          </span>
          <BotonEnlace variante="contorno" medio to="/entidad">
            Ir a tus programas
          </BotonEnlace>
        </Caja>
      </div>
    </PantallaEntidad>
  )
}

import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { PersonaRegistrada, Programa } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, MensajeError, Tarjeta, Volver } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { leerCsv, MAX_FILAS, PLANTILLA_CSV, revisarCarga, type RevisionCarga } from '@/lib/cargaBeneficiarios'
import { aUnidades } from '@/lib/montos'
import { NOMBRE_ESTADO_PROGRAMA, plural } from '@/lib/textos'

const conEspacios = (doc: string) => doc.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

async function leerArchivo(archivo: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(archivo.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    return (await readSheet(archivo)) as unknown[][]
  }
  if (/\.csv$/i.test(archivo.name)) return leerCsv(await archivo.text())
  throw new Error('Sube un archivo Excel (.xlsx) o .csv.')
}

function descargarPlantilla() {
  // El BOM al inicio hace que Excel abra bien las tildes
  const url = URL.createObjectURL(new Blob(['﻿' + PLANTILLA_CSV], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-beneficiarios.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Pantallas E1b y E1c del prototipo: subir la lista, revisar los errores y agregar a quienes están bien. */
export default function SubirExcel() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [filas, setFilas] = useState<unknown[][] | null>(null)
  const [revision, setRevision] = useState<RevisionCarga | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [agregando, setAgregando] = useState(false)

  const { datos } = usePolling<{ programa: Programa; personas: PersonaRegistrada[] }>(
    async () => {
      const [programa, personas] = await Promise.all([api.get<Programa>(`/programas/${id}`), api.get<PersonaRegistrada[]>('/beneficiarios')])
      return { programa, personas }
    },
    null,
    true,
    { clave: id },
  )

  const volverA = `/entidad/programas/${id}/beneficiarios`
  const escala = datos?.programa.moneda.escala ?? 2

  /** Se lee al elegirlo, para decir cuántas filas trae antes de revisar. */
  const elegir = async (f: File | null) => {
    setArchivo(f)
    setFilas(null)
    setError(null)
    if (!f) return
    setLeyendo(true)
    try {
      setFilas(await leerArchivo(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.')
    } finally {
      setLeyendo(false)
    }
  }

  const revisar = () => {
    if (!filas || !datos) return
    setError(null)
    try {
      setRevision(revisarCarga(filas, new Set(datos.personas.map((p) => p.documento))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.')
    }
  }

  const agregar = async () => {
    if (!revision) return
    setAgregando(true)
    setError(null)
    const fallidas: string[] = []
    for (const f of revision.listas) {
      try {
        await api.post('/beneficiarios', { documento: f.cedula, nombre: f.nombre, valor: aUnidades(f.valor, escala) ?? f.valor })
      } catch (e) {
        fallidas.push(`${conEspacios(f.cedula)}: ${mensajeDeError(e)}`)
      }
    }
    setAgregando(false)
    if (fallidas.length) setError(`No se agregaron ${plural(fallidas.length, 'persona')}. ${fallidas[0]}`)
    else navegar(volverA)
  }

  if (!datos) {
    return (
      <MarcoEntidad>
        <Cargando />
      </MarcoEntidad>
    )
  }
  const p = datos.programa

  // ── E1c: revisar ──
  if (revision) {
    const suma = revision.listas.reduce((n, f) => n + BigInt(aUnidades(f.valor, escala) ?? '0'), 0n).toString()
    return (
      <MarcoEntidad entidad={p.entidad}>
        <Volver to={volverA}>Subir otro archivo</Volver>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-tenue">{archivo?.name}</span>
          <Titulo className="text-[28px] sm:text-[32px]">Revisa antes de agregar</Titulo>
        </div>
        <div className="flex flex-wrap gap-4">
          <section className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl border border-border bg-card px-[22px] py-5">
            <h2 className="m-0 text-base font-bold">Filas leídas</h2>
            <span className="cifra text-[34px] sm:text-[38px]">{revision.leidas}</span>
          </section>
          <section className="bloque flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl px-[22px] py-5">
            <h2 className="m-0 text-base font-bold">Listas para agregar</h2>
            <span className="cifra text-[34px] text-ambar sm:text-[38px]">{revision.listas.length}</span>
            <span className="text-sm text-noche-tenue">Suman {textoMonto(suma, p.moneda)}</span>
          </section>
          <section className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl border border-border bg-card px-[22px] py-5">
            <h2 className="m-0 text-base font-bold">Con errores</h2>
            <span className="cifra text-[34px] text-rechazo sm:text-[38px]">{revision.errores.length}</span>
            <span className="text-sm text-tenue">No se agregan</span>
          </section>
        </div>

        {revision.errores.length > 0 && (
          <Tarjeta className="gap-3.5">
            <h2 className="m-0 text-xl font-bold">Filas con errores</h2>
            <span className="text-[15px] text-tenue">Corrígelas en tu archivo y vuelve a subirlo, o agrégalas después una por una.</span>
            <div className="overflow-x-auto">
              <Table className="min-w-[620px] text-[15px]">
                <TableHeader>
                  <TableRow className="border-b-2 border-foreground hover:bg-transparent">
                    {['Fila', 'Dato', 'Problema', 'Cómo corregirlo'].map((h) => (
                      <TableHead key={h} className="px-2 font-bold text-foreground">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revision.errores.map((e) => (
                    <TableRow key={e.fila}>
                      <TableCell className="px-2 py-3 font-bold">{e.fila}</TableCell>
                      <TableCell className="px-2 py-3">{e.dato}</TableCell>
                      <TableCell className="px-2 py-3 font-bold text-rechazo">{e.problema}</TableCell>
                      <TableCell className="px-2 py-3 whitespace-normal">{e.como}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Tarjeta>
        )}

        {revision.listas.length > 0 && (
          <Tarjeta className="gap-3.5">
            <h2 className="m-0 text-xl font-bold">Se agregarán</h2>
            <div className="overflow-x-auto">
              <Table className="min-w-[520px] text-[15px]">
                <TableHeader>
                  <TableRow className="border-b-2 border-foreground hover:bg-transparent">
                    <TableHead className="px-2 font-bold text-foreground">Cédula</TableHead>
                    <TableHead className="px-2 font-bold text-foreground">Nombre</TableHead>
                    <TableHead className="px-2 text-right font-bold text-foreground">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revision.listas.map((f) => (
                    <TableRow key={f.cedula}>
                      <TableCell className="px-2 py-3 font-bold">{conEspacios(f.cedula)}</TableCell>
                      <TableCell className="px-2 py-3">{f.nombre}</TableCell>
                      <TableCell className="px-2 py-3 text-right font-bold">{textoMonto(aUnidades(f.valor, escala) ?? '0', p.moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Tarjeta>
        )}

        <MensajeError>{error}</MensajeError>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            className="border-2 border-foreground"
            onClick={() => {
              setRevision(null)
              setError(null)
            }}
          >
            Corregir y subir de nuevo
          </Button>
          <Button onClick={() => void agregar()} disabled={agregando || revision.listas.length === 0}>
            {agregando ? 'Agregando…' : `Agregar ${plural(revision.listas.length, 'beneficiario')}`}
          </Button>
        </div>
      </MarcoEntidad>
    )
  }

  // ── E1b: subir (ventana sobre fondo gris, como en el prototipo) ──
  const nFilas = filas ? Math.max(0, filas.length - 1) : 0
  return (
    <MarcoEntidad entidad={p.entidad}>
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-[#4B5466] px-4 py-10 sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-excel"
          className="flex w-full max-w-[720px] flex-col gap-[18px] rounded-3xl bg-card p-7 text-card-foreground shadow-[0_24px_60px_rgba(10,16,30,0.35)]"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] text-tenue">
              {p.nombre} · {NOMBRE_ESTADO_PROGRAMA[p.estado]}
            </span>
            <Titulo id="titulo-excel" className="text-[28px]">
              Subir beneficiarios desde Excel
            </Titulo>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-[14px] bg-muted px-4 py-3.5">
            <span>
              <b>1.</b> Usa nuestra plantilla para no equivocarte de columnas.
            </span>
            <Button variant="outline" className="border-2 border-foreground" onClick={descargarPlantilla}>
              <Download aria-hidden />
              Descargar plantilla
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <span>
              <b>2.</b> Llénala con una fila por persona:
            </span>
            <div className="overflow-x-auto">
              <Table className="min-w-[480px] text-[15px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Columna', 'Qué va', 'Ejemplo'].map((h) => (
                      <TableHead key={h} className="px-2 text-sm font-normal text-tenue">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['cedula', 'Número de cédula, solo números. Obligatoria.', '52418300'],
                    ['nombre', 'Nombre completo. Obligatoria.', 'Ana Rodríguez'],
                    ['valor', 'Valor del subsidio en pesos, sin puntos ni símbolo. Obligatoria.', '230000'],
                  ].map(([c, q, e]) => (
                    <TableRow key={c}>
                      <TableCell className="px-2 py-3 font-bold">{c}</TableCell>
                      <TableCell className="px-2 py-3 whitespace-normal">{q}</TableCell>
                      <TableCell className="px-2 py-3 whitespace-normal">{e}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span>
              <b>3.</b> Súbela:
            </span>
            <input
              ref={entrada}
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              aria-label="Archivo de beneficiarios"
              onChange={(e) => void elegir(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-control bg-background p-6 text-center">
              <Upload aria-hidden className="size-5 text-enlace" />
              {archivo ? (
                <>
                  <span className="text-[17px] font-bold">{archivo.name}</span>
                  <span className="text-[15px] text-tenue">
                    {leyendo ? 'Leyendo…' : filas ? `${plural(nFilas, 'fila')} · ` : ''}
                    <button type="button" onClick={() => entrada.current?.click()} className="font-bold text-enlace underline">
                      Cambiar archivo
                    </button>
                  </span>
                </>
              ) : (
                <button type="button" onClick={() => entrada.current?.click()} className="text-[17px] font-bold text-enlace underline">
                  Elegir archivo
                </button>
              )}
              <span className="text-sm text-tenue">Excel (.xlsx) o .csv, hasta {MAX_FILAS.toLocaleString('es-CO')} filas.</span>
            </div>
          </div>

          <MensajeError>{error}</MensajeError>
          <div className="flex flex-wrap justify-end gap-3">
            <Button asChild variant="outline" className="border-2 border-foreground">
              <Link to={volverA}>Cancelar</Link>
            </Button>
            <Button onClick={revisar} disabled={!filas || leyendo}>
              Revisar archivo
            </Button>
          </div>
        </div>
      </div>
    </MarcoEntidad>
  )
}

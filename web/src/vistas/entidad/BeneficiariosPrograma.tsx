import { Check, Landmark, Plus, Upload } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { api } from '@/api/client'
import type { PersonaRegistrada, Tablero } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { Cargando, ErrorCarga, Tarjeta, Volver } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'

interface Datos {
  tablero: Tablero
  personas: PersonaRegistrada[]
}

/** «52418300» → «52 418 300» */
const conEspacios = (doc: string) => doc.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Pantalla E6 del prototipo: quién está en el programa y quién ya cobró. */
export default function BeneficiariosPrograma() {
  const { id = '' } = useParams()
  const { datos, error, recargar } = usePolling<Datos>(
    async () => {
      const [tablero, personas] = await Promise.all([api.get<Tablero>(`/programas/${id}/tablero`), api.get<PersonaRegistrada[]>('/beneficiarios')])
      return { tablero, personas }
    },
    5000,
    true,
    { clave: id },
  )

  const p = datos?.tablero.programa
  // El cobro no trae la cédula, solo el nombre: con él se sabe quién ya cobró
  const cobro = (nombre: string) => datos?.tablero.cobros.find((c) => c.estado === 'Pagado' && c.persona.nombre === nombre)
  // Un retroactivo que el banco rechazó por el tope: su valor es el del cobro, no el del resto
  const fuera = (nombre: string) => datos?.tablero.cobros.find((c) => c.estado === 'Fallido' && c.motivo?.codigo === 'TopeSuperado' && c.persona.nombre === nombre)
  const yaCobraron = datos ? datos.personas.filter((x) => cobro(x.nombre)).length : 0

  return (
    <MarcoEntidad entidad={p?.entidad}>
      <Volver to={`/entidad/programas/${id}`}>Tablero del programa</Volver>
      {error && !datos && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {!datos && !error && <Cargando />}
      {datos && p && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-tenue">{p.nombre}</span>
              <div className="flex flex-wrap items-center gap-3">
                <Titulo className="text-[28px] sm:text-[32px]">Beneficiarios</Titulo>
                <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">{p.estado === 'Pausado' ? 'Pausado' : 'Activo'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="border-2 border-foreground">
              <Link to={`/equipo?volver=${encodeURIComponent(`/entidad/programas/${id}/beneficiarios`)}`}>
                <Plus aria-hidden />
                Agregar personas
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/entidad/programas/${id}/beneficiarios/excel`}>
                <Upload aria-hidden />
                Subir Excel
              </Link>
            </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <section className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl border border-border bg-card px-[22px] py-5">
              <h2 className="m-0 text-base font-bold">Beneficiarios</h2>
              <span className="cifra text-[34px] sm:text-[38px]">{datos.personas.length}</span>
            </section>
            <section className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl border border-border bg-card px-[22px] py-5">
              <h2 className="m-0 text-base font-bold">Ya cobraron</h2>
              <span className="cifra text-[34px] sm:text-[38px]">{yaCobraron}</span>
              <span className="text-sm text-tenue">de {datos.personas.length} personas</span>
            </section>
            <section className="bloque flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 rounded-2xl px-[22px] py-5">
              <h2 className="m-0 text-base font-bold">Tope del permiso</h2>
              <span className="cifra text-[34px] text-ambar sm:text-[38px]">{textoMonto(datos.tablero.autorizado, p.moneda)}</span>
              <span className="text-sm text-noche-tenue">Quien llegue después queda fuera del tope</span>
            </section>
          </div>

          <Tarjeta className="gap-3.5">
            <h2 className="m-0 text-xl font-bold">Lista</h2>
            <div className="overflow-x-auto">
              <Table className="min-w-[640px] text-[15px]">
                <TableHeader>
                  <TableRow className="border-b-2 border-foreground hover:bg-transparent">
                    <TableHead className="px-2 font-bold text-foreground">Cédula</TableHead>
                    <TableHead className="px-2 font-bold text-foreground">Nombre</TableHead>
                    <TableHead className="px-2 text-right font-bold text-foreground">Valor</TableHead>
                    <TableHead className="px-2 font-bold text-foreground">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.personas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="px-2 py-4 text-tenue">
                        Todavía no hay personas registradas.
                      </TableCell>
                    </TableRow>
                  )}
                  {datos.personas.map((x) => {
                    const c = cobro(x.nombre)
                    const f = !c ? fuera(x.nombre) : undefined
                    return (
                      <TableRow key={x.documento}>
                        <TableCell className="px-2 py-3 font-bold">{conEspacios(x.documento)}</TableCell>
                        <TableCell className="px-2 py-3 whitespace-normal">{x.nombre}</TableCell>
                        <TableCell className="px-2 py-3 text-right font-bold">{textoMonto(f?.monto ?? p.montoPorPersona, p.moneda)}</TableCell>
                        <TableCell className="px-2 py-3">
                          {c ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[13px] font-bold text-muted-foreground">
                              <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                              Ya cobrado
                            </span>
                          ) : f ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rechazo-fondo px-2.5 py-1 text-[13px] font-bold text-rechazo">
                              <Landmark aria-hidden className="size-3.5" strokeWidth={2.5} />
                              Fuera del tope
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border-2 border-pagando bg-pagando-fondo px-2.5 py-1 text-[13px] font-bold text-pagando">Disponible</span>
                          )}
                          <div className="mt-1 text-sm text-tenue">{c ? c.referencia : f ? 'Retroactivo agregado después de aprobar' : 'Todavía no ha cobrado'}</div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Tarjeta>
        </>
      )}
    </MarcoEntidad>
  )
}

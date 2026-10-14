import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import { Campo } from '@/componentes/Campo'
import { Cargando, ErrorCarga, MensajeError } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Button } from '@/componentes/ui/button'
import { plural } from '@/lib/textos'

import { useTablero } from './useTablero'

const PALABRA = 'CERRAR'

/** Wireframe 06. La doble confirmación de HU-17: el botón solo se habilita al escribir CERRAR. */
export default function CerrarPrograma() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const consulta = useTablero(id)
  const t = consulta.datos
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const volver = () => navegar(`/entidad/programas/${id}`)

  if (t && t.programa.estado !== 'Activo' && t.programa.estado !== 'Pausado') {
    return <Navigate to={`/entidad/programas/${id}`} replace />
  }

  const cerrar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await api.post(`/programas/${id}/cerrar`, { confirmacion: PALABRA })
      navegar(`/entidad/programas/${id}`, { replace: true })
    } catch (e) {
      setError(mensajeDeError(e))
      await consulta.recargar()
    } finally {
      setEnviando(false)
    }
  }

  const hayPagando = (t?.cobrosPagando ?? 0) > 0
  const confirmado = texto.trim().toUpperCase() === PALABRA

  return (
    <MarcoEntidad entidad={t?.programa.entidad}>
      {/* El tablero queda de fondo, como en el wireframe */}
      <div aria-hidden className="flex flex-col gap-6">
        <div className="h-9 w-64 rounded-md bg-secondary" />
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[130px] flex-[1_1_260px] rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-3.5 rounded-full bg-secondary" />
        <div className="h-[300px] rounded-xl border border-border bg-card" />
      </div>

      {consulta.error && !t && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {!t && !consulta.error && <Cargando />}

      <AlertDialog open={!!t} onOpenChange={(abierto) => !abierto && volver()}>
        {t && (
          <AlertDialogContent
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              document.getElementById('confirmar-cierre')?.focus()
            }}
            className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] gap-[18px] overflow-y-auto rounded-[14px] p-6 sm:max-w-[560px] sm:p-7">
            <AlertDialogHeader className="items-start text-left sm:text-left">
              <AlertDialogTitle className="titular text-[28px] font-extrabold">¿Cerrar el programa?</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-muted-foreground">
                Revocamos el permiso en tu banco y nadie podrá volver a cobrar. Esto no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-wrap gap-3">
              <div className="flex flex-[1_1_200px] flex-col gap-0.5 rounded-xl bg-muted px-4 py-3.5">
                <span className="text-sm text-muted-foreground">Cobrado</span>
                <span className="cifra text-[26px]">{textoMonto(t.cobrado, t.programa.moneda)}</span>
              </div>
              <div className="flex flex-[1_1_200px] flex-col gap-0.5 bloque rounded-xl px-4 py-3.5">
                <span className="text-sm font-bold">Se queda en tu cuenta</span>
                <span className="cifra text-[26px] text-ambar">{textoMonto(t.noHaSalido, t.programa.moneda)}</span>
              </div>
            </div>
            <p className="m-0 text-[15px] text-muted-foreground">
              {t.sinCobrar === null
                ? 'No pudimos consultar cuántas cédulas faltan. '
                : t.sinCobrar.cedulas > 0
                ? `${plural(t.sinCobrar.cedulas, 'cédula')} todavía no ${t.sinCobrar.cedulas === 1 ? 'ha' : 'han'} cobrado. `
                : 'Todas las cédulas ya cobraron. '}
              Después del cierre, cualquier intento se rechaza.
            </p>

            {hayPagando && (
              <p role="alert" className="m-0 rounded-xl border-2 border-pagando bg-pagando-fondo px-4 py-3 font-bold text-pagando">
                Hay {plural(t.cobrosPagando, 'cobro')} pagándose. Espera a que terminen para cerrar.
              </p>
            )}

            <Campo
              id="confirmar-cierre"
              etiqueta={`Escribe ${PALABRA} para confirmar`}
              mono
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <MensajeError>{error}</MensajeError>

            <AlertDialogFooter className="-mx-0 -mb-0 flex-row flex-wrap justify-end gap-3 border-0 bg-transparent p-0">
              <Button variant="outline" size="lg" className="text-base" onClick={volver}>
                Cancelar
              </Button>
              <Button size="lg" className="bg-rechazo-relleno text-base text-white hover:bg-[#7f1d16]" onClick={() => void cerrar()} disabled={!confirmado || hayPagando || enviando}>
                Cerrar programa
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </MarcoEntidad>
  )
}

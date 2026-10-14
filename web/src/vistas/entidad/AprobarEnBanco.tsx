import { Clock, Lock, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Liquidacion, Programa, Redireccion } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga, MensajeError } from '@/componentes/Comun'
import { PantallaEntidad } from '@/componentes/MarcosProto'
import { textoMonto } from '@/componentes/Monto'
import { Boton, BotonEnlace, Caja, FilaDato, NumeroCirculo } from '@/componentes/Proto'
import { useRol } from '@/contexto/Rol'
import { formatVigencia, plural } from '@/lib/textos'
import { prepararPestana } from '@/lib/ventana'

import { ChipPrograma } from './TusProgramas'

const DIEZ_MINUTOS = 10 * 60_000

interface Datos {
  programa: Programa
  liquidacion: Liquidacion
}

export default function AprobarEnBanco() {
  const { id = '' } = useParams()
  const [busqueda, setBusqueda] = useSearchParams()
  const resultado = busqueda.get('resultado')
  const rol = useRol()

  // El redirect de la Test Wallet solo vive en memoria: la API no lo guarda.
  const [redirect, setRedirect] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consulta = usePolling<Datos>(
    async () => {
      const [programa, liquidacion] = await Promise.all([
        api.get<Programa>(`/programas/${id}`),
        api.get<Liquidacion>(`/programas/${id}/liquidacion`),
      ])
      return { programa, liquidacion }
    },
    2000,
    true,
    { clave: id, maxMs: DIEZ_MINUTOS },
  )
  const programa = consulta.datos?.programa
  const liquidacion = consulta.datos?.liquidacion

  useEffect(() => {
    if (programa) rol.actualizar({ rol: 'entidad', programaId: programa.id })
  }, [programa?.id])

  // Si el programa volvió a Borrador mientras esperábamos, la aprobación se rechazó o venció.
  const [estabaEsperando, setEstabaEsperando] = useState(false)
  useEffect(() => {
    if (programa?.estado === 'EsperandoAprobacion') setEstabaEsperando(true)
  }, [programa?.estado])
  const rechazada =
    (resultado !== null && resultado !== 'aprobado') || (estabaEsperando && programa?.estado === 'Borrador')

  if (programa && (programa.estado === 'Activo' || programa.estado === 'Pausado' || programa.estado === 'Cerrado')) {
    return <Navigate to={`/entidad/programas/${id}`} replace />
  }

  const aprobar = async () => {
    const pestana = prepararPestana()
    setEnviando(true)
    setError(null)
    if (resultado) setBusqueda({}, { replace: true })
    setEstabaEsperando(false)
    try {
      const r = await api.post<Redireccion>(`/programas/${id}/autorizar`)
      setRedirect(r.redirect)
      pestana.ir(r.redirect)
      await consulta.recargar()
    } catch (e) {
      pestana.cerrar()
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const cancelar = async () => {
    setEnviando(true)
    try {
      await api.post(`/programas/${id}/cancelar-aprobacion`)
      setRedirect(null)
      setEstabaEsperando(false)
      await consulta.recargar()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const esperando = programa?.estado === 'EsperandoAprobacion'
  const tope = programa?.tope ?? liquidacion?.total

  return (
    <PantallaEntidad
      quien={programa?.entidad}
      volver={{ to: `/entidad/programas/${id}/editar`, texto: 'Conectar programa' }}
      subtitulo={programa ? `Vigencia: ${formatVigencia(programa.vigenciaInicio, programa.vigenciaFin, true)}` : ' '}
      titulo={programa?.nombre ?? 'Aprueba en tu banco'}
      junto={programa && <ChipPrograma estado={programa.estado} grande />}
    >
      {rechazada && !esperando && (
        <div role="alert" className="flex items-start gap-3 rounded-[18px] border-2 border-foreground bg-card px-5 py-4">
          <TriangleAlert aria-hidden className="size-6 shrink-0" />
          <div className="flex flex-col gap-1">
            <strong className="text-[17px]">
              {resultado === 'invalido' ? 'No pudimos confirmar la respuesta del banco; intenta de nuevo.' : 'No aprobaste el permiso; puedes intentarlo de nuevo.'}
            </strong>
            <span className="text-[15px] text-muted-foreground">
              También pasa si la aprobación vence a los 10 minutos. Tu configuración se conservó y el programa volvió a Borrador.
            </span>
          </div>
        </div>
      )}

      {consulta.error && !consulta.datos && <ErrorCarga mensaje={consulta.error} reintentar={() => void consulta.recargar()} />}
      {!consulta.datos && !consulta.error && <Cargando />}

      {programa && liquidacion && tope && (
        <div className="flex flex-wrap items-start gap-6">
          <Caja grande as="section" className="flex-[999_1_560px]">
            <h2 className="sr-only">El permiso que vas a aprobar</h2>
            <span className="text-base text-muted-foreground">Vas a aprobar en tu banco un permiso con tope de</span>
            <span className="cifra text-[56px] leading-none [overflow-wrap:anywhere] max-sm:text-[40px]">{textoMonto(tope, programa.moneda)}</span>
            <div className="flex items-start gap-3 rounded-[14px] bg-background p-4">
              <Lock aria-hidden className="size-[22px] flex-none" strokeWidth={2} />
              <p className="m-0 text-base leading-[1.45]">
                El permiso fija un límite de desembolso: no reserva ni separa la plata. Nada sale de tu cuenta hasta que alguien cobra.
              </p>
            </div>
            <FilaDato etiqueta="Cuenta que paga">
              <BilleteraCorta url={programa.billetera} />
            </FilaDato>
            <FilaDato etiqueta="Vigencia">{formatVigencia(programa.vigenciaInicio, programa.vigenciaFin, true)}</FilaDato>
            <FilaDato etiqueta="Beneficiarios">{plural(liquidacion.cedulas, 'cédula')}</FilaDato>
            <FilaDato etiqueta="Se aprueba">Una sola vez</FilaDato>
            <p className="m-0 text-[15px] leading-[1.45] text-muted-foreground">La plataforma solo paga a cuentas verificadas y a puntos de retiro registrados.</p>

            <MensajeError>{error}</MensajeError>

            {!esperando && (
              <div className="mt-1 flex flex-wrap gap-3">
                <Boton medio onClick={() => void aprobar()} disabled={enviando}>
                  Aprobar en mi banco
                </Boton>
                <BotonEnlace medio variante="contorno" to={`/entidad/programas/${id}/editar`}>
                  Volver a editar
                </BotonEnlace>
              </div>
            )}

            {esperando && (
              <div aria-live="polite" className="flex flex-col gap-3 rounded-[14px] bg-muted px-[18px] py-4">
                <div className="flex items-center gap-2.5">
                  <Clock aria-hidden className="size-[22px]" />
                  <strong className="text-[17px]">Esperando tu aprobación en el banco…</strong>
                </div>
                <p className="m-0 text-[15px] text-muted-foreground">
                  Abrimos tu Test Wallet en otra pestaña. Si no apruebas en 10 minutos, el programa vuelve a Borrador sin perder nada.
                </p>
                <div className="flex flex-wrap gap-3">
                  {redirect && (
                    <Boton medio onClick={() => window.open(redirect, '_blank', 'noopener')} disabled={enviando}>
                      Abrir mi banco otra vez
                    </Boton>
                  )}
                  <Boton medio variante="contorno" onClick={() => void cancelar()} disabled={enviando}>
                    Cancelar
                  </Boton>
                </div>
              </div>
            )}
          </Caja>

          <Caja grande as="section" className="flex-[1_1_300px]">
            <h2 className="m-0 text-[19px] font-extrabold">Qué va a pasar</h2>
            {PASOS.map(([titulo, texto], i) => (
              <div key={titulo} className="flex items-start gap-3">
                <NumeroCirculo n={i + 1} tono="borde" />
                <div>
                  <div className="text-[17px] font-bold">{titulo}</div>
                  <div className="text-[15px] text-muted-foreground">{texto}</div>
                </div>
              </div>
            ))}
          </Caja>
        </div>
      )}
    </PantallaEntidad>
  )
}

const PASOS = [
  ['Abrimos tu banco', 'Interledger Test Wallet, en otra pestaña.'],
  ['Apruebas el tope', 'Tienes 10 minutos para hacerlo.'],
  ['Vuelves aquí', 'Con el programa activo y listo para pagar.'],
] as const

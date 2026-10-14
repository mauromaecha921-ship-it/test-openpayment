import { Clock, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Liquidacion, Programa, Redireccion } from '@/api/tipos'
import { usePolling } from '@/api/usePolling'
import { BilleteraCorta } from '@/componentes/BilleteraCorta'
import { Cargando, ErrorCarga, ListaDatos, MensajeError, Tarjeta } from '@/componentes/Comun'
import { MarcoEntidad } from '@/componentes/Marcos'
import { textoMonto } from '@/componentes/Monto'
import { PasosPrograma } from '@/componentes/PasosPrograma'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'
import { formatFecha, plural } from '@/lib/textos'
import { prepararPestana } from '@/lib/ventana'

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
    <MarcoEntidad entidad={programa?.entidad}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-tenue">{programa?.nombre ?? ' '}</span>
          <Titulo className="text-[28px] sm:text-[32px]">Aprueba una sola vez en tu banco</Titulo>
        </div>
        {programa && <PasosPrograma estado={programa.estado} />}
      </div>

      {rechazada && !esperando && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border-2 border-foreground bg-card px-5 py-4">
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
          <Tarjeta className="flex-[999_1_560px] gap-[18px]">
            <h2 className="m-0 text-xl font-bold">El permiso que vas a aprobar</h2>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-tenue">Tope total</span>
              <span className="cifra text-[40px] [overflow-wrap:anywhere] sm:text-[48px]">{textoMonto(tope, programa.moneda)}</span>
              <span className="text-[15px] text-muted-foreground">
                La suma de la liquidación: {plural(liquidacion.cedulas, 'cédula')}
              </span>
            </div>
            <ListaDatos
              className="border-t border-border text-[15px]"
              filas={[
                ['Cuenta que paga', <BilleteraCorta key="b" url={programa.billetera} completa />],
                ['A quién puede pagar', 'Cuentas verificadas de beneficiarios y puntos registrados'],
                ['Vigencia', `${formatFecha(programa.vigenciaInicio)} – ${formatFecha(programa.vigenciaFin)}`],
              ]}
            />
            <p className="m-0 rounded-lg bg-muted px-3.5 py-3 text-[15px]">
              El permiso fija un límite de desembolso: no reserva ni separa la plata. Nada sale de tu cuenta hasta que alguien cobra.
            </p>

            <MensajeError>{error}</MensajeError>

            {!esperando && (
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="flex-[1_1_240px]" onClick={() => void aprobar()} disabled={enviando}>
                  Aprobar en mi banco
                </Button>
                <Button asChild variant="outline" size="lg" className="flex-[0_1_200px] text-base">
                  <Link to={`/entidad/programas/${id}/editar`}>Volver a editar</Link>
                </Button>
              </div>
            )}

            {esperando && (
              <div aria-live="polite" className="flex flex-col gap-3 rounded-xl bg-muted px-[18px] py-4">
                <div className="flex items-center gap-2.5">
                  <Clock aria-hidden className="size-[22px]" />
                  <strong className="text-[17px]">Esperando tu aprobación en el banco…</strong>
                </div>
                <p className="m-0 text-[15px] text-muted-foreground">
                  Abrimos tu Test Wallet en otra pestaña. Si no apruebas en 10 minutos, el programa vuelve a Borrador sin perder nada.
                </p>
                <div className="flex flex-wrap gap-3">
                  {redirect && (
                    <Button onClick={() => window.open(redirect, '_blank', 'noopener')} disabled={enviando}>
                      Abrir mi banco otra vez
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => void cancelar()} disabled={enviando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </Tarjeta>

          <aside className="flex flex-[1_1_320px] flex-col gap-4">
            <Tarjeta className="gap-3">
              <h2 className="m-0 text-lg font-bold">Cómo funciona</h2>
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
                {['Pulsas «Aprobar en mi banco».', 'Tu banco te muestra el tope y tú lo apruebas.', 'Vuelves aquí y el programa queda Activo.'].map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </Tarjeta>
            <figure className="m-0 flex flex-col gap-2.5 rounded-xl border-2 border-dashed border-control bg-card p-5">
              <div aria-hidden className="flex flex-col gap-2.5">
                <div className="h-3.5 w-[55%] rounded bg-secondary" />
                <div className="h-2.5 w-[85%] rounded bg-secondary" />
                <div className="h-2.5 w-[70%] rounded bg-secondary" />
                <div className="mt-1.5 flex gap-2">
                  <div className="h-9 flex-1 rounded-md bg-border" />
                  <div className="h-9 flex-1 rounded-md border border-border" />
                </div>
              </div>
              <figcaption className="text-sm text-muted-foreground">Pantalla de consentimiento de la Test Wallet. La muestra tu banco, fuera de Tatú.</figcaption>
            </figure>
          </aside>
        </div>
      )}
    </MarcoEntidad>
  )
}

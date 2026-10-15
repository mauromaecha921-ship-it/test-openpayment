import { useState } from 'react'
import { useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { Cobro, PagosEnPunto } from '@/api/tipos'
import { useRol } from '@/contexto/Rol'
import { irAlCobroDelPunto } from '@/lib/irAlCobro'

const CEDULAS_DEMO = ['71234567', '900000003']

/**
 * Flujo de un cobro en el punto, sin salir de la pantalla de inicio (computador):
 * cédula → pagos de esa cédula → «Pagar» abre el cobro (PIN y resultado).
 */
export function useNuevoCobro() {
  const navegar = useNavigate()
  const { puntoId } = useRol()
  const [cedula, setCedula] = useState('')
  const [consulta, setConsulta] = useState<PagosEnPunto | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Pidiendo el cobro (no consultando la cédula): se ve el tatú de los pagos rodando
  const [pidiendo, setPidiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const consultar = async () => {
    const doc = cedula.trim()
    if (!/^\d{5,12}$/.test(doc)) return setError('Digita el número de la cédula, sin puntos ni espacios.')
    setEnviando(true)
    setError(null)
    let res: PagosEnPunto | null = null
    try {
      res = await api.get<PagosEnPunto>(`/puntos/${puntoId}/pagos?documento=${doc}`)
    } catch (e) {
      if (CEDULAS_DEMO.includes(doc)) {
        res = {
          persona: { nombre: 'Jorge P.', etiqueta: 'C.C. ··· 567', tienePin: true },
          pagos: [
            {
              monto: '23000000',
              moneda: { codigo: 'COP', escala: 2 },
              vigenciaFin: '2026-10-31',
              programa: { id: 'prog-demo-subsidio', nombre: 'Subsidio de prueba', estado: 'Activo' },
            },
          ],
        }
      } else {
        setError(mensajeDeError(e))
      }
    }
    setEnviando(false)
    if (res) setConsulta(res)
    else setError((v) => v ?? 'Esta cédula no tiene pagos disponibles o no está registrada.')
  }

  const pagar = async (programaId?: string) => {
    setEnviando(true)
    setPidiendo(true)
    setError(null)
    try {
      const c = await api.post<Cobro>('/cobros', {
        documento: cedula.trim(),
        canal: 'retiro',
        puntoId,
        programaId,
        llaveIdempotencia: crypto.randomUUID(),
      })
      irAlCobroDelPunto(navegar, c)
    } catch (e) {
      if (CEDULAS_DEMO.includes(cedula.trim())) return navegar(`/punto/cobros/demo-${cedula.trim()}`)
      setError(mensajeDeError(e))
      setEnviando(false)
      setPidiendo(false)
    }
  }

  const otraCedula = () => {
    setConsulta(null)
    setCedula('')
    setError(null)
  }

  return { cedula, setCedula, consulta, enviando, pidiendo, error, setError, consultar, pagar, otraCedula }
}

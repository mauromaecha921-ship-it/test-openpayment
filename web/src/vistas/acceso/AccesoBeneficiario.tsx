import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, mensajeDeError } from '@/api/client'
import type { BeneficiarioDemo } from '@/api/tipos'
import { Campo } from '@/componentes/Campo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'

import { MarcoAcceso, NotaAcceso } from './MarcoAcceso'

const conEspacios = (doc: string) => doc.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Pantalla L1 del prototipo: la beneficiaria consulta sus subsidios con la cédula. */
export default function AccesoBeneficiario() {
  const navegar = useNavigate()
  const rol = useRol()
  const [cedula, setCedula] = useState('52 418 300')
  const [error, setError] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)

  const entrar = async () => {
    const doc = cedula.replace(/\s/g, '')
    if (!/^\d{5,12}$/.test(doc)) return setError('Escribe tu cédula: solo números, de 5 a 12 dígitos.')
    setBuscando(true)
    setError(null)
    try {
      const lista = await api.get<BeneficiarioDemo[]>('/beneficiarios/demo')
      const b = lista.find((x) => x.documento === doc)
      if (!b) return setError('No encontramos esa cédula. Pídele a tu entidad que te registre.')
      rol.actualizar({ rol: 'beneficiario', documento: b.documento, nombre: b.nombre })
      navegar('/beneficiario')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setBuscando(false)
    }
  }

  return (
    <MarcoAcceso
      titular="Cobra tu subsidio sin filas"
      texto="Míralo aquí y cóbralo a tu billetera, o en un punto de retiro con tu cédula y tu PIN."
      titulo="Consulta tus subsidios"
      intro="Escribe tu número de cédula para ver lo que tienes por cobrar."
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void entrar()
        }}
      >
        <Campo
          etiqueta="Número de cédula"
          inputMode="numeric"
          autoComplete="off"
          value={cedula}
          error={error}
          ayuda="Solo números, sin puntos."
          claseInput="h-16 border-2 border-foreground text-[26px] font-bold tracking-[0.04em] md:text-[26px]"
          onChange={(e) => {
            setCedula(conEspacios(e.target.value))
            setError(null)
          }}
        />
        <Button type="submit" size="lg" className="min-h-14 text-lg font-bold" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Entrar'}
        </Button>
        <NotaAcceso>
          <Lock aria-hidden className="mt-0.5 size-[18px] shrink-0" />
          <span>Para cobrar siempre te pediremos algo más: tu cuenta verificada o tu PIN en el punto. Con la cédula sola nadie puede cobrar tu subsidio.</span>
        </NotaAcceso>
        <Link to="/equipo" className="self-start text-[15px]">
          ¿No estás registrada? Regístrate en el equipo de prueba
        </Link>
      </form>
    </MarcoAcceso>
  )
}

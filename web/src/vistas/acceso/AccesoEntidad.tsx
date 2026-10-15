import { Lock } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Campo } from '@/componentes/Campo'
import { Button } from '@/componentes/ui/button'
import { useRol } from '@/contexto/Rol'

import { MarcoAcceso, NotaAcceso } from './MarcoAcceso'

/** «900000001-5» → «900 000 001-5» */
function conFormato(nit: string): string {
  const [cuerpo, dv] = nit.replace(/[^\d-]/g, '').split('-')
  const grupos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return dv !== undefined ? `${grupos}-${dv.slice(0, 1)}` : grupos
}

const NIT_VALIDO = /^\d{8,10}-\d$/

// Huella SHA-256 del PIN de la entidad: el PIN no está en el código, se compara su huella
const HUELLA_PIN = '023f5351b94db0bdcde8dd21da240ac75adc1fc82371c516543b25485cb900de'

async function huella(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Pantalla LD1 del prototipo: la entidad entra con su NIT y ve sus programas. */
export default function AccesoEntidad() {
  const navegar = useNavigate()
  const rol = useRol()
  const [nit, setNit] = useState('900 000 001-5')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorPin, setErrorPin] = useState<string | null>(null)

  const entrar = async () => {
    if (!NIT_VALIDO.test(nit.replace(/\s/g, ''))) return setError('Escribe el NIT con su dígito de verificación, por ejemplo 900 000 001-5.')
    if ((await huella(pin)) !== HUELLA_PIN) return setErrorPin('PIN incorrecto.')
    rol.actualizar({ rol: 'entidad', programaId: null })
    navegar('/entidad')
  }

  return (
    <MarcoAcceso
      titular="La plata sale cuando alguien cobra"
      texto="Autoriza tus programas una vez en tu banco y sigue en tiempo real lo que se cobra y lo que nunca salió de tu cuenta."
      titulo="Entra como entidad"
      intro="Escribe el NIT de tu entidad para ver tus programas."
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void entrar()
        }}
      >
        <Campo
          etiqueta="NIT de la entidad"
          inputMode="numeric"
          autoComplete="off"
          value={nit}
          error={error}
          ayuda="Con el dígito de verificación, sin puntos."
          claseInput="h-[60px] border-2 border-foreground text-2xl font-bold tracking-[0.03em] md:text-2xl"
          onChange={(e) => {
            setNit(conFormato(e.target.value))
            setError(null)
          }}
        />
        <Campo
          etiqueta="PIN de acceso"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          error={errorPin}
          ayuda="El PIN de 6 dígitos de la entidad."
          claseInput="h-[60px] border-2 border-foreground text-2xl font-bold tracking-[0.3em] md:text-2xl"
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''))
            setErrorPin(null)
          }}
        />
        <Button type="submit" size="lg" className="min-h-14 text-lg font-bold">
          Entrar
        </Button>
        <NotaAcceso>
          <Lock aria-hidden className="mt-0.5 size-[18px] shrink-0" />
          <span>Entrar no mueve dinero. Cada programa se autoriza aparte, en tu banco.</span>
        </NotaAcceso>
      </form>
    </MarcoAcceso>
  )
}

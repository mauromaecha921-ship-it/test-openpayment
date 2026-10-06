import { RolProvider, useRol, type Rol } from './contexto/Rol'

// HU-19: selector de rol sin login (AD-15) + enrutamiento por rol.
// P-15: pendiente confirmar react-router o vista condicional al construir las vistas.
const ROLES: { rol: Rol; etiqueta: string }[] = [
  { rol: 'entidad', etiqueta: 'Entidad' },
  { rol: 'beneficiario', etiqueta: 'Beneficiario' },
  { rol: 'punto', etiqueta: 'Punto' },
]

function SelectorDeRol() {
  const { elegirRol } = useRol()
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="mb-2 text-center text-2xl font-semibold">Tatú</h1>
      {ROLES.map(({ rol, etiqueta }) => (
        <button
          key={rol}
          type="button"
          className="rounded-lg border px-4 py-3 text-lg"
          onClick={() => elegirRol(rol)}
        >
          {etiqueta}
        </button>
      ))}
    </main>
  )
}

function VistaActual() {
  const { rol, salir } = useRol()
  if (!rol) return <SelectorDeRol />

  // TODO: montar vistas/entidad, vistas/beneficiario o vistas/punto según el rol.
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-3 p-6 text-center">
      <p>
        Rol elegido: <strong>{rol}</strong> (vista pendiente de construir)
      </p>
      <button type="button" className="rounded-lg border px-4 py-2" onClick={salir}>
        Cambiar de rol
      </button>
    </main>
  )
}

export default function App() {
  return (
    <RolProvider>
      <VistaActual />
    </RolProvider>
  )
}

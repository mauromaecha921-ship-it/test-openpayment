import { CircleCheck, CircleHelp, CircleX, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { API_SIMULADA } from '@/api/client'
import { useEstadoSistema } from '@/api/estado'
import { Cargando, ErrorCarga, Tarjeta, Volver } from '@/componentes/Comun'
import { Encabezado } from '@/componentes/Encabezado'
import { Titulo } from '@/componentes/Titulo'
import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'

type Revision = 'ok' | 'falla' | 'duda'

function Paso({ estado, titulo, children }: { estado: Revision; titulo: string; children: ReactNode }) {
  const Icono = estado === 'ok' ? CircleCheck : estado === 'falla' ? CircleX : CircleHelp
  return (
    <li className="flex items-start gap-3 border-t border-border py-4 first:border-t-0">
      <Icono
        aria-hidden
        className={cn('mt-0.5 size-6 shrink-0', estado === 'ok' ? 'text-pagado' : estado === 'falla' ? 'text-rechazo' : 'text-pagando')}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <strong>
          {titulo}
          <span className="sr-only">{estado === 'ok' ? ': listo' : estado === 'falla' ? ': falta' : ': sin confirmar'}</span>
        </strong>
        <div className="text-[15px] text-muted-foreground [overflow-wrap:anywhere]">{children}</div>
      </div>
    </li>
  )
}

const Cmd = ({ children }: { children: ReactNode }) => <code className="mono rounded bg-muted px-1.5 py-0.5 text-[14px] text-foreground">{children}</code>

/** /estado: ¿los pagos salen de verdad hacia la Test Wallet? Y si no, qué falta (Plan de ajustes § 3, F3). */
export default function Estado() {
  const { estado, recargar } = useEstadoSistema()
  const [revisando, setRevisando] = useState(false)

  const revisar = async () => {
    setRevisando(true)
    await recargar()
    setRevisando(false)
  }

  const op = estado?.openPayments
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Encabezado variante="entrada" />
      <main className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 md:pt-8">
        <Volver to="/">Volver a la entrada</Volver>
        <Titulo className="text-[28px] sm:text-[36px]">Estado de los pagos</Titulo>

        {API_SIMULADA && (
          <p className="m-0 rounded-xl border-2 border-dashed border-control p-4">
            Estás en el modo «API simulada»: todo pasa en el navegador y nada sale de la Test Wallet. Para pagar de verdad, arranca la API
            con <Cmd>pnpm dev</Cmd>.
          </p>
        )}
        {!API_SIMULADA && estado === undefined && <Cargando texto="Revisando…" />}
        {!API_SIMULADA && estado === null && (
          <ErrorCarga mensaje="La API no responde. Arráncala con «pnpm dev» en la raíz del proyecto." reintentar={() => void revisar()} />
        )}

        {estado && (
          <>
            <div
              role="status"
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 p-5 text-lg',
                estado.pagosReales ? 'border-pagado bg-pagado-fondo text-pagado' : 'border-pagando bg-pagando-fondo text-pagando',
              )}
            >
              {estado.pagosReales ? <CircleCheck aria-hidden className="mt-0.5 size-7 shrink-0" /> : <CircleX aria-hidden className="mt-0.5 size-7 shrink-0" />}
              <div className="flex flex-col gap-1">
                <strong>{estado.pagosReales ? 'Los pagos salen de verdad hacia la Test Wallet' : 'Los pagos están simulados: nada sale de la Test Wallet'}</strong>
                {!estado.pagosReales && (
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-base">
                    {estado.faltan.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Tarjeta aria-labelledby="titulo-revision" className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="titulo-revision" className="m-0 text-xl font-bold">
                  Qué revisamos
                </h2>
                <Button variant="outline" onClick={() => void revisar()} disabled={revisando}>
                  <RefreshCw aria-hidden className={cn('size-4', revisando && 'animate-spin motion-reduce:animate-none')} />
                  Volver a revisar
                </Button>
              </div>
              <ul className="m-0 list-none p-0">
                <Paso estado={op?.configurado ? 'ok' : 'falla'} titulo="Llave de desarrollador configurada">
                  {op?.configurado ? (
                    'Están la wallet cliente, el Key ID y la llave privada.'
                  ) : (
                    <>
                      {op?.detalle}. Llena <Cmd>OP_CLIENT_WALLET_ADDRESS</Cmd>, <Cmd>OP_KEY_ID</Cmd> y <Cmd>OP_PRIVATE_KEY_PATH</Cmd> (o{' '}
                      <Cmd>OP_PRIVATE_KEY_BASE64</Cmd>) en el <Cmd>.env</Cmd> y reinicia la API. En Vercel van en las variables del proyecto y se vuelve a desplegar.
                    </>
                  )}
                </Paso>
                <Paso
                  estado={op?.coincide === true ? 'ok' : op?.coincide === false ? 'falla' : 'duda'}
                  titulo="La llave coincide con la que publicó la Test Wallet"
                >
                  {op?.configurado ? op.detalle : 'Se revisa cuando la llave esté configurada.'}
                </Paso>
                <Paso estado={estado.programasConTokenFalso ? 'falla' : 'ok'} titulo="Sin programas de la semilla «solo UI»">
                  {estado.programasConTokenFalso ? (
                    <>
                      La BD tiene datos de mentira con un permiso falso. Apaga la API, corre <Cmd>pnpm --filter api db:reset</Cmd> y vuelve a
                      arrancarla.
                    </>
                  ) : (
                    'Los programas activos tienen un permiso de verdad (o todavía no hay programas).'
                  )}
                </Paso>
                <Paso estado="ok" titulo="Verificación de cuentas">
                  {estado.verificacionCuenta === 'subject'
                    ? 'Al cambiar de cuenta en «Mi cuenta», la persona la confirma en su Test Wallet. Las personas registradas en «Equipo de prueba» quedan listas de una vez.'
                    : 'Simulada (plan B de HU-07): las cuentas quedan verificadas sin pasar por la Test Wallet.'}
                </Paso>
                {estado.puenteBreB && (
                  <Paso estado={estado.puenteBreB.responde ? 'ok' : 'falla'} titulo="Banco puente de Bre-B">
                    {estado.puenteBreB.responde
                      ? estado.puenteBreB.simulado
                        ? 'Simulado por esta API: cada llave Bre-B apunta a una wallet de la Test Wallet (las registra «Equipo de prueba»). El dinero sí se mueve en la Test Wallet.'
                        : 'Responde el banco puente que indica PUENTE_URL.'
                      : 'No responde: cobrar a una llave Bre-B no funciona. Revisa PUENTE_URL o PUENTE_SIMULAR_FALLA en el .env.'}
                  </Paso>
                )}
              </ul>
            </Tarjeta>
          </>
        )}

        <Tarjeta aria-labelledby="titulo-como">
          <h2 id="titulo-como" className="m-0 text-xl font-bold">
            Cómo conectar la Test Wallet
          </h2>
          <ol className="m-0 flex flex-col gap-2.5 pl-5 text-[15px]">
            <li>
              Cada persona del equipo crea su cuenta en la Test Wallet y una wallet en <strong>COP</strong>. Quien va a pagar deposita saldo de
              prueba en la suya.
            </li>
            <li>
              Quien maneja la API genera una llave de desarrollador para una de sus wallets (en la Test Wallet, en la configuración de llaves
              de desarrollador). Guarda la llave privada <strong>fuera del repositorio</strong> y copia el Key ID.
            </li>
            <li>
              En el <Cmd>.env</Cmd> de la raíz: <Cmd>OP_CLIENT_WALLET_ADDRESS</Cmd> con esa wallet, <Cmd>OP_KEY_ID</Cmd> con el Key ID y{' '}
              <Cmd>OP_PRIVATE_KEY_PATH</Cmd> con la ruta del archivo de la llave. En Vercel van en las variables del proyecto, con la llave
              en <Cmd>OP_PRIVATE_KEY_BASE64</Cmd>.
            </li>
            <li>
              En local, corre <Cmd>pnpm --filter api db:reset</Cmd> (BD limpia) y arranca todo con <Cmd>pnpm dev</Cmd>.
            </li>
            <li>Registren a las personas en «Equipo de prueba», creen el programa con la wallet de quien paga y apruébenlo en su Test Wallet.</li>
          </ol>
        </Tarjeta>
      </main>
    </div>
  )
}

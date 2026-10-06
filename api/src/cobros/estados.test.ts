import { describe, it } from 'vitest'

describe('máquina de estados del cobro', () => {
  it.todo('avanza Solicitado → PorConfirmar → Pagando → Pagado')
  it.todo('canal cuenta: Solicitado → Pagando sin PIN (HU-09)')
  it.todo('rechaza transiciones no listadas')
  it.todo('PorConfirmar vencido (120 s) → Rechazado al consultar (RN-12)')
})

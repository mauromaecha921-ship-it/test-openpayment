import type { NavigateFunction } from 'react-router'

import type { Cobro } from '@/api/tipos'
import { marcarPagando } from '@/componentes/TatuEnrolla'

/**
 * Lleva a la pantalla del cobro que se acaba de pedir con los datos que ya devolvió la API: así no
 * pasa por la pantalla de carga. Mientras se pedía, el tatú ya venía rodando (PidiendoPago): si quedó
 * en curso, «Pagando…» sigue rodando; si se rechazó (por ejemplo, otro cobro en curso), frena y
 * termina en el logo con la cerradura roja.
 */
export function irAlCobroPedido(navegar: NavigateFunction, c: Cobro, opciones: { replace?: boolean } = {}) {
  marcarPagando(c.id)
  navegar(`/beneficiario/cobros/${c.id}`, { replace: opciones.replace, state: { cobro: c } })
}

/**
 * Lo mismo en el punto: lleva al cobro con sus datos (sin pantalla de carga). Si se rechazó al
 * pedirlo (ya cobrado, en proceso…), el rechazo llega rodando y termina enrollado en rojo, como en
 * la cuenta; si sigue al PIN, la pantalla del PIN sale de una vez.
 */
export function irAlCobroDelPunto(navegar: NavigateFunction, c: Cobro) {
  if (c.estado === 'Rechazado' || c.estado === 'Fallido') marcarPagando(c.id)
  navegar(`/punto/cobros/${c.id}`, { state: { cobro: c } })
}

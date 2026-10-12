// Verificación del hash del callback interactivo (HU-04) con las 3 variantes
// base64 (Hallazgos § 3.5). Función pura: sin red ni base de datos.
//
// El callback es idempotente y maneja `grant_rejected` y `grant_invalid`
// (Guía § Revisión · Callback con verificación de hash).

import { createHash } from 'node:crypto'

export interface CallbackParams {
  interactRef: string
  hash?: string
  result?: 'grant_accepted' | 'grant_rejected' | 'grant_invalid'
}

export class HashNoCoincideError extends Error {
  constructor() {
    super('El hash del callback no coincide')
    this.name = 'HashNoCoincideError'
  }
}

export class CallbackRechazadoError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'CallbackRechazadoError'
  }
}

function normalizarBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function calcularCandidatos(base: string) {
  const raw = createHash('sha256').update(base).digest('base64')
  const estandarSinPadding = raw.replace(/=+$/, '')
  const urlSafe = normalizarBase64(raw)
  const candidatos = new Set([raw, estandarSinPadding, urlSafe])
  return candidatos
}

export function calcularHashCallback(params: {
  nonce: string
  finishNonce: string
  interactRef: string
  grantUrl: string
}): string {
  const base = `${params.nonce}\n${params.finishNonce}\n${params.interactRef}\n${params.grantUrl}`
  const candidatos = calcularCandidatos(base)
  return Array.from(candidatos)[0]
}

export function verificarHashCallback(
  params: {
    nonce: string
    finishNonce: string
    interactRef: string
    grantUrl: string
    hashRecibido?: string
  },
  resultado?: CallbackParams['result'],
): void {
  if (resultado === 'grant_rejected') {
    throw new CallbackRechazadoError('La aprobación fue rechazada en el banco')
  }
  if (resultado === 'grant_invalid') {
    throw new CallbackRechazadoError('La aprobación venció o no es válida')
  }

  const base = `${params.nonce}\n${params.finishNonce}\n${params.interactRef}\n${params.grantUrl}`
  const candidatos = calcularCandidatos(base)
  const hashRecibido = params.hashRecibido?.trim()
  if (!hashRecibido) throw new HashNoCoincideError()
  if (!candidatos.has(hashRecibido) && !candidatos.has(normalizarBase64(hashRecibido))) {
    throw new HashNoCoincideError()
  }
}

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

let actual: DatabaseSync | undefined

/** Abre (o crea) la BD y fija los PRAGMA que SQLite no trae por defecto (Plan backend § 4.3). */
export function abrirBd(ruta: string): DatabaseSync {
  if (ruta !== ':memory:') mkdirSync(path.dirname(ruta), { recursive: true })
  const bd = new DatabaseSync(ruta)
  // Sin esto SQLite no revisa las llaves foráneas.
  bd.exec('PRAGMA foreign_keys = ON')
  bd.exec('PRAGMA journal_mode = WAL')
  bd.exec('PRAGMA busy_timeout = 5000')
  actual = bd
  return bd
}

export function bd(): DatabaseSync {
  if (!actual) throw new Error('La base de datos no está abierta (llama a abrirBd primero)')
  return actual
}

export function cerrarBd() {
  actual?.close()
  actual = undefined
}

/**
 * BEGIN IMMEDIATE … COMMIT, con ROLLBACK si algo falla. Es síncrona a propósito: sin `await`
 * adentro, ninguna otra petición se intercala a mitad de una escritura. Si ya hay una
 * transacción abierta, corre dentro de ella.
 */
export function transaccion<T>(fn: () => T): T {
  const b = bd()
  if (b.isTransaction) return fn()
  b.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    if (r instanceof Promise) throw new Error('transaccion() no admite funciones async')
    b.exec('COMMIT')
    return r
  } catch (e) {
    b.exec('ROLLBACK')
    throw e
  }
}

export type Parametros = Record<string, SQLInputValue>

export function uno<T>(sql: string, p: Parametros = {}): T | undefined {
  return bd().prepare(sql).get(p) as T | undefined
}

export function varios<T>(sql: string, p: Parametros = {}): T[] {
  return bd().prepare(sql).all(p) as T[]
}

/** Devuelve cuántas filas cambió. */
export function ejecutar(sql: string, p: Parametros = {}): number {
  return Number(bd().prepare(sql).run(p).changes)
}

export const ahoraIso = () => new Date().toISOString()

/** ¿El error es una restricción de SQLite (UNIQUE, CHECK, FK o un RAISE de trigger)? */
export function esRestriccion(e: unknown, texto?: string): boolean {
  const err = e as { code?: string; errcode?: number; message?: string }
  const esSqlite = err?.code === 'ERR_SQLITE_ERROR'
  if (!esSqlite) return false
  return texto ? (err.message ?? '').includes(texto) : true
}

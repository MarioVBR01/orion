/**
 * Fractional indexing con claves string base-62 (algoritmo de punto medio).
 * Las claves se comparan lexicográficamente (mismo orden que usa Firestore para strings ASCII).
 * Invariante: ninguna clave termina en "0", así siempre existe una clave menor.
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE = DIGITS.length

function digit(c: string): number {
  const i = DIGITS.indexOf(c)
  if (i < 0) throw new Error(`Carácter inválido en clave de orden: ${c}`)
  return i
}

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0
    while ((a.charAt(n) || '0') === b.charAt(n)) n++
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const da = a ? digit(a.charAt(0)) : 0
  const dbv = b !== null ? digit(b.charAt(0)) : BASE
  if (dbv - da > 1) return DIGITS.charAt(Math.round((da + dbv) / 2))
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return DIGITS.charAt(da) + midpoint(a.slice(1), null)
}

/** Devuelve una clave estrictamente entre a y b (null = extremo abierto). */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) throw new Error(`keyBetween: ${a} >= ${b}`)
  if (a !== null && a.endsWith('0')) throw new Error(`Clave inválida: ${a}`)
  if (b !== null && b.endsWith('0')) throw new Error(`Clave inválida: ${b}`)
  return midpoint(a ?? '', b)
}

/** Genera n claves crecientes entre a y b. */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  const keys: string[] = []
  let prev = a
  for (let i = 0; i < n; i++) {
    const k = keyBetween(prev, b)
    keys.push(k)
    prev = k
  }
  return keys
}

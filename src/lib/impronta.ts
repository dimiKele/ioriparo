/**
 * Impronta breve di una stringa (FNV-1a a 32 bit più la lunghezza).
 *
 * Non è una firma crittografica e non deve diventarlo: serve solo a capire in
 * fretta se due contenuti sono gli stessi, senza tenerli entrambi in memoria.
 * La lunghezza in coda rende improbabile che due testi diversi collidano.
 */
export function impronta(testo: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < testo.length; i++) {
    hash ^= testo.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}-${testo.length.toString(36)}`
}

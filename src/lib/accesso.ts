/**
 * Accesso al gestionale.
 *
 * La schermata iniziale serve a non lasciare l'archivio in chiaro sullo
 * schermo di una postazione lasciata incustodita. Non è cifratura: i dati
 * restano leggibili negli strumenti per sviluppatori del browser, e questa
 * scelta è consapevole — le postazioni sono del negozio, e cifrare la copia
 * locale significherebbe perderla insieme a una password dimenticata.
 *
 * Dell'impronta della password si tiene una copia sul dispositivo: permette di
 * rientrare anche quando la linea è giù, che in un negozio capita.
 */

const CHIAVE_IMPRONTA = 'ioriparo:accesso:v1'
const CHIAVE_SOLO_LOCALE = 'ioriparo:solo-locale:v1'

/** Iterazioni PBKDF2: rendono costoso provare password a tappeto. */
const ITERAZIONI = 210_000

interface ImprontaSalvata {
  sale: string
  hash: string
  iterazioni: number
}

function aBase64(byte: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(byte)))
}

function daBase64(testo: string): Uint8Array {
  const grezzo = atob(testo)
  const byte = new Uint8Array(grezzo.length)
  for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i)
  return byte
}

async function derivaHash(
  password: string,
  sale: Uint8Array,
  iterazioni: number,
): Promise<ArrayBuffer> {
  const materiale = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sale as BufferSource, iterations: iterazioni, hash: 'SHA-256' },
    materiale,
    256,
  )
}

function leggiImpronta(): ImprontaSalvata | null {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_IMPRONTA)
    if (!grezzo) return null
    const salvata = JSON.parse(grezzo) as ImprontaSalvata
    return salvata?.sale && salvata?.hash ? salvata : null
  } catch {
    return null
  }
}

/** Vero se questa postazione ha già visto la password almeno una volta. */
export function haImprontaLocale(): boolean {
  return leggiImpronta() !== null
}

/** Registra l'impronta dopo un accesso riuscito, per gli sblocchi futuri. */
export async function memorizzaPassword(password: string): Promise<void> {
  const sale = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivaHash(password, sale, ITERAZIONI)
  const impronta: ImprontaSalvata = {
    sale: aBase64(sale.buffer as ArrayBuffer),
    hash: aBase64(hash),
    iterazioni: ITERAZIONI,
  }
  try {
    window.localStorage.setItem(CHIAVE_IMPRONTA, JSON.stringify(impronta))
  } catch {
    // Senza impronta si potrà rientrare solo con la rete disponibile.
  }
}

/** Confronto locale, usato quando il server non è raggiungibile. */
export async function verificaPasswordLocale(password: string): Promise<boolean> {
  const impronta = leggiImpronta()
  if (!impronta) return false

  const hash = await derivaHash(password, daBase64(impronta.sale), impronta.iterazioni)
  const atteso = daBase64(impronta.hash)
  const ottenuto = new Uint8Array(hash)
  if (atteso.length !== ottenuto.length) return false

  // Confronto a tempo costante, come lato server.
  let differenza = 0
  for (let i = 0; i < atteso.length; i++) differenza |= atteso[i] ^ ottenuto[i]
  return differenza === 0
}

/** L'operatore ha scelto di lavorare senza server su questo dispositivo. */
export function soloLocale(): boolean {
  try {
    return window.localStorage.getItem(CHIAVE_SOLO_LOCALE) === '1'
  } catch {
    return false
  }
}

export function impostaSoloLocale(attivo: boolean) {
  try {
    if (attivo) window.localStorage.setItem(CHIAVE_SOLO_LOCALE, '1')
    else window.localStorage.removeItem(CHIAVE_SOLO_LOCALE)
  } catch {
    // Storage non disponibile: la scelta vale per la sola sessione.
  }
}

/**
 * Dimentica la password su questo dispositivo.
 * L'archivio locale resta: si sta bloccando l'accesso, non cancellando i dati.
 */
export function dimenticaAccesso() {
  try {
    window.localStorage.removeItem(CHIAVE_IMPRONTA)
    window.localStorage.removeItem(CHIAVE_SOLO_LOCALE)
  } catch {
    // Nulla da fare.
  }
}

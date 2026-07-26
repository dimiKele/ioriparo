/**
 * Dialogo con il server del negozio.
 *
 * L'archivio locale resta la copia su cui l'applicazione lavora: così una
 * caduta di rete non impedisce di accettare un dispositivo o consultare una
 * scheda. Ogni modifica viene marcata come «da inviare» e spedita alla prima
 * occasione utile; in caso di conflitto vince la versione del server, perché
 * la modifica arrivata per ultima non deve poter cancellare in silenzio quella
 * di un collega.
 */

import type { DatabaseGestionale } from '@/types'
import { impronta } from './impronta'

/** Collezioni sincronizzate, nell'ordine in cui vengono ricomposte. */
export const COLLEZIONI_SINCRONIZZATE = [
  'clienti',
  'riparazioni',
  'preventivi',
  'fatture',
  'magazzino',
  'ordini',
  'scadenze',
  'impianti',
  'movimenti',
] as const

export type CollezioneSincronizzata = (typeof COLLEZIONI_SINCRONIZZATE)[number]
/** L'anagrafica aziendale è un documento unico, non una collezione. */
export type CollezioneRemota = CollezioneSincronizzata | 'azienda'

export const ID_AZIENDA = 'singolo'

export interface RecordRemoto {
  collezione: CollezioneRemota
  id: string
  dati: unknown
  aggiornatoIl: number
  eliminato: boolean
}

/** Metadati di un'immagine conservata nel bucket: i byte si scaricano a parte. */
export interface MetadatoAllegato {
  id: string
  riparazioneId: string
  tipo: 'foto' | 'firma'
  ordine: number
  tipoMime: string
  byte: number
  aggiornatoIl: number
  eliminato: boolean
}

export interface EsitoSincronizzazione {
  istante: number
  record: RecordRemoto[]
  allegati: MetadatoAllegato[]
  rifiutati: Array<{ collezione: string; id: string }>
}

export class ErroreServer extends Error {
  /** Vero quando la sessione è scaduta e va rifatto l'accesso. */
  nonAutorizzato: boolean

  constructor(messaggio: string, nonAutorizzato = false) {
    super(messaggio)
    this.nonAutorizzato = nonAutorizzato
  }
}

export interface ConfigurazioneServer {
  /** Indirizzo base dell'API, senza barra finale. */
  indirizzo: string
  token?: string
  scadenzaToken?: number
}

const CHIAVE_CONFIGURAZIONE = 'ioriparo:server:v1'

/**
 * Indirizzo proposto all'accesso, fissato in fase di compilazione.
 * Evita di far digitare un URL al banco, dove si sbaglia facilmente.
 */
export const SERVER_PREDEFINITO: string = import.meta.env.VITE_SERVER ?? ''

export function leggiConfigurazione(): ConfigurazioneServer | null {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_CONFIGURAZIONE)
    if (!grezzo) return null
    const salvata = JSON.parse(grezzo) as ConfigurazioneServer
    return typeof salvata?.indirizzo === 'string' ? salvata : null
  } catch {
    return null
  }
}

export function salvaConfigurazione(configurazione: ConfigurazioneServer | null) {
  try {
    if (configurazione) {
      window.localStorage.setItem(CHIAVE_CONFIGURAZIONE, JSON.stringify(configurazione))
    } else {
      window.localStorage.removeItem(CHIAVE_CONFIGURAZIONE)
    }
  } catch {
    // Storage non disponibile: si resta collegati per la sola sessione.
  }
}

export function sessioneAttiva(configurazione: ConfigurazioneServer | null): boolean {
  return Boolean(
    configurazione?.token &&
      (configurazione.scadenzaToken === undefined || configurazione.scadenzaToken > Date.now()),
  )
}

function normalizzaIndirizzo(indirizzo: string): string {
  return indirizzo.trim().replace(/\/+$/, '')
}

async function chiamata(
  configurazione: ConfigurazioneServer,
  percorso: string,
  opzioni: RequestInit = {},
): Promise<unknown> {
  const intestazioni = new Headers(opzioni.headers)
  intestazioni.set('Content-Type', 'application/json')
  if (configurazione.token) intestazioni.set('Authorization', `Bearer ${configurazione.token}`)

  let risposta: Response
  try {
    risposta = await fetch(`${normalizzaIndirizzo(configurazione.indirizzo)}${percorso}`, {
      ...opzioni,
      headers: intestazioni,
    })
  } catch {
    // Nessuna rete: non è un errore da mostrare come guasto, è il caso
    // normale per cui esiste la copia locale.
    throw new ErroreServer('Server non raggiungibile.')
  }

  const corpo = (await risposta.json().catch(() => null)) as { errore?: string } | null
  if (!risposta.ok) {
    // Il messaggio arriva dal server: un 401 all'accesso è una password
    // sbagliata, altrove è una sessione da rinnovare, e dirlo bene conta.
    throw new ErroreServer(
      corpo?.errore ?? `Il server ha risposto ${risposta.status}.`,
      risposta.status === 401,
    )
  }
  return corpo
}

/** Verifica che l'indirizzo indicato sia davvero un server IO RIPARO. */
export async function verificaServer(indirizzo: string): Promise<{ configurato: boolean }> {
  const esito = (await chiamata({ indirizzo }, '/api/stato', { method: 'GET' })) as {
    applicazione?: string
    configurato?: boolean
  }
  if (esito?.applicazione !== 'ioriparo') {
    throw new ErroreServer('All’indirizzo indicato non risponde un server IO RIPARO.')
  }
  return { configurato: Boolean(esito.configurato) }
}

export async function accedi(indirizzo: string, password: string): Promise<ConfigurazioneServer> {
  const esito = (await chiamata({ indirizzo }, '/api/accesso', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })) as { token: string; scadenza: number }

  return {
    indirizzo: normalizzaIndirizzo(indirizzo),
    token: esito.token,
    scadenzaToken: esito.scadenza,
  }
}

/**
 * Rimuove le immagini dal record prima di inviarlo.
 *
 * I byte vivono nel bucket R2 e viaggiano per conto proprio: nel record resta
 * il solo elenco dei riferimenti, che è leggero e dice a ogni postazione quali
 * immagini deve ancora scaricare.
 */
export function senzaAllegati(voce: { id: string }): { id: string } {
  if (!('foto' in voce) && !('firmaCliente' in voce)) return voce
  const { foto: _foto, firmaCliente: _firma, ...resto } = voce as Record<string, unknown> & {
    id: string
  }
  return resto as { id: string }
}

/**
 * Scompone l'archivio in record indipendenti.
 * È la granularità con cui il server ragiona: due postazioni che toccano
 * schede diverse non si sovrascrivono.
 */
export function scomponi(db: DatabaseGestionale): Array<Omit<RecordRemoto, 'aggiornatoIl'>> {
  const record: Array<Omit<RecordRemoto, 'aggiornatoIl'>> = []

  for (const collezione of COLLEZIONI_SINCRONIZZATE) {
    for (const voce of db[collezione] as Array<{ id: string }>) {
      record.push({ collezione, id: voce.id, dati: senzaAllegati(voce), eliminato: false })
    }
  }
  record.push({ collezione: 'azienda', id: ID_AZIENDA, dati: db.azienda, eliminato: false })
  return record
}

/**
 * Ricompone il record arrivato dal server conservando gli allegati locali:
 * il server non li trasporta, e senza questa cura una sincronizzazione
 * cancellerebbe le foto dalla postazione che le ha scattate.
 */
export function conservaAllegati(nuovo: { id: string }, esistente?: { id: string }): { id: string } {
  if (!esistente) return nuovo
  const precedente = esistente as Record<string, unknown>
  const allegati: Record<string, unknown> = {}
  if (precedente.foto !== undefined) allegati.foto = precedente.foto
  if (precedente.firmaCliente !== undefined) allegati.firmaCliente = precedente.firmaCliente
  return { ...nuovo, ...allegati }
}

/**
 * Applica all'archivio locale i record arrivati dal server.
 * Restituisce un archivio nuovo: le pagine si aggiornano da sole perché lo
 * store lo sostituisce.
 */
export function applica(db: DatabaseGestionale, record: RecordRemoto[]): DatabaseGestionale {
  if (record.length === 0) return db

  const aggiornato: DatabaseGestionale = {
    ...db,
    clienti: [...db.clienti],
    riparazioni: [...db.riparazioni],
    preventivi: [...db.preventivi],
    fatture: [...db.fatture],
    magazzino: [...db.magazzino],
    ordini: [...db.ordini],
    scadenze: [...db.scadenze],
    impianti: [...db.impianti],
    movimenti: [...db.movimenti],
  }

  for (const voce of record) {
    if (voce.collezione === 'azienda') {
      if (!voce.eliminato && voce.dati) {
        aggiornato.azienda = voce.dati as DatabaseGestionale['azienda']
      }
      continue
    }

    const elenco = aggiornato[voce.collezione] as Array<{ id: string }>
    const indice = elenco.findIndex((esistente) => esistente.id === voce.id)

    if (voce.eliminato) {
      if (indice >= 0) elenco.splice(indice, 1)
      continue
    }
    if (!voce.dati) continue

    const nuovo = voce.dati as { id: string }
    if (indice >= 0) elenco[indice] = conservaAllegati(nuovo, elenco[indice])
    else elenco.push(nuovo)
  }

  return aggiornato
}

/**
 * Firme dell'archivio all'ultimo allineamento riuscito: `collezione:id` →
 * impronta del contenuto inviato.
 *
 * Si conserva questa mappa invece di una copia dell'archivio perché deve
 * sopravvivere alla chiusura della scheda. Un confronto per identità di
 * riferimento non sopravvive: dopo un ricaricamento gli oggetti sono tutti
 * nuovi, l'intero archivio risulterebbe modificato e verrebbe rispedito al
 * server — riportando in vita anche ciò che era stato cancellato altrove.
 */
export type FirmeArchivio = Record<string, string>

const CHIAVE_FIRME = 'ioriparo:server:firme:v1'

function chiaveRecord(collezione: CollezioneRemota, id: string): string {
  return `${collezione}:${id}`
}

/** Impronta di un record, calcolata su ciò che viaggia davvero verso il server. */
function firmaRecord(dati: unknown): string {
  return impronta(JSON.stringify(dati ?? null))
}

/** Firme di tutto l'archivio, da usare come base del confronto successivo. */
export function firmeArchivio(db: DatabaseGestionale): FirmeArchivio {
  const firme: FirmeArchivio = {}

  for (const collezione of COLLEZIONI_SINCRONIZZATE) {
    for (const voce of db[collezione] as Array<{ id: string }>) {
      firme[chiaveRecord(collezione, voce.id)] = firmaRecord(senzaAllegati(voce))
    }
  }
  firme[chiaveRecord('azienda', ID_AZIENDA)] = firmaRecord(db.azienda)

  return firme
}

/** Cosa è cambiato rispetto alle firme dell'ultimo allineamento. */
export function modificheDaFirme(
  firme: FirmeArchivio,
  corrente: DatabaseGestionale,
): Array<Omit<RecordRemoto, 'aggiornatoIl'>> {
  const modifiche: Array<Omit<RecordRemoto, 'aggiornatoIl'>> = []
  const rimaste = new Set(Object.keys(firme))

  for (const collezione of COLLEZIONI_SINCRONIZZATE) {
    for (const voce of corrente[collezione] as Array<{ id: string }>) {
      const chiave = chiaveRecord(collezione, voce.id)
      const dati = senzaAllegati(voce)
      rimaste.delete(chiave)
      if (firme[chiave] !== firmaRecord(dati)) {
        modifiche.push({ collezione, id: voce.id, dati, eliminato: false })
      }
    }
  }

  const chiaveAzienda = chiaveRecord('azienda', ID_AZIENDA)
  rimaste.delete(chiaveAzienda)
  if (firme[chiaveAzienda] !== firmaRecord(corrente.azienda)) {
    modifiche.push({
      collezione: 'azienda',
      id: ID_AZIENDA,
      dati: corrente.azienda,
      eliminato: false,
    })
  }

  // Ciò che era nelle firme e non c'è più è stato cancellato: va segnalato,
  // altrimenti tornerebbe indietro al prossimo allineamento.
  for (const chiave of rimaste) {
    const separatore = chiave.indexOf(':')
    modifiche.push({
      collezione: chiave.slice(0, separatore) as CollezioneRemota,
      id: chiave.slice(separatore + 1),
      dati: null,
      eliminato: true,
    })
  }

  return modifiche
}

export function leggiFirme(): FirmeArchivio | null {
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_FIRME)
    if (!grezzo) return null
    const salvate = JSON.parse(grezzo) as unknown
    return salvate && typeof salvate === 'object' ? (salvate as FirmeArchivio) : null
  } catch {
    return null
  }
}

export function scriviFirme(firme: FirmeArchivio | null) {
  try {
    if (firme) window.localStorage.setItem(CHIAVE_FIRME, JSON.stringify(firme))
    else window.localStorage.removeItem(CHIAVE_FIRME)
  } catch {
    // Senza firme si rispedisce tutto: più traffico, nessun dato perso.
  }
}

/**
 * Archivio ricostruito dai soli record del server.
 *
 * Serve quando una postazione si collega per la prima volta a un negozio che
 * ha già i suoi dati: senza questo passaggio le manderebbe l'archivio
 * dimostrativo con cui ogni installazione parte.
 */
export function componiArchivio(
  record: RecordRemoto[],
  predefinito: DatabaseGestionale,
): DatabaseGestionale {
  const vuoto: DatabaseGestionale = {
    clienti: [],
    riparazioni: [],
    preventivi: [],
    fatture: [],
    magazzino: [],
    ordini: [],
    scadenze: [],
    impianti: [],
    movimenti: [],
    azienda: predefinito.azienda,
  }
  return applica(vuoto, record)
}

/** Legge l'archivio completo del server. */
export async function scaricaArchivio(
  configurazione: ConfigurazioneServer,
): Promise<EsitoSincronizzazione> {
  const esito = (await chiamata(configurazione, '/api/sincronizza?da=0', {
    method: 'GET',
  })) as EsitoSincronizzazione

  return {
    istante: esito.istante,
    record: Array.isArray(esito.record) ? esito.record : [],
    allegati: Array.isArray(esito.allegati) ? esito.allegati : [],
    rifiutati: [],
  }
}

export interface RichiestaSincronizzazione {
  configurazione: ConfigurazioneServer
  /** Istante dell'ultimo allineamento riuscito. */
  da: number
  /** Record modificati localmente da inviare. */
  daInviare: Array<Omit<RecordRemoto, 'aggiornatoIl'>>
  /** Nome della postazione, utile a capire chi ha scritto cosa. */
  origine: string
}

export async function sincronizza(
  richiesta: RichiestaSincronizzazione,
): Promise<EsitoSincronizzazione> {
  const esito = (await chiamata(richiesta.configurazione, '/api/sincronizza', {
    method: 'POST',
    body: JSON.stringify({
      da: richiesta.da,
      origine: richiesta.origine,
      record: richiesta.daInviare,
    }),
  })) as EsitoSincronizzazione

  return {
    istante: esito.istante,
    record: Array.isArray(esito.record) ? esito.record : [],
    allegati: Array.isArray(esito.allegati) ? esito.allegati : [],
    rifiutati: Array.isArray(esito.rifiutati) ? esito.rifiutati : [],
  }
}

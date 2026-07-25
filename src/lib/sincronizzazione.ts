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

export interface EsitoSincronizzazione {
  istante: number
  record: RecordRemoto[]
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

  if (risposta.status === 401) throw new ErroreServer('Sessione scaduta.', true)

  const corpo = (await risposta.json().catch(() => null)) as { errore?: string } | null
  if (!risposta.ok) {
    throw new ErroreServer(corpo?.errore ?? `Il server ha risposto ${risposta.status}.`)
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
 * Foto e firme restano sulla postazione che le ha acquisite.
 *
 * Un record di D1 non può superare 1 MB e una scheda con qualche foto lo
 * supera: gli allegati hanno una tabella dedicata sul server, ma finché il
 * trasferimento non è implementato è preferibile non inviarli affatto,
 * piuttosto che veder fallire la sincronizzazione dell'intera scheda.
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
 * Record modificati localmente rispetto all'ultimo allineamento.
 *
 * Il confronto è per riferimento: ogni modifica dello store crea un oggetto
 * nuovo e lascia intatti quelli non toccati, quindi basta questo per sapere
 * che cosa inviare, senza dover marcare a mano ogni operazione.
 */
export function calcolaModifiche(
  precedente: DatabaseGestionale,
  corrente: DatabaseGestionale,
): Array<Omit<RecordRemoto, 'aggiornatoIl'>> {
  const modifiche: Array<Omit<RecordRemoto, 'aggiornatoIl'>> = []

  for (const collezione of COLLEZIONI_SINCRONIZZATE) {
    const prima = precedente[collezione] as Array<{ id: string }>
    const dopo = corrente[collezione] as Array<{ id: string }>
    if (prima === dopo) continue

    const indicePrima = new Map(prima.map((voce) => [voce.id, voce]))

    for (const voce of dopo) {
      const originale = indicePrima.get(voce.id)
      if (originale !== voce) {
        modifiche.push({ collezione, id: voce.id, dati: senzaAllegati(voce), eliminato: false })
      }
      indicePrima.delete(voce.id)
    }

    // Ciò che resta nell'indice non c'è più: va segnalato come eliminato,
    // altrimenti tornerebbe indietro al prossimo allineamento.
    for (const rimosso of indicePrima.keys()) {
      modifiche.push({ collezione, id: rimosso, dati: null, eliminato: true })
    }
  }

  if (precedente.azienda !== corrente.azienda) {
    modifiche.push({
      collezione: 'azienda',
      id: ID_AZIENDA,
      dati: corrente.azienda,
      eliminato: false,
    })
  }

  return modifiche
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
    rifiutati: Array.isArray(esito.rifiutati) ? esito.rifiutati : [],
  }
}

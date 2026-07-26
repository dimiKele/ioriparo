/**
 * Trasferimento di foto e firme fra postazione e bucket R2.
 *
 * Le immagini non passano dal database: sono byte, e in un database
 * costerebbero cinquanta volte tanto occupando lo spazio che serve ai dati di
 * lavoro. Qui vengono caricate come oggetti e riscaricate su richiesta, con la
 * copia locale a fare da cache.
 */

import { ErroreServer, type ConfigurazioneServer, type MetadatoAllegato } from './sincronizzazione'
import type { RiferimentoAllegato, Riparazione } from '@/types'

/** Prefisso degli identificativi generati per gli allegati. */
const PREFISSO = 'alg'

function nuovoIdAllegato(): string {
  return `${PREFISSO}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Impronta del contenuto di un'immagine (FNV-1a a 32 bit più la lunghezza).
 *
 * Non serve a fini di sicurezza, solo a distinguere un'immagine da un'altra:
 * dice se quella che ho in mano è già stata caricata oppure è stata sostituita.
 */
export function impronta(dataUrl: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < dataUrl.length; i++) {
    hash ^= dataUrl.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}-${dataUrl.length.toString(36)}`
}

/** `data:image/jpeg;base64,…` → byte e tipo MIME. */
export function daDataUrl(dataUrl: string): { byte: Uint8Array; tipoMime: string } | null {
  const separatore = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || separatore < 0) return null

  const intestazione = dataUrl.slice(5, separatore)
  const tipoMime = intestazione.split(';')[0] || 'image/jpeg'
  if (!intestazione.includes('base64')) return null

  try {
    const grezzo = atob(dataUrl.slice(separatore + 1))
    const byte = new Uint8Array(grezzo.length)
    for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i)
    return { byte, tipoMime }
  } catch {
    return null
  }
}

export function aDataUrl(byte: Uint8Array, tipoMime: string): string {
  let testo = ''
  // A blocchi: `String.fromCharCode` con troppi argomenti fa saltare lo stack.
  const BLOCCO = 8192
  for (let i = 0; i < byte.length; i += BLOCCO) {
    testo += String.fromCharCode(...byte.subarray(i, i + BLOCCO))
  }
  return `data:${tipoMime};base64,${btoa(testo)}`
}

function indirizzo(configurazione: ConfigurazioneServer, percorso: string): string {
  return `${configurazione.indirizzo.replace(/\/+$/, '')}${percorso}`
}

function intestazioni(configurazione: ConfigurazioneServer, tipoMime?: string): Headers {
  const risultato = new Headers()
  if (configurazione.token) risultato.set('Authorization', `Bearer ${configurazione.token}`)
  if (tipoMime) risultato.set('Content-Type', tipoMime)
  return risultato
}

/** Carica un'immagine e restituisce il riferimento con cui ritrovarla. */
export async function caricaAllegato(
  configurazione: ConfigurazioneServer,
  riparazioneId: string,
  dataUrl: string,
  tipo: 'foto' | 'firma',
  ordine: number,
): Promise<RiferimentoAllegato> {
  const immagine = daDataUrl(dataUrl)
  if (!immagine) throw new ErroreServer('Immagine in un formato non riconosciuto.')

  const id = nuovoIdAllegato()
  const parametri = new URLSearchParams({ riparazione: riparazioneId, tipo, ordine: String(ordine) })

  const risposta = await fetch(indirizzo(configurazione, `/api/allegati/${id}?${parametri}`), {
    method: 'PUT',
    headers: intestazioni(configurazione, immagine.tipoMime),
    body: immagine.byte as BodyInit,
  })

  if (risposta.status === 401) throw new ErroreServer('Sessione scaduta.', true)
  if (!risposta.ok) {
    const corpo = (await risposta.json().catch(() => null)) as { errore?: string } | null
    throw new ErroreServer(corpo?.errore ?? `Caricamento non riuscito (${risposta.status}).`)
  }

  return { id, tipo, ordine, impronta: impronta(dataUrl) }
}

/** Rimuove dal bucket un'immagine non più presente sulla scheda. */
export async function eliminaAllegato(
  configurazione: ConfigurazioneServer,
  id: string,
): Promise<void> {
  await fetch(indirizzo(configurazione, `/api/allegati/${id}`), {
    method: 'DELETE',
    headers: intestazioni(configurazione),
  })
}

/** Scarica un'immagine e la riporta in data URL, pronta per essere mostrata. */
export async function scaricaAllegato(
  configurazione: ConfigurazioneServer,
  id: string,
): Promise<string> {
  const risposta = await fetch(indirizzo(configurazione, `/api/allegati/${id}`), {
    headers: intestazioni(configurazione),
  })

  if (risposta.status === 401) throw new ErroreServer('Sessione scaduta.', true)
  if (!risposta.ok) throw new ErroreServer(`Immagine non disponibile (${risposta.status}).`)

  const tipoMime = risposta.headers.get('Content-Type') ?? 'image/jpeg'
  return aDataUrl(new Uint8Array(await risposta.arrayBuffer()), tipoMime)
}

export interface RichiestaAllineamentoAllegati {
  configurazione: ConfigurazioneServer
  riparazioni: Riparazione[]
  /** Metadati degli allegati noti al server. */
  metadati: MetadatoAllegato[]
  /** Applica all'archivio i riferimenti o le immagini ricostruite. */
  aggiorna: (riparazioneId: string, modifiche: Partial<Riparazione>) => void
}

/**
 * Allinea le immagini in entrambe le direzioni.
 *
 * Sale ciò che esiste solo in locale; scende ciò che il server conosce e la
 * postazione non ha. Gira in secondo piano e ogni errore si limita a
 * rimandare: le immagini sono importanti, ma non devono bloccare il lavoro.
 */
export async function allineaAllegati(richiesta: RichiestaAllineamentoAllegati): Promise<void> {
  const { configurazione, riparazioni, metadati, aggiorna } = richiesta

  // I metadati servono a sapere che cosa il server ha cancellato: il resto si
  // deduce dai riferimenti che viaggiano dentro le schede.
  const eliminati = new Set(metadati.filter((m) => m.eliminato).map((m) => m.id))

  for (const riparazione of riparazioni) {
    try {
      await salgono(configurazione, riparazione, aggiorna)
      await scendono(configurazione, riparazione, eliminati, aggiorna)
    } catch (errore) {
      // Sessione scaduta: inutile insistere sulle altre schede.
      if (errore instanceof ErroreServer && errore.nonAutorizzato) return
    }
  }
}

/**
 * Carica le immagini che questa postazione ha e il server no.
 *
 * Il confronto è sull'impronta del contenuto: l'immagine resta in locale come
 * data URL anche dopo essere salita, quindi guardare la sua forma porterebbe a
 * ricaricarla a ogni allineamento.
 */
async function salgono(
  configurazione: ConfigurazioneServer,
  riparazione: Riparazione,
  aggiorna: RichiestaAllineamentoAllegati['aggiorna'],
): Promise<void> {
  const riferimenti = riparazione.allegati ?? []
  // La chiave include il tipo: una foto e una firma con lo stesso contenuto
  // restano due allegati distinti, e cancellandone una l'altra sopravvive.
  const chiave = (tipo: 'foto' | 'firma', dataUrl: string) => `${tipo} ${impronta(dataUrl)}`
  const conosciute = new Set(riferimenti.map((voce) => `${voce.tipo} ${voce.impronta}`))

  const foto = (riparazione.foto ?? []).filter((voce) => voce.startsWith('data:'))
  const firma = riparazione.firmaCliente?.startsWith('data:') ? riparazione.firmaCliente : undefined

  const daCaricare: Array<{ dataUrl: string; tipo: 'foto' | 'firma'; ordine: number }> = []
  for (const [indice, dataUrl] of foto.entries()) {
    if (!conosciute.has(chiave('foto', dataUrl))) {
      daCaricare.push({ dataUrl, tipo: 'foto', ordine: indice })
    }
  }
  if (firma && !conosciute.has(chiave('firma', firma))) {
    daCaricare.push({ dataUrl: firma, tipo: 'firma', ordine: 0 })
  }

  if (daCaricare.length === 0) return

  // Qui non si cancella nulla. Un riferimento senza immagine in locale può
  // voler dire due cose opposte — la foto è stata rimossa, oppure questa
  // postazione non l'ha ancora scaricata — e scegliere male significherebbe
  // distruggere le foto di un collega. La rimozione avviene dove l'intenzione
  // è certa: nel modulo di accettazione, quando l'operatore toglie la foto.
  const aggiornati = [...riferimenti]
  for (const voce of daCaricare) {
    aggiornati.push(
      await caricaAllegato(configurazione, riparazione.id, voce.dataUrl, voce.tipo, voce.ordine),
    )
  }

  aggiorna(riparazione.id, { allegati: aggiornati })
}

/**
 * Scarica le immagini di cui la scheda porta il riferimento ma non i byte.
 *
 * I riferimenti viaggiano dentro il record, le immagini no: una postazione che
 * riceve una scheda da un collega sa che esistono due foto e non le ha. Il
 * confronto è sul contenuto presente in locale, non sull'elenco dei
 * riferimenti, che altrimenti si dichiarerebbe soddisfatto da solo.
 */
async function scendono(
  configurazione: ConfigurazioneServer,
  riparazione: Riparazione,
  eliminati: Set<string>,
  aggiorna: RichiestaAllineamentoAllegati['aggiorna'],
): Promise<void> {
  const riferimenti = riparazione.allegati ?? []
  if (riferimenti.length === 0) return

  const foto = [...(riparazione.foto ?? [])]
  let firma = riparazione.firmaCliente

  const impronteLocali = new Set([
    ...foto.map((dataUrl) => `foto ${impronta(dataUrl)}`),
    ...(firma ? [`firma ${impronta(firma)}`] : []),
  ])

  const mancanti = riferimenti.filter(
    (voce) => !eliminati.has(voce.id) && !impronteLocali.has(`${voce.tipo} ${voce.impronta}`),
  )
  if (mancanti.length === 0) return

  const aggiornati = [...riferimenti]
  for (const voce of [...mancanti].sort((a, b) => a.ordine - b.ordine)) {
    const dataUrl = await scaricaAllegato(configurazione, voce.id)
    if (voce.tipo === 'firma') firma = dataUrl
    else foto.push(dataUrl)
    // L'impronta si riallinea a quella dell'immagine appena ricevuta: senza,
    // una minima differenza di codifica la farebbe riscaricare a ogni giro.
    const indice = aggiornati.findIndex((r) => r.id === voce.id)
    if (indice >= 0) aggiornati[indice] = { ...voce, impronta: impronta(dataUrl) }
  }

  aggiorna(riparazione.id, {
    foto: foto.length > 0 ? foto : undefined,
    firmaCliente: firma,
    allegati: aggiornati,
  })
}

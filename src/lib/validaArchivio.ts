/**
 * Validazione e riparazione dell'archivio.
 *
 * Serve in due punti critici: all'importazione di un backup e al caricamento
 * da `localStorage`. Senza questo controllo un file malformato (o un archivio
 * corrotto da un salvataggio interrotto) viene accettato così com'è, salvato e
 * ricaricato a ogni avvio, rendendo l'applicazione inutilizzabile.
 *
 * Criterio adottato: si ripara il possibile, si scartano i soli record
 * irrecuperabili e si riporta sempre all'utente che cosa è stato corretto.
 */

import type {
  AccessoriConsegnati,
  ArticoloMagazzino,
  Azienda,
  Cliente,
  CondizioneEsterna,
  DatabaseGestionale,
  Fattura,
  CausaleMovimento,
  EventoRiparazione,
  Impianto,
  MetodoPagamento,
  MovimentoMagazzino,
  OrdineFornitore,
  Preventivo,
  PrioritaScadenza,
  RigaIntervento,
  RigaOrdine,
  RiferimentoAllegato,
  Riparazione,
  Scadenza,
  StatoFattura,
  StatoImpianto,
  StatoOrdine,
  StatoPreventivo,
  StatoRiparazione,
  TipoCliente,
  TipoDispositivo,
  TipoScadenza,
} from '@/types'

/** Versione dello schema salvato: cambiarla quando i modelli non sono più compatibili. */
export const VERSIONE_ARCHIVIO = 1
export const FIRMA_ARCHIVIO = 'ioriparo'

export interface ArchivioEsportato {
  applicazione: typeof FIRMA_ARCHIVIO
  versione: number
  esportatoIl: string
  dati: DatabaseGestionale
}

export interface EsitoValidazione {
  db: DatabaseGestionale
  /** Correzioni applicate: vanno mostrate all'utente dopo un'importazione. */
  avvisi: string[]
}

export class ArchivioNonValido extends Error {}

const STATI_RIPARAZIONE_VALIDI: StatoRiparazione[] = [
  'in_attesa',
  'preventivo_inviato',
  'in_lavorazione',
  'pronto_per_ritiro',
  'consegnato',
  'non_riparabile',
]
const TIPI_DISPOSITIVO_VALIDI: TipoDispositivo[] = [
  'smartphone',
  'tablet',
  'notebook',
  'desktop',
  'console',
  'smartwatch',
  'altro',
]
const CONDIZIONI_VALIDE: CondizioneEsterna[] = ['ottime', 'buone', 'sufficienti', 'danneggiato']
const TIPI_CLIENTE_VALIDI: TipoCliente[] = ['privato', 'azienda']
const STATI_PREVENTIVO_VALIDI: StatoPreventivo[] = [
  'bozza',
  'inviato',
  'accettato',
  'rifiutato',
  'scaduto',
]
const STATI_FATTURA_VALIDI: StatoFattura[] = ['emessa', 'pagata', 'scaduta', 'annullata']
const METODI_VALIDI: MetodoPagamento[] = ['contanti', 'carta', 'bonifico', 'satispay', 'altro']
const STATI_ORDINE_VALIDI: StatoOrdine[] = [
  'bozza',
  'inviato',
  'in_transito',
  'ricevuto',
  'annullato',
]
const TIPI_SCADENZA_VALIDI: TipoScadenza[] = [
  'pagamento_fornitore',
  'contratto',
  'rinnovo',
  'promemoria',
  'tassa',
]
const PRIORITA_VALIDE: PrioritaScadenza[] = ['urgente', 'normale', 'bassa']
const CAUSALI_VALIDE: CausaleMovimento[] = [
  'carico_ordine',
  'storno_ordine',
  'consumo_riparazione',
  'reso_riparazione',
  'rettifica_manuale',
  'inventario',
]
const STATI_IMPIANTO_VALIDI: StatoImpianto[] = [
  'attivo',
  'in_manutenzione',
  'da_verificare',
  'dismesso',
]

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/

function eOggetto(valore: unknown): valore is Record<string, unknown> {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore)
}

/** Testo non vuoto, ripulito dagli spazi; `undefined` se assente o vuoto. */
function testo(valore: unknown): string | undefined {
  if (typeof valore === 'string') {
    const pulito = valore.trim()
    return pulito === '' ? undefined : pulito
  }
  if (typeof valore === 'number' && Number.isFinite(valore)) return String(valore)
  return undefined
}

function numeroFinito(valore: unknown): number | undefined {
  if (typeof valore === 'number' && Number.isFinite(valore)) return valore
  if (typeof valore === 'string') {
    const convertito = Number(valore.replace(',', '.'))
    if (Number.isFinite(convertito)) return convertito
  }
  return undefined
}

function booleano(valore: unknown): boolean {
  return valore === true
}

function dataIso(valore: unknown): string | undefined {
  const grezzo = testo(valore)
  if (!grezzo) return undefined
  const soloData = grezzo.slice(0, 10)
  if (!FORMATO_DATA.test(soloData)) return undefined
  const data = new Date(`${soloData}T00:00:00`)
  return Number.isNaN(data.getTime()) ? undefined : soloData
}

function daElenco<T extends string>(valore: unknown, ammessi: T[]): T | undefined {
  const grezzo = testo(valore)
  return grezzo && (ammessi as string[]).includes(grezzo) ? (grezzo as T) : undefined
}

function elenco(valore: unknown): unknown[] {
  return Array.isArray(valore) ? valore : []
}

/** Contatore di identificativi generati, per non dipendere da `Math.random`. */
let progressivoId = 0
function idGenerato(prefisso: string): string {
  progressivoId += 1
  return `${prefisso}-rec${progressivoId.toString(36)}`
}

function accessori(valore: unknown): AccessoriConsegnati {
  const grezzo = eOggetto(valore) ? valore : {}
  return {
    scatola: booleano(grezzo.scatola),
    cover: booleano(grezzo.cover),
    caricabatterie: booleano(grezzo.caricabatterie),
    cavoUsb: booleano(grezzo.cavoUsb),
    altro: testo(grezzo.altro),
    note: testo(grezzo.note),
  }
}

function righeIntervento(valore: unknown, prefisso: string): RigaIntervento[] {
  return elenco(valore).flatMap<RigaIntervento>((grezza) => {
    if (!eOggetto(grezza)) return []
    const descrizione = testo(grezza.descrizione)
    if (!descrizione) return []
    return [
      {
        id: testo(grezza.id) ?? idGenerato(prefisso),
        descrizione,
        quantita: numeroFinito(grezza.quantita) ?? 1,
        prezzoUnitario: numeroFinito(grezza.prezzoUnitario) ?? 0,
        articoloId: testo(grezza.articoloId),
      },
    ]
  })
}

function storicoRiparazione(valore: unknown): EventoRiparazione[] | undefined {
  const eventi = elenco(valore).flatMap<EventoRiparazione>((grezzo) => {
    if (!eOggetto(grezzo)) return []
    const a = daElenco(grezzo.a, STATI_RIPARAZIONE_VALIDI)
    const istante = testo(grezzo.istante)
    if (!a || !istante) return []
    return [
      {
        id: testo(grezzo.id) ?? idGenerato('evt'),
        istante,
        da: daElenco(grezzo.da, STATI_RIPARAZIONE_VALIDI),
        a,
        nota: testo(grezzo.nota),
      },
    ]
  })
  return eventi.length > 0 ? eventi : undefined
}

function riferimentiAllegati(valore: unknown): RiferimentoAllegato[] | undefined {
  const riferimenti = elenco(valore).flatMap<RiferimentoAllegato>((grezzo) => {
    if (!eOggetto(grezzo)) return []
    const id = testo(grezzo.id)
    const tipo = grezzo.tipo === 'firma' ? 'firma' : 'foto'
    if (!id) return []
    return [
      {
        id,
        tipo,
        ordine: numeroFinito(grezzo.ordine) ?? 0,
        // Senza impronta il riferimento è inservibile: si scarta, così
        // l'immagine viene ricaricata e il collegamento ricostruito.
        impronta: testo(grezzo.impronta) ?? '',
      },
    ]
  })
  return riferimenti.length > 0 ? riferimenti : undefined
}

function righeOrdine(valore: unknown): RigaOrdine[] {
  return elenco(valore).flatMap<RigaOrdine>((grezza) => {
    if (!eOggetto(grezza)) return []
    const descrizione = testo(grezza.descrizione)
    if (!descrizione) return []
    return [
      {
        id: testo(grezza.id) ?? idGenerato('rord'),
        articoloId: testo(grezza.articoloId),
        descrizione,
        quantita: numeroFinito(grezza.quantita) ?? 1,
        prezzoUnitario: numeroFinito(grezza.prezzoUnitario) ?? 0,
        quantitaRicevuta: numeroFinito(grezza.quantitaRicevuta),
      },
    ]
  })
}

/**
 * Applica `converti` a ogni elemento, scartando i record irrecuperabili e
 * quelli con identificativo duplicato, e annota il motivo negli avvisi.
 */
function collezione<T extends { id: string }>(
  valore: unknown,
  etichetta: string,
  avvisi: string[],
  converti: (grezzo: Record<string, unknown>) => T | null,
): T[] {
  if (valore !== undefined && !Array.isArray(valore)) {
    avvisi.push(`«${etichetta}»: sezione assente o non valida, ripristinata vuota.`)
    return []
  }

  const visti = new Set<string>()
  let scartati = 0
  let duplicati = 0

  const risultato = elenco(valore).flatMap<T>((grezzo) => {
    if (!eOggetto(grezzo)) {
      scartati += 1
      return []
    }
    const convertito = converti(grezzo)
    if (!convertito) {
      scartati += 1
      return []
    }
    if (visti.has(convertito.id)) {
      duplicati += 1
      return []
    }
    visti.add(convertito.id)
    return [convertito]
  })

  if (scartati > 0) {
    avvisi.push(`«${etichetta}»: ${scartati} record incompleti scartati.`)
  }
  if (duplicati > 0) {
    avvisi.push(`«${etichetta}»: ${duplicati} record con codice duplicato scartati.`)
  }
  return risultato
}

function azienda(valore: unknown, predefinita: Azienda, avvisi: string[]): Azienda {
  if (!eOggetto(valore)) {
    avvisi.push('«Dati aziendali»: sezione assente, ripristinati i valori predefiniti.')
    return { ...predefinita }
  }
  return {
    nome: testo(valore.nome) ?? predefinita.nome,
    claim: testo(valore.claim) ?? predefinita.claim,
    indirizzo: testo(valore.indirizzo) ?? predefinita.indirizzo,
    citta: testo(valore.citta) ?? predefinita.citta,
    telefono: testo(valore.telefono) ?? predefinita.telefono,
    email: testo(valore.email) ?? predefinita.email,
    partitaIva: testo(valore.partitaIva) ?? predefinita.partitaIva,
    ivaPredefinita: numeroFinito(valore.ivaPredefinita) ?? predefinita.ivaPredefinita,
    giorniValiditaPreventivo:
      numeroFinito(valore.giorniValiditaPreventivo) ?? predefinita.giorniValiditaPreventivo,
    prefissoCodice: testo(valore.prefissoCodice) ?? predefinita.prefissoCodice,
    formatoFattura: testo(valore.formatoFattura) ?? predefinita.formatoFattura,
    formatoPreventivo: testo(valore.formatoPreventivo) ?? predefinita.formatoPreventivo,
  }
}

/** Segnala i riferimenti pendenti senza rimuovere dati dell'utente. */
function controllaRiferimenti(db: DatabaseGestionale, avvisi: string[]) {
  const clienti = new Set(db.clienti.map((c) => c.id))
  const orfani = [
    ['riparazioni', db.riparazioni.filter((r) => !clienti.has(r.clienteId)).length],
    ['preventivi', db.preventivi.filter((p) => !clienti.has(p.clienteId)).length],
    ['fatture', db.fatture.filter((f) => !clienti.has(f.clienteId)).length],
    ['impianti', db.impianti.filter((i) => !clienti.has(i.clienteId)).length],
  ] as const

  for (const [etichetta, quantita] of orfani) {
    if (quantita > 0) {
      avvisi.push(`${quantita} ${etichetta} fanno riferimento a un cliente non presente.`)
    }
  }
}

/**
 * Normalizza un archivio di provenienza ignota.
 * Accetta sia il formato con intestazione (`{applicazione, versione, dati}`)
 * sia il database grezzo dei backup precedenti.
 */
export function validaArchivio(
  grezzo: unknown,
  riferimento: DatabaseGestionale,
): EsitoValidazione {
  if (!eOggetto(grezzo)) {
    throw new ArchivioNonValido('Il file non contiene un archivio IO RIPARO.')
  }

  const avvisi: string[] = []
  let contenuto = grezzo

  if ('dati' in grezzo || 'applicazione' in grezzo) {
    if (grezzo.applicazione !== FIRMA_ARCHIVIO) {
      throw new ArchivioNonValido('Il file appartiene a un’altra applicazione.')
    }
    const versione = numeroFinito(grezzo.versione) ?? 0
    if (versione > VERSIONE_ARCHIVIO) {
      throw new ArchivioNonValido(
        `Il backup è stato creato con una versione più recente dell’applicazione (${versione}).`,
      )
    }
    if (!eOggetto(grezzo.dati)) {
      throw new ArchivioNonValido('Il backup non contiene dati.')
    }
    contenuto = grezzo.dati
  }

  const sezioniNote = [
    'clienti',
    'riparazioni',
    'preventivi',
    'fatture',
    'magazzino',
    'ordini',
    'scadenze',
    'impianti',
    'movimenti',
    'azienda',
  ]
  if (!sezioniNote.some((sezione) => sezione in contenuto)) {
    throw new ArchivioNonValido('Il file non contiene un archivio IO RIPARO.')
  }

  const clienti = collezione<Cliente>(contenuto.clienti, 'Clienti', avvisi, (g) => {
    const nome = testo(g.nome)
    if (!nome) return null
    return {
      id: testo(g.id) ?? idGenerato('cli'),
      nome,
      tipo: daElenco(g.tipo, TIPI_CLIENTE_VALIDI) ?? 'privato',
      telefono: testo(g.telefono) ?? '',
      email: testo(g.email),
      indirizzo: testo(g.indirizzo),
      citta: testo(g.citta),
      cap: testo(g.cap),
      partitaIva: testo(g.partitaIva),
      codiceFiscale: testo(g.codiceFiscale),
      note: testo(g.note),
      creatoIl: dataIso(g.creatoIl) ?? '',
    }
  })

  const riparazioni = collezione<Riparazione>(
    contenuto.riparazioni,
    'Riparazioni',
    avvisi,
    (g) => {
      const clienteId = testo(g.clienteId)
      if (!clienteId) return null
      const foto = elenco(g.foto).filter(
        (voce): voce is string => typeof voce === 'string' && voce.startsWith('data:'),
      )
      return {
        id: testo(g.id) ?? idGenerato('rip'),
        codice: testo(g.codice) ?? '#----',
        clienteId,
        tipoDispositivo: daElenco(g.tipoDispositivo, TIPI_DISPOSITIVO_VALIDI) ?? 'altro',
        marca: testo(g.marca) ?? '',
        modello: testo(g.modello) ?? '',
        colore: testo(g.colore),
        capacita: testo(g.capacita),
        imei: testo(g.imei),
        passwordBlocco: testo(g.passwordBlocco),
        difettoSegnalato: testo(g.difettoSegnalato) ?? '',
        condizioniEsterne: daElenco(g.condizioniEsterne, CONDIZIONI_VALIDE),
        noteCondizioni: testo(g.noteCondizioni),
        accessori: accessori(g.accessori),
        stato: daElenco(g.stato, STATI_RIPARAZIONE_VALIDI) ?? 'in_attesa',
        dataAccettazione: dataIso(g.dataAccettazione) ?? '',
        consegnaPrevista: dataIso(g.consegnaPrevista),
        dataConsegna: dataIso(g.dataConsegna),
        tecnico: testo(g.tecnico),
        interventi: righeIntervento(g.interventi, 'int'),
        acconto: numeroFinito(g.acconto),
        foto: foto.length > 0 ? foto : undefined,
        firmaCliente:
          typeof g.firmaCliente === 'string' && g.firmaCliente.startsWith('data:')
            ? g.firmaCliente
            : undefined,
        noteInterne: testo(g.noteInterne),
        storico: storicoRiparazione(g.storico),
        allegati: riferimentiAllegati(g.allegati),
      }
    },
  )

  const ivaPredefinita = numeroFinito(
    eOggetto(contenuto.azienda) ? contenuto.azienda.ivaPredefinita : undefined,
  )

  const preventivi = collezione<Preventivo>(contenuto.preventivi, 'Preventivi', avvisi, (g) => {
    const clienteId = testo(g.clienteId)
    if (!clienteId) return null
    return {
      id: testo(g.id) ?? idGenerato('prv'),
      numero: testo(g.numero) ?? '—',
      clienteId,
      riparazioneId: testo(g.riparazioneId),
      data: dataIso(g.data) ?? '',
      validoFino: dataIso(g.validoFino),
      stato: daElenco(g.stato, STATI_PREVENTIVO_VALIDI) ?? 'bozza',
      righe: righeIntervento(g.righe, 'prg'),
      iva: numeroFinito(g.iva) ?? ivaPredefinita ?? riferimento.azienda.ivaPredefinita,
      note: testo(g.note),
    }
  })

  const fatture = collezione<Fattura>(contenuto.fatture, 'Fatture', avvisi, (g) => {
    const clienteId = testo(g.clienteId)
    if (!clienteId) return null
    return {
      id: testo(g.id) ?? idGenerato('fat'),
      numero: testo(g.numero) ?? '—',
      clienteId,
      riparazioneId: testo(g.riparazioneId),
      data: dataIso(g.data) ?? '',
      scadenza: dataIso(g.scadenza),
      stato: daElenco(g.stato, STATI_FATTURA_VALIDI) ?? 'emessa',
      righe: righeIntervento(g.righe, 'frg'),
      iva: numeroFinito(g.iva) ?? ivaPredefinita ?? riferimento.azienda.ivaPredefinita,
      metodoPagamento: daElenco(g.metodoPagamento, METODI_VALIDI),
      dataPagamento: dataIso(g.dataPagamento),
    }
  })

  const magazzino = collezione<ArticoloMagazzino>(contenuto.magazzino, 'Magazzino', avvisi, (g) => {
    const nome = testo(g.nome)
    if (!nome) return null
    return {
      id: testo(g.id) ?? idGenerato('art'),
      codice: testo(g.codice) ?? nome.slice(0, 8).toUpperCase(),
      nome,
      categoria: testo(g.categoria) ?? 'Senza categoria',
      fornitore: testo(g.fornitore),
      quantita: numeroFinito(g.quantita) ?? 0,
      scorta_minima: numeroFinito(g.scorta_minima) ?? 0,
      prezzoAcquisto: numeroFinito(g.prezzoAcquisto) ?? 0,
      prezzoVendita: numeroFinito(g.prezzoVendita) ?? 0,
      ubicazione: testo(g.ubicazione),
    }
  })

  const ordini = collezione<OrdineFornitore>(contenuto.ordini, 'Ordini', avvisi, (g) => {
    const fornitore = testo(g.fornitore)
    if (!fornitore) return null
    const stato = daElenco(g.stato, STATI_ORDINE_VALIDI) ?? 'bozza'
    const righe = righeOrdine(g.righe)
    return {
      id: testo(g.id) ?? idGenerato('ord'),
      numero: testo(g.numero) ?? '—',
      fornitore,
      data: dataIso(g.data) ?? '',
      consegnaPrevista: dataIso(g.consegnaPrevista),
      stato,
      // Un ordine già chiuso ha ricevuto tutto: senza questo riallineamento
      // gli archivi creati prima delle consegne parziali risulterebbero da ricevere.
      righe:
        stato === 'ricevuto'
          ? righe.map((riga) => ({ ...riga, quantitaRicevuta: riga.quantitaRicevuta ?? riga.quantita }))
          : righe,
      ricevutoIl: dataIso(g.ricevutoIl) ?? (stato === 'ricevuto' ? dataIso(g.data) : undefined),
    }
  })

  const scadenze = collezione<Scadenza>(contenuto.scadenze, 'Scadenze', avvisi, (g) => {
    const titolo = testo(g.titolo)
    if (!titolo) return null
    return {
      id: testo(g.id) ?? idGenerato('sca'),
      titolo,
      descrizione: testo(g.descrizione),
      tipo: daElenco(g.tipo, TIPI_SCADENZA_VALIDI) ?? 'promemoria',
      priorita: daElenco(g.priorita, PRIORITA_VALIDE) ?? 'normale',
      data: dataIso(g.data) ?? '',
      importo: numeroFinito(g.importo),
      completata: booleano(g.completata),
      impiantoId: testo(g.impiantoId),
    }
  })

  const impianti = collezione<Impianto>(contenuto.impianti, 'Impianti', avvisi, (g) => {
    const nome = testo(g.nome)
    const clienteId = testo(g.clienteId)
    if (!nome || !clienteId) return null
    return {
      id: testo(g.id) ?? idGenerato('imp'),
      nome,
      clienteId,
      tipologia: testo(g.tipologia) ?? 'Non specificata',
      indirizzo: testo(g.indirizzo),
      dataInstallazione: dataIso(g.dataInstallazione) ?? '',
      prossimaManutenzione: dataIso(g.prossimaManutenzione),
      stato: daElenco(g.stato, STATI_IMPIANTO_VALIDI) ?? 'attivo',
      note: testo(g.note),
    }
  })

  const movimenti = collezione<MovimentoMagazzino>(
    contenuto.movimenti,
    'Movimenti di magazzino',
    avvisi,
    (g) => {
      const articoloId = testo(g.articoloId)
      const istante = testo(g.istante)
      const delta = numeroFinito(g.delta)
      if (!articoloId || !istante || delta === undefined) return null
      return {
        id: testo(g.id) ?? idGenerato('mov'),
        articoloId,
        istante,
        delta,
        giacenzaFinale: numeroFinito(g.giacenzaFinale) ?? 0,
        causale: daElenco(g.causale, CAUSALI_VALIDE) ?? 'rettifica_manuale',
        riferimentoId: testo(g.riferimentoId),
        riferimento: testo(g.riferimento),
      }
    },
  )

  const db: DatabaseGestionale = {
    clienti,
    riparazioni,
    preventivi,
    fatture,
    magazzino,
    ordini,
    scadenze,
    impianti,
    movimenti,
    azienda: azienda(contenuto.azienda, riferimento.azienda, avvisi),
  }

  controllaRiferimenti(db, avvisi)
  return { db, avvisi }
}

/** Confeziona l'archivio per l'esportazione, con firma e versione dello schema. */
export function preparaEsportazione(db: DatabaseGestionale, esportatoIl: string): ArchivioEsportato {
  return {
    applicazione: FIRMA_ARCHIVIO,
    versione: VERSIONE_ARCHIVIO,
    esportatoIl,
    dati: db,
  }
}

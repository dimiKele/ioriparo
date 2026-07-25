/**
 * Modelli di dominio del gestionale IO RIPARO.
 * Tutte le date sono in formato ISO `YYYY-MM-DD`, gli importi in euro.
 */

export type StatoRiparazione =
  | 'in_attesa'
  | 'preventivo_inviato'
  | 'in_lavorazione'
  | 'pronto_per_ritiro'
  | 'consegnato'
  | 'non_riparabile'

export type TipoDispositivo =
  | 'smartphone'
  | 'tablet'
  | 'notebook'
  | 'desktop'
  | 'console'
  | 'smartwatch'
  | 'altro'

export type CondizioneEsterna = 'ottime' | 'buone' | 'sufficienti' | 'danneggiato'

export type TipoCliente = 'privato' | 'azienda'

export interface Cliente {
  id: string
  nome: string
  tipo: TipoCliente
  telefono: string
  email?: string
  indirizzo?: string
  citta?: string
  cap?: string
  partitaIva?: string
  codiceFiscale?: string
  note?: string
  creatoIl: string
}

export interface AccessoriConsegnati {
  scatola: boolean
  cover: boolean
  caricabatterie: boolean
  cavoUsb: boolean
  altro?: string
  note?: string
}

export interface RigaIntervento {
  id: string
  descrizione: string
  quantita: number
  prezzoUnitario: number
  /** Articolo di magazzino eventualmente scalato */
  articoloId?: string
}

export interface Riparazione {
  id: string
  /** Codice progressivo mostrato in interfaccia, es. `#24-0001` */
  codice: string
  clienteId: string
  tipoDispositivo: TipoDispositivo
  marca: string
  modello: string
  colore?: string
  capacita?: string
  imei?: string
  passwordBlocco?: string
  difettoSegnalato: string
  condizioniEsterne?: CondizioneEsterna
  noteCondizioni?: string
  accessori: AccessoriConsegnati
  stato: StatoRiparazione
  dataAccettazione: string
  consegnaPrevista?: string
  dataConsegna?: string
  tecnico?: string
  interventi: RigaIntervento[]
  /** Acconto già incassato all'accettazione */
  acconto?: number
  /** Foto del dispositivo scattate in accettazione, come data URL */
  foto?: string[]
  /** Firma del cliente in accettazione, come data URL PNG */
  firmaCliente?: string
  noteInterne?: string
}

export type StatoPreventivo = 'bozza' | 'inviato' | 'accettato' | 'rifiutato' | 'scaduto'

export interface Preventivo {
  id: string
  numero: string
  clienteId: string
  riparazioneId?: string
  data: string
  validoFino?: string
  stato: StatoPreventivo
  righe: RigaIntervento[]
  /** Aliquota IVA in percentuale */
  iva: number
  note?: string
}

export type StatoFattura = 'emessa' | 'pagata' | 'scaduta' | 'annullata'
export type MetodoPagamento = 'contanti' | 'carta' | 'bonifico' | 'satispay' | 'altro'

export interface Fattura {
  id: string
  numero: string
  clienteId: string
  riparazioneId?: string
  data: string
  scadenza?: string
  stato: StatoFattura
  righe: RigaIntervento[]
  iva: number
  metodoPagamento?: MetodoPagamento
  dataPagamento?: string
}

export interface ArticoloMagazzino {
  id: string
  codice: string
  nome: string
  categoria: string
  fornitore?: string
  quantita: number
  scorta_minima: number
  prezzoAcquisto: number
  prezzoVendita: number
  ubicazione?: string
}

export type StatoOrdine = 'bozza' | 'inviato' | 'in_transito' | 'ricevuto' | 'annullato'

export interface RigaOrdine {
  id: string
  articoloId?: string
  descrizione: string
  quantita: number
  prezzoUnitario: number
  /**
   * Pezzi già entrati in giacenza per questa riga. Consente le consegne
   * parziali e impedisce di caricare due volte la stessa merce.
   */
  quantitaRicevuta?: number
}

export interface OrdineFornitore {
  id: string
  numero: string
  fornitore: string
  data: string
  consegnaPrevista?: string
  stato: StatoOrdine
  righe: RigaOrdine[]
  /**
   * Data in cui la merce è stata caricata in magazzino. Presidia il carico
   * una sola volta: finché è valorizzata l'ordine non viene ricaricato.
   */
  ricevutoIl?: string
}

export type TipoScadenza =
  | 'pagamento_fornitore'
  | 'contratto'
  | 'rinnovo'
  | 'promemoria'
  | 'tassa'

export type PrioritaScadenza = 'urgente' | 'normale' | 'bassa'

export interface Scadenza {
  id: string
  titolo: string
  descrizione?: string
  tipo: TipoScadenza
  priorita: PrioritaScadenza
  data: string
  importo?: number
  completata: boolean
  /** Impianto di cui questa scadenza è la manutenzione programmata. */
  impiantoId?: string
}

export type StatoImpianto = 'attivo' | 'in_manutenzione' | 'da_verificare' | 'dismesso'

export interface Impianto {
  id: string
  nome: string
  clienteId: string
  tipologia: string
  indirizzo?: string
  dataInstallazione: string
  prossimaManutenzione?: string
  stato: StatoImpianto
  note?: string
}

export interface Azienda {
  nome: string
  claim: string
  indirizzo: string
  citta: string
  telefono: string
  email: string
  partitaIva: string
  ivaPredefinita: number
  giorniValiditaPreventivo: number
  prefissoCodice: string
  /** Modello del numero fattura: `{n}` progressivo, `{anno}` anno corrente. */
  formatoFattura: string
  /** Modello del numero preventivo, stessi segnaposto. */
  formatoPreventivo: string
}

export interface DatabaseGestionale {
  clienti: Cliente[]
  riparazioni: Riparazione[]
  preventivi: Preventivo[]
  fatture: Fattura[]
  magazzino: ArticoloMagazzino[]
  ordini: OrdineFornitore[]
  scadenze: Scadenza[]
  impianti: Impianto[]
  azienda: Azienda
}

import { oggiISO } from './format'
import type {
  Fattura,
  Preventivo,
  StatoFattura,
  StatoImpianto,
  StatoOrdine,
  StatoPreventivo,
  StatoRiparazione,
  TipoDispositivo,
  TipoScadenza,
} from '@/types'

export interface ConfigStato {
  label: string
  /** Etichetta compatta per i badge in tabella */
  labelBreve?: string
  /** Classi Tailwind del badge (testo + fondo + bordo) */
  badge: string
  /** Colore pieno per grafici e pastiglie */
  colore: string
  /** Classi per l'icona tonda dei riepiloghi */
  icona: string
}

export const STATI_RIPARAZIONE: Record<StatoRiparazione, ConfigStato> = {
  in_attesa: {
    label: 'In attesa',
    badge: 'text-amber-300 bg-amber-500/12 border-amber-500/30',
    colore: '#f59e0b',
    icona: 'text-amber-400 bg-amber-500/15',
  },
  preventivo_inviato: {
    label: 'Preventivo inviato',
    badge: 'text-yellow-200 bg-yellow-500/12 border-yellow-500/30',
    colore: '#eab308',
    icona: 'text-yellow-300 bg-yellow-500/15',
  },
  in_lavorazione: {
    label: 'In lavorazione',
    badge: 'text-blue-300 bg-blue-500/12 border-blue-500/30',
    colore: '#3b82f6',
    icona: 'text-blue-400 bg-blue-500/15',
  },
  pronto_per_ritiro: {
    label: 'Pronto per il ritiro',
    labelBreve: 'Pronto',
    badge: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30',
    colore: '#22c55e',
    icona: 'text-emerald-400 bg-emerald-500/15',
  },
  consegnato: {
    label: 'Consegnato',
    badge: 'text-violet-300 bg-violet-500/12 border-violet-500/30',
    colore: '#a855f7',
    icona: 'text-violet-400 bg-violet-500/15',
  },
  non_riparabile: {
    label: 'Non riparabile',
    badge: 'text-rose-300 bg-rose-500/12 border-rose-500/30',
    colore: '#f43f5e',
    icona: 'text-rose-400 bg-rose-500/15',
  },
}

/** Ordine di visualizzazione dei filtri e delle legende. */
export const ORDINE_STATI: StatoRiparazione[] = [
  'in_attesa',
  'preventivo_inviato',
  'in_lavorazione',
  'pronto_per_ritiro',
  'consegnato',
  'non_riparabile',
]

/** Stati che contano come lavorazione ancora aperta. */
export const STATI_APERTI: StatoRiparazione[] = [
  'in_attesa',
  'preventivo_inviato',
  'in_lavorazione',
  'pronto_per_ritiro',
]

export const STATI_PREVENTIVO: Record<StatoPreventivo, ConfigStato> = {
  bozza: {
    label: 'Bozza',
    badge: 'text-slate-300 bg-slate-500/12 border-slate-500/30',
    colore: '#94a3b8',
    icona: 'text-slate-300 bg-slate-500/15',
  },
  inviato: {
    label: 'Inviato',
    badge: 'text-blue-300 bg-blue-500/12 border-blue-500/30',
    colore: '#3b82f6',
    icona: 'text-blue-400 bg-blue-500/15',
  },
  accettato: {
    label: 'Accettato',
    badge: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30',
    colore: '#22c55e',
    icona: 'text-emerald-400 bg-emerald-500/15',
  },
  rifiutato: {
    label: 'Rifiutato',
    badge: 'text-rose-300 bg-rose-500/12 border-rose-500/30',
    colore: '#f43f5e',
    icona: 'text-rose-400 bg-rose-500/15',
  },
  scaduto: {
    label: 'Scaduto',
    badge: 'text-amber-300 bg-amber-500/12 border-amber-500/30',
    colore: '#f59e0b',
    icona: 'text-amber-400 bg-amber-500/15',
  },
}

export const STATI_FATTURA: Record<StatoFattura, ConfigStato> = {
  emessa: {
    label: 'Emessa',
    badge: 'text-blue-300 bg-blue-500/12 border-blue-500/30',
    colore: '#3b82f6',
    icona: 'text-blue-400 bg-blue-500/15',
  },
  pagata: {
    label: 'Pagata',
    badge: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30',
    colore: '#22c55e',
    icona: 'text-emerald-400 bg-emerald-500/15',
  },
  scaduta: {
    label: 'Scaduta',
    badge: 'text-rose-300 bg-rose-500/12 border-rose-500/30',
    colore: '#f43f5e',
    icona: 'text-rose-400 bg-rose-500/15',
  },
  annullata: {
    label: 'Annullata',
    badge: 'text-slate-300 bg-slate-500/12 border-slate-500/30',
    colore: '#94a3b8',
    icona: 'text-slate-300 bg-slate-500/15',
  },
}

/**
 * Stato effettivo di una fattura.
 *
 * «Scaduta» è una condizione temporale, non un dato da aggiornare a mano:
 * senza questa derivazione una fattura non pagata resta «emessa» per sempre e
 * non compare in nessun sollecito.
 */
export function statoFatturaEffettivo(fattura: Fattura, oggi = oggiISO()): StatoFattura {
  if (fattura.stato === 'pagata' || fattura.stato === 'annullata') return fattura.stato
  if (fattura.scadenza && fattura.scadenza < oggi) return 'scaduta'
  return 'emessa'
}

/** Stato effettivo di un preventivo: oltre la validità è scaduto. */
export function statoPreventivoEffettivo(
  preventivo: Preventivo,
  oggi = oggiISO(),
): StatoPreventivo {
  if (preventivo.stato === 'accettato' || preventivo.stato === 'rifiutato') return preventivo.stato
  if (preventivo.stato === 'bozza') return 'bozza'
  if (preventivo.validoFino && preventivo.validoFino < oggi) return 'scaduto'
  return 'inviato'
}

export const STATI_ORDINE: Record<StatoOrdine, ConfigStato> = {
  bozza: {
    label: 'Bozza',
    badge: 'text-slate-300 bg-slate-500/12 border-slate-500/30',
    colore: '#94a3b8',
    icona: 'text-slate-300 bg-slate-500/15',
  },
  inviato: {
    label: 'Inviato',
    badge: 'text-blue-300 bg-blue-500/12 border-blue-500/30',
    colore: '#3b82f6',
    icona: 'text-blue-400 bg-blue-500/15',
  },
  in_transito: {
    label: 'In transito',
    badge: 'text-amber-300 bg-amber-500/12 border-amber-500/30',
    colore: '#f59e0b',
    icona: 'text-amber-400 bg-amber-500/15',
  },
  ricevuto: {
    label: 'Ricevuto',
    badge: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30',
    colore: '#22c55e',
    icona: 'text-emerald-400 bg-emerald-500/15',
  },
  annullato: {
    label: 'Annullato',
    badge: 'text-rose-300 bg-rose-500/12 border-rose-500/30',
    colore: '#f43f5e',
    icona: 'text-rose-400 bg-rose-500/15',
  },
}

export const STATI_IMPIANTO: Record<StatoImpianto, ConfigStato> = {
  attivo: {
    label: 'Attivo',
    badge: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30',
    colore: '#22c55e',
    icona: 'text-emerald-400 bg-emerald-500/15',
  },
  in_manutenzione: {
    label: 'In manutenzione',
    badge: 'text-blue-300 bg-blue-500/12 border-blue-500/30',
    colore: '#3b82f6',
    icona: 'text-blue-400 bg-blue-500/15',
  },
  da_verificare: {
    label: 'Da verificare',
    badge: 'text-amber-300 bg-amber-500/12 border-amber-500/30',
    colore: '#f59e0b',
    icona: 'text-amber-400 bg-amber-500/15',
  },
  dismesso: {
    label: 'Dismesso',
    badge: 'text-slate-300 bg-slate-500/12 border-slate-500/30',
    colore: '#94a3b8',
    icona: 'text-slate-300 bg-slate-500/15',
  },
}

export const TIPI_SCADENZA: Record<TipoScadenza, { label: string; colore: string }> = {
  pagamento_fornitore: { label: 'Pagamento fornitore', colore: '#f43f5e' },
  contratto: { label: 'Contratto', colore: '#f59e0b' },
  rinnovo: { label: 'Rinnovo', colore: '#3b82f6' },
  promemoria: { label: 'Promemoria', colore: '#a855f7' },
  tassa: { label: 'Tassa / F24', colore: '#22c55e' },
}

export const TIPI_DISPOSITIVO: Record<TipoDispositivo, string> = {
  smartphone: 'Smartphone',
  tablet: 'Tablet',
  notebook: 'Notebook',
  desktop: 'PC Desktop',
  console: 'Console',
  smartwatch: 'Smartwatch',
  altro: 'Altro',
}

/** Marche proposte nella selezione, raggruppate per tipo di dispositivo. */
export const MARCHE_PER_TIPO: Record<TipoDispositivo, string[]> = {
  smartphone: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'OnePlus', 'Oppo', 'Motorola', 'Altro'],
  tablet: ['Apple', 'Samsung', 'Lenovo', 'Huawei', 'Microsoft', 'Altro'],
  notebook: ['Apple', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Altro'],
  desktop: ['Assemblato', 'HP', 'Dell', 'Lenovo', 'Acer', 'Apple', 'Altro'],
  console: ['Sony', 'Microsoft', 'Nintendo', 'Altro'],
  smartwatch: ['Apple', 'Samsung', 'Garmin', 'Huawei', 'Altro'],
  altro: ['Altro'],
}

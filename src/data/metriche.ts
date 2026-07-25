import { totaleFattura, totaleRighe } from '@/lib/calcoli'
import { oggiISO } from '@/lib/format'
import {
  ORDINE_STATI,
  STATI_APERTI,
  STATI_RIPARAZIONE,
  statoFatturaEffettivo,
} from '@/lib/stati'
import type { ArticoloMagazzino, DatabaseGestionale, Fattura, StatoRiparazione } from '@/types'

/** Aggregazioni derivate mostrate su dashboard e statistiche. */

/**
 * Data locale in formato ISO.
 * `toISOString()` lavora in UTC: applicato a una mezzanotte locale sposta la
 * data indietro di un giorno per tutta l'Europa continentale, falsando ogni
 * finestra temporale.
 */
function isoLocale(data: Date): string {
  const anno = data.getFullYear()
  const mese = String(data.getMonth() + 1).padStart(2, '0')
  const giorno = String(data.getDate()).padStart(2, '0')
  return `${anno}-${mese}-${giorno}`
}

/**
 * Finestra degli ultimi `giorni` giorni, oggi incluso.
 * `giorni = 30` copre esattamente 30 giornate, non 32.
 */
function finestra(giorni: number): { inizio: string; fine: string } {
  const fine = oggiISO()
  const inizio = new Date(new Date(`${fine}T00:00:00`).getTime() - (giorni - 1) * 86_400_000)
  return { inizio: isoLocale(inizio), fine }
}

/** Indice per id: evita una scansione del magazzino per ogni riga di ogni documento. */
function indiceMagazzino(db: DatabaseGestionale): Map<string, ArticoloMagazzino> {
  return new Map(db.magazzino.map((articolo) => [articolo.id, articolo]))
}

/** Fatture effettivamente incassate nella finestra indicata. */
function fatturePagateNel(db: DatabaseGestionale, inizio: string, fine: string): Fattura[] {
  return db.fatture.filter(
    (f) =>
      f.stato === 'pagata' &&
      f.dataPagamento !== undefined &&
      f.dataPagamento >= inizio &&
      f.dataPagamento <= fine,
  )
}

export interface VoceStato {
  stato: StatoRiparazione
  label: string
  colore: string
  valore: number
}

export function contaPerStato(db: DatabaseGestionale): Record<StatoRiparazione, number> {
  const conteggi = Object.fromEntries(ORDINE_STATI.map((s) => [s, 0])) as Record<
    StatoRiparazione,
    number
  >
  for (const riparazione of db.riparazioni) {
    if (conteggi[riparazione.stato] !== undefined) conteggi[riparazione.stato] += 1
  }
  return conteggi
}

/**
 * Voci della ciambella «Lavorazioni aperte»: solo gli stati ancora in corso,
 * con il conteggio reale. Mostrare le consegne insieme alle lavorazioni
 * renderebbe il totale al centro incoerente con l'elenco filtrato.
 */
export function riparazioniPerStato(db: DatabaseGestionale): VoceStato[] {
  const conteggi = contaPerStato(db)
  return STATI_APERTI.map((stato) => ({
    stato,
    label: STATI_RIPARAZIONE[stato].label,
    colore: STATI_RIPARAZIONE[stato].colore,
    valore: conteggi[stato],
  }))
}

export function riparazioniAperte(db: DatabaseGestionale): number {
  return db.riparazioni.filter((r) => STATI_APERTI.includes(r.stato)).length
}

export function riparazioniConsegnateOggi(db: DatabaseGestionale): number {
  const oggi = oggiISO()
  return db.riparazioni.filter((r) => r.stato === 'consegnato' && r.dataConsegna === oggi).length
}

export function incassoDelGiorno(db: DatabaseGestionale, giorno = oggiISO()): number {
  return db.fatture
    .filter((f) => f.stato === 'pagata' && f.dataPagamento === giorno)
    .reduce((somma, f) => somma + totaleFattura(f), 0)
}

/** Incasso del mese solare a cui appartiene `riferimento`. */
export function incassoDelMese(db: DatabaseGestionale, riferimento = oggiISO()): number {
  const mese = riferimento.slice(0, 7)
  return db.fatture
    .filter((f) => f.stato === 'pagata' && f.dataPagamento?.startsWith(mese))
    .reduce((somma, f) => somma + totaleFattura(f), 0)
}

export interface PuntoIncasso {
  giorno: string
  etichetta: string
  incasso: number
}

/**
 * Serie per il grafico «Andamento incassi».
 * `mese` → tutti i giorni del mese corrente; un numero → ultimi N giorni, oggi incluso.
 */
export function andamentoIncassi(
  db: DatabaseGestionale,
  periodo: 'mese' | number = 'mese',
): PuntoIncasso[] {
  const oggi = new Date(`${oggiISO()}T00:00:00`)
  const giorni: string[] = []

  if (periodo === 'mese') {
    // Ci si ferma a oggi: i giorni futuri appiattirebbero la curva sullo zero.
    const ultimoGiorno = oggi.getDate()
    for (let g = 1; g <= ultimoGiorno; g++) {
      giorni.push(
        `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`,
      )
    }
  } else {
    for (let g = periodo - 1; g >= 0; g--) {
      giorni.push(isoLocale(new Date(oggi.getTime() - g * 86_400_000)))
    }
  }

  const perGiorno = new Map<string, number>()
  for (const fattura of db.fatture) {
    if (fattura.stato !== 'pagata' || !fattura.dataPagamento) continue
    perGiorno.set(
      fattura.dataPagamento,
      (perGiorno.get(fattura.dataPagamento) ?? 0) + totaleFattura(fattura),
    )
  }

  return giorni.map((giorno) => ({
    giorno,
    // Con più di un mese di serie il solo numero del giorno si ripete: serve il mese.
    etichetta: periodo === 'mese' ? giorno.slice(8) : `${giorno.slice(8)}/${giorno.slice(5, 7)}`,
    incasso: Math.round(perGiorno.get(giorno) ?? 0),
  }))
}

export interface ProdottoVenduto {
  articoloId?: string
  nome: string
  pezzi: number
  ricavo: number
}

/**
 * Classifica dei prodotti/servizi più venduti nel periodo indicato (in giorni).
 * Conta solo l'incassato, come tutti gli altri indicatori economici: includere
 * le fatture emesse e non pagate renderebbe i totali non riconciliabili.
 */
export function prodottiPiuVenduti(
  db: DatabaseGestionale,
  giorni = 30,
  limite = 5,
): ProdottoVenduto[] {
  const { inizio, fine } = finestra(giorni)
  const articoli = indiceMagazzino(db)
  const aggregato = new Map<string, ProdottoVenduto>()

  for (const fattura of fatturePagateNel(db, inizio, fine)) {
    for (const riga of fattura.righe) {
      const articolo = riga.articoloId ? articoli.get(riga.articoloId) : undefined
      const chiave = riga.articoloId ?? riga.descrizione
      const voce = aggregato.get(chiave) ?? {
        articoloId: riga.articoloId,
        nome: articolo?.nome ?? riga.descrizione,
        pezzi: 0,
        ricavo: 0,
      }
      voce.pezzi += riga.quantita
      voce.ricavo += riga.quantita * riga.prezzoUnitario
      aggregato.set(chiave, voce)
    }
  }

  return [...aggregato.values()].sort((a, b) => b.pezzi - a.pezzi).slice(0, limite)
}

/** Incassato e scontrino medio nella finestra indicata. */
export function incassiDelPeriodo(
  db: DatabaseGestionale,
  giorni = 30,
): { incassato: number; documenti: number; scontrinoMedio: number } {
  const { inizio, fine } = finestra(giorni)
  const pagate = fatturePagateNel(db, inizio, fine)
  const incassato = pagate.reduce((somma, f) => somma + totaleFattura(f), 0)
  return {
    incassato,
    documenti: pagate.length,
    scontrinoMedio: pagate.length > 0 ? incassato / pagate.length : 0,
  }
}

/** Articoli sotto la scorta minima, i più critici per primi. */
export function articoliSottoScorta(db: DatabaseGestionale) {
  return db.magazzino
    .filter((a) => a.scorta_minima > 0 && a.quantita <= a.scorta_minima)
    .sort((a, b) => a.quantita - a.scorta_minima - (b.quantita - b.scorta_minima))
}

/** Scadenze aperte ordinate per data, le più imminenti per prime. */
export function scadenzeImminenti(db: DatabaseGestionale, limite = 3) {
  return db.scadenze
    .filter((s) => !s.completata)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, limite)
}

/** Ultime riparazioni accettate, dalla più recente. */
export function ultimeRiparazioni(db: DatabaseGestionale, limite = 5) {
  return [...db.riparazioni]
    .sort(
      (a, b) =>
        b.dataAccettazione.localeCompare(a.dataAccettazione) || b.codice.localeCompare(a.codice),
    )
    .slice(0, limite)
}

export function totaleDaIncassare(db: DatabaseGestionale): number {
  return db.fatture
    .filter((f) => {
      const stato = statoFatturaEffettivo(f)
      return stato === 'emessa' || stato === 'scaduta'
    })
    .reduce((somma, f) => somma + totaleFattura(f), 0)
}

/** Fatture non pagate oltre la data di scadenza, dalla più vecchia. */
export function fattureScadute(db: DatabaseGestionale): Fattura[] {
  return db.fatture
    .filter((f) => statoFatturaEffettivo(f) === 'scaduta')
    .sort((a, b) => (a.scadenza ?? '').localeCompare(b.scadenza ?? ''))
}

export function valoreMagazzino(db: DatabaseGestionale): number {
  return db.magazzino.reduce((somma, a) => somma + a.quantita * a.prezzoAcquisto, 0)
}

/** Ricavi per categoria merceologica nel periodo indicato. */
export function ricaviPerCategoria(db: DatabaseGestionale, giorni = 30) {
  const { inizio, fine } = finestra(giorni)
  const articoli = indiceMagazzino(db)
  const aggregato = new Map<string, number>()

  for (const fattura of fatturePagateNel(db, inizio, fine)) {
    for (const riga of fattura.righe) {
      const articolo = riga.articoloId ? articoli.get(riga.articoloId) : undefined
      const categoria = articolo?.categoria ?? 'Manodopera e servizi'
      aggregato.set(
        categoria,
        (aggregato.get(categoria) ?? 0) + riga.quantita * riga.prezzoUnitario,
      )
    }
  }

  return [...aggregato.entries()]
    .map(([categoria, ricavo]) => ({ categoria, ricavo }))
    .sort((a, b) => b.ricavo - a.ricavo)
}

/** Numero di riparazioni accettate mese per mese, sugli ultimi `mesi` mesi. */
export function riparazioniPerMese(db: DatabaseGestionale, mesi = 6) {
  const oggi = new Date(`${oggiISO()}T00:00:00`)
  const serie: Array<{ mese: string; etichetta: string; riparazioni: number; incasso: number }> = []

  for (let i = mesi - 1; i >= 0; i--) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1)
    const chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
    // Oltre l'anno di storico il solo nome del mese si ripeterebbe.
    const etichetta =
      mesi > 12
        ? `${data.toLocaleDateString('it-IT', { month: 'short' })} ${String(data.getFullYear()).slice(2)}`
        : data.toLocaleDateString('it-IT', { month: 'short' })
    serie.push({
      mese: chiave,
      etichetta,
      riparazioni: db.riparazioni.filter((r) => r.dataAccettazione.startsWith(chiave)).length,
      incasso: Math.round(
        db.fatture
          .filter((f) => f.stato === 'pagata' && f.dataPagamento?.startsWith(chiave))
          .reduce((somma, f) => somma + totaleRighe(f.righe), 0),
      ),
    })
  }

  return serie
}

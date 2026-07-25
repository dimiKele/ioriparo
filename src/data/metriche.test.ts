import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  andamentoIncassi,
  articoliSottoScorta,
  contaPerStato,
  incassiDelPeriodo,
  prodottiPiuVenduti,
  riparazioniConsegnateOggi,
  riparazioniPerStato,
  ricaviPerCategoria,
  totaleDaIncassare,
} from './metriche'
import type { DatabaseGestionale, Fattura, Riparazione } from '@/types'

const OGGI = '2026-07-26'

function fattura(parziale: Partial<Fattura> & Pick<Fattura, 'id'>): Fattura {
  return {
    numero: parziale.id,
    clienteId: 'cli-1',
    data: OGGI,
    stato: 'pagata',
    iva: 22,
    righe: [{ id: `${parziale.id}-r`, descrizione: 'Intervento', quantita: 1, prezzoUnitario: 100 }],
    ...parziale,
  }
}

function riparazione(parziale: Partial<Riparazione> & Pick<Riparazione, 'id'>): Riparazione {
  return {
    codice: `#26-${parziale.id}`,
    clienteId: 'cli-1',
    tipoDispositivo: 'smartphone',
    marca: 'Apple',
    modello: 'iPhone',
    difettoSegnalato: 'Guasto',
    accessori: { scatola: false, cover: false, caricabatterie: false, cavoUsb: false },
    stato: 'in_attesa',
    dataAccettazione: OGGI,
    interventi: [],
    ...parziale,
  }
}

function db(parziale: Partial<DatabaseGestionale> = {}): DatabaseGestionale {
  return {
    clienti: [],
    riparazioni: [],
    preventivi: [],
    fatture: [],
    magazzino: [],
    ordini: [],
    scadenze: [],
    impianti: [],
    movimenti: [],
    azienda: {
      nome: 'Test',
      claim: '',
      indirizzo: '',
      citta: '',
      telefono: '',
      email: '',
      partitaIva: '',
      ivaPredefinita: 22,
      giorniValiditaPreventivo: 30,
      prefissoCodice: '#26-',
      formatoFattura: '{n}/{anno}',
      formatoPreventivo: 'P{aa}-{n}',
    },
    ...parziale,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${OGGI}T09:00:00+02:00`))
})
afterEach(() => vi.useRealTimers())

describe('finestra temporale', () => {
  it('«ultimi 7 giorni» copre esattamente sette giornate, oggi incluso', () => {
    const archivio = db({
      fatture: [
        fattura({ id: 'dentro-oggi', dataPagamento: OGGI }),
        fattura({ id: 'dentro-limite', dataPagamento: '2026-07-20' }),
        fattura({ id: 'fuori', dataPagamento: '2026-07-19' }),
      ],
    })
    const incassi = incassiDelPeriodo(archivio, 7)
    expect(incassi.documenti).toBe(2)
    expect(incassi.incassato).toBe(200)
  })

  it('non conta le fatture con data di pagamento nel futuro', () => {
    const archivio = db({
      fatture: [fattura({ id: 'futura', dataPagamento: '2026-08-10' })],
    })
    expect(incassiDelPeriodo(archivio, 30).documenti).toBe(0)
  })

  it('lo scontrino medio è la media dei documenti del periodo', () => {
    const archivio = db({
      fatture: [
        fattura({ id: 'a', dataPagamento: OGGI }),
        fattura({
          id: 'b',
          dataPagamento: OGGI,
          righe: [{ id: 'b-r', descrizione: 'X', quantita: 1, prezzoUnitario: 300 }],
        }),
      ],
    })
    expect(incassiDelPeriodo(archivio, 30).scontrinoMedio).toBe(200)
  })
})

describe('andamentoIncassi', () => {
  it('produce un punto per giorno e arriva fino a oggi', () => {
    const serie = andamentoIncassi(db(), 7)
    expect(serie).toHaveLength(7)
    expect(serie[serie.length - 1].giorno).toBe(OGGI)
    expect(serie[0].giorno).toBe('2026-07-20')
  })

  it('include l’incasso di oggi', () => {
    const archivio = db({ fatture: [fattura({ id: 'oggi', dataPagamento: OGGI })] })
    const serie = andamentoIncassi(archivio, 30)
    expect(serie[serie.length - 1].incasso).toBe(100)
  })

  it('sul mese corrente parte dal primo e si ferma a oggi', () => {
    const serie = andamentoIncassi(db(), 'mese')
    expect(serie[0].giorno).toBe('2026-07-01')
    expect(serie[serie.length - 1].giorno).toBe(OGGI)
    expect(serie).toHaveLength(26)
  })

  it('sui periodi lunghi l’etichetta riporta anche il mese', () => {
    const serie = andamentoIncassi(db(), 30)
    expect(serie[serie.length - 1].etichetta).toBe('26/07')
  })
})

describe('solo l’incassato entra nelle statistiche di vendita', () => {
  const archivio = db({
    magazzino: [
      {
        id: 'art-1',
        codice: 'DISP',
        nome: 'Display',
        categoria: 'Ricambi',
        quantita: 5,
        scorta_minima: 2,
        prezzoAcquisto: 40,
        prezzoVendita: 100,
      },
    ],
    fatture: [
      fattura({
        id: 'pagata',
        dataPagamento: OGGI,
        righe: [
          { id: 'p-r', descrizione: 'Display', quantita: 2, prezzoUnitario: 100, articoloId: 'art-1' },
        ],
      }),
      fattura({
        id: 'emessa',
        stato: 'emessa',
        dataPagamento: undefined,
        righe: [
          { id: 'e-r', descrizione: 'Display', quantita: 9, prezzoUnitario: 100, articoloId: 'art-1' },
        ],
      }),
    ],
  })

  it('i più venduti ignorano le fatture non incassate', () => {
    const prodotti = prodottiPiuVenduti(archivio, 30)
    expect(prodotti).toHaveLength(1)
    expect(prodotti[0].pezzi).toBe(2)
  })

  it('i ricavi per categoria seguono lo stesso criterio', () => {
    const categorie = ricaviPerCategoria(archivio, 30)
    expect(categorie).toEqual([{ categoria: 'Ricambi', ricavo: 200 }])
  })

  it('le righe senza articolo confluiscono nella manodopera', () => {
    const soloManodopera = db({
      fatture: [fattura({ id: 'm', dataPagamento: OGGI })],
    })
    expect(ricaviPerCategoria(soloManodopera, 30)[0].categoria).toBe('Manodopera e servizi')
  })
})

describe('totaleDaIncassare', () => {
  it('somma emesse e scadute, escludendo pagate e annullate', () => {
    const archivio = db({
      fatture: [
        fattura({ id: 'emessa', stato: 'emessa', dataPagamento: undefined }),
        fattura({ id: 'pagata', dataPagamento: OGGI }),
        fattura({ id: 'annullata', stato: 'annullata', dataPagamento: undefined }),
      ],
    })
    expect(totaleDaIncassare(archivio)).toBe(100)
  })

  it('una fattura oltre la scadenza resta da incassare anche se registrata come emessa', () => {
    const archivio = db({
      fatture: [
        fattura({
          id: 'vecchia',
          stato: 'emessa',
          dataPagamento: undefined,
          scadenza: '2026-06-01',
        }),
      ],
    })
    expect(totaleDaIncassare(archivio)).toBe(100)
  })
})

describe('riparazioni', () => {
  it('la ciambella mostra solo le lavorazioni aperte', () => {
    const archivio = db({
      riparazioni: [
        riparazione({ id: '1', stato: 'in_attesa' }),
        riparazione({ id: '2', stato: 'in_lavorazione' }),
        riparazione({ id: '3', stato: 'consegnato', dataConsegna: OGGI }),
        riparazione({ id: '4', stato: 'non_riparabile' }),
      ],
    })
    const voci = riparazioniPerStato(archivio)
    expect(voci.map((v) => v.stato)).not.toContain('consegnato')
    // Il totale al centro deve coincidere con la somma delle voci mostrate.
    expect(voci.reduce((s, v) => s + v.valore, 0)).toBe(2)
  })

  it('conta le consegne di oggi solo se la riparazione è davvero consegnata', () => {
    const archivio = db({
      riparazioni: [
        riparazione({ id: '1', stato: 'consegnato', dataConsegna: OGGI }),
        // Stato riportato indietro: la data resta a storico ma non è una consegna.
        riparazione({ id: '2', stato: 'in_lavorazione', dataConsegna: OGGI }),
      ],
    })
    expect(riparazioniConsegnateOggi(archivio)).toBe(1)
  })

  it('ignora gli stati sconosciuti invece di produrre NaN', () => {
    const archivio = db({
      riparazioni: [{ ...riparazione({ id: '1' }), stato: 'spedito' as never }],
    })
    const conteggi = contaPerStato(archivio)
    expect(Object.values(conteggi).every((n) => Number.isFinite(n))).toBe(true)
  })
})

describe('articoliSottoScorta', () => {
  it('segnala solo gli articoli con una scorta minima impostata', () => {
    const archivio = db({
      magazzino: [
        {
          id: 'a',
          codice: 'A',
          nome: 'Sotto scorta',
          categoria: 'X',
          quantita: 1,
          scorta_minima: 3,
          prezzoAcquisto: 1,
          prezzoVendita: 2,
        },
        {
          id: 'b',
          codice: 'B',
          nome: 'Non riordinabile',
          categoria: 'X',
          quantita: 0,
          scorta_minima: 0,
          prezzoAcquisto: 1,
          prezzoVendita: 2,
        },
      ],
    })
    expect(articoliSottoScorta(archivio).map((a) => a.id)).toEqual(['a'])
  })
})

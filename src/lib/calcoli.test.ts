import { describe, expect, it } from 'vitest'
import {
  imponibile,
  margine,
  saldoRiparazione,
  scorporoIva,
  totaleRighe,
} from './calcoli'
import type { Riparazione } from '@/types'

function riparazione(interventi: Riparazione['interventi'], acconto?: number): Riparazione {
  return {
    id: 'rip-test',
    codice: '#26-0001',
    clienteId: 'cli-1',
    tipoDispositivo: 'smartphone',
    marca: 'Apple',
    modello: 'iPhone 13',
    difettoSegnalato: 'Display rotto',
    accessori: { scatola: false, cover: false, caricabatterie: false, cavoUsb: false },
    stato: 'in_lavorazione',
    dataAccettazione: '2026-07-01',
    interventi,
    acconto,
  }
}

describe('scorporo IVA', () => {
  it('scompone un totale lordo nelle due parti che lo ricompongono', () => {
    expect(imponibile(122, 22) + scorporoIva(122, 22)).toBeCloseTo(122, 10)
  })

  it('con aliquota 22% imponibile e imposta arrotondati tornano al totale', () => {
    // Il documento mostra i valori arrotondati al centesimo: se la somma non
    // torna, il cliente vede una fattura che non quadra.
    const disallineati: number[] = []
    for (let centesimi = 1; centesimi <= 200_000; centesimi++) {
      const totale = centesimi / 100
      const somma =
        Math.round(imponibile(totale, 22) * 100) + Math.round(scorporoIva(totale, 22) * 100)
      if (somma !== centesimi) disallineati.push(totale)
    }
    expect(disallineati).toEqual([])
  })

  it('con aliquota zero non toglie nulla', () => {
    expect(scorporoIva(100, 0)).toBe(0)
    expect(imponibile(100, 0)).toBe(100)
  })
})

describe('totaleRighe', () => {
  it('somma quantità per prezzo', () => {
    expect(
      totaleRighe([
        { id: '1', descrizione: 'Display', quantita: 2, prezzoUnitario: 80 },
        { id: '2', descrizione: 'Manodopera', quantita: 1, prezzoUnitario: 30 },
      ]),
    ).toBe(190)
  })

  it('tiene conto delle righe negative usate per sconti e acconti', () => {
    expect(
      totaleRighe([
        { id: '1', descrizione: 'Riparazione', quantita: 1, prezzoUnitario: 100 },
        { id: '2', descrizione: 'Acconto', quantita: 1, prezzoUnitario: -30 },
      ]),
    ).toBe(70)
  })

  it('su un elenco vuoto vale zero', () => {
    expect(totaleRighe([])).toBe(0)
  })
})

describe('saldoRiparazione', () => {
  it('sottrae l’acconto già versato', () => {
    const r = riparazione([{ id: '1', descrizione: 'X', quantita: 1, prezzoUnitario: 100 }], 30)
    expect(saldoRiparazione(r)).toBe(70)
  })

  it('non scende sotto zero quando l’acconto supera il totale', () => {
    const r = riparazione([{ id: '1', descrizione: 'X', quantita: 1, prezzoUnitario: 40 }], 100)
    expect(saldoRiparazione(r)).toBe(0)
  })
})

describe('margine', () => {
  it('calcola la percentuale sul prezzo di vendita', () => {
    expect(margine(50, 100)).toBe(50)
  })

  it('restituisce zero se il prezzo di vendita non è positivo', () => {
    expect(margine(50, 0)).toBe(0)
    expect(margine(50, -10)).toBe(0)
  })
})

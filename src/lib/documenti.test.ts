import { describe, expect, it } from 'vitest'
import {
  componiNumero,
  dataPiuGiorni,
  DESCRIZIONE_ACCONTO,
  fatturaModificabile,
  formatoValido,
  preventivoModificabile,
  prossimoProgressivo,
  righeDaRiparazione,
} from './documenti'
import type { Fattura, Preventivo, Riparazione } from '@/types'

const RIPARAZIONE: Riparazione = {
  id: 'rip-1',
  codice: '#26-0007',
  clienteId: 'cli-1',
  tipoDispositivo: 'smartphone',
  marca: 'Samsung',
  modello: 'Galaxy S22',
  difettoSegnalato: 'Non carica',
  accessori: { scatola: false, cover: true, caricabatterie: false, cavoUsb: false },
  stato: 'pronto_per_ritiro',
  dataAccettazione: '2026-07-01',
  interventi: [
    { id: 'int-1', descrizione: 'Connettore di ricarica', quantita: 1, prezzoUnitario: 45 },
  ],
  acconto: 20,
}

describe('componiNumero', () => {
  it('sostituisce progressivo, anno esteso e anno breve', () => {
    expect(componiNumero('{n}/{anno}', 7, 2026)).toBe('0007/2026')
    expect(componiNumero('P{aa}-{n}', 14, 2026)).toBe('P26-0014')
    expect(componiNumero('O{aa}-{n}', 3, 2026)).toBe('O26-0003')
  })

  it('non tronca i progressivi oltre le quattro cifre', () => {
    expect(componiNumero('{n}/{anno}', 12345, 2026)).toBe('12345/2026')
  })
})

describe('prossimoProgressivo', () => {
  it('riparte dal numero più alto della serie corrente', () => {
    const numeri = ['0001/2026', '0123/2026', '0007/2026']
    expect(prossimoProgressivo(numeri, '{n}/{anno}', 2026)).toBe(124)
  })

  it('ignora i numeri di altre annate', () => {
    // A gennaio la numerazione deve ripartire da 1, non continuare l'anno prima.
    const numeri = ['0500/2025', '0499/2025']
    expect(prossimoProgressivo(numeri, '{n}/{anno}', 2026)).toBe(1)
  })

  it('ignora i numeri che non seguono il modello', () => {
    const numeri = ['fattura-vecchia', '', 'P26-0014']
    expect(prossimoProgressivo(numeri, '{n}/{anno}', 2026)).toBe(1)
  })

  it('riconosce il modello con anno a due cifre', () => {
    expect(prossimoProgressivo(['P26-0014', 'P26-0009'], 'P{aa}-{n}', 2026)).toBe(15)
  })

  it('su un archivio vuoto parte da 1', () => {
    expect(prossimoProgressivo([], '{n}/{anno}', 2026)).toBe(1)
  })
})

describe('formatoValido', () => {
  it('richiede il segnaposto del progressivo', () => {
    expect(formatoValido('{n}/{anno}')).toBe(true)
    expect(formatoValido('FT-{anno}')).toBe(false)
  })
})

describe('dataPiuGiorni', () => {
  it('somma i giorni restando in formato ISO', () => {
    expect(dataPiuGiorni('2026-07-26', 30)).toBe('2026-08-25')
  })

  it('attraversa correttamente il cambio d’anno', () => {
    expect(dataPiuGiorni('2026-12-20', 20)).toBe('2027-01-09')
  })

  it('gestisce gli anni bisestili', () => {
    expect(dataPiuGiorni('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('righeDaRiparazione', () => {
  it('senza acconto riporta i soli interventi', () => {
    const righe = righeDaRiparazione(RIPARAZIONE, false)
    expect(righe).toHaveLength(1)
    expect(righe[0].descrizione).toBe('Connettore di ricarica')
  })

  it('con acconto aggiunge una riga in detrazione', () => {
    const righe = righeDaRiparazione(RIPARAZIONE, true)
    expect(righe).toHaveLength(2)
    expect(righe[1].descrizione).toBe(DESCRIZIONE_ACCONTO)
    expect(righe[1].prezzoUnitario).toBe(-20)
  })

  it('assegna identificativi nuovi, per non collidere con le righe di origine', () => {
    const righe = righeDaRiparazione(RIPARAZIONE, false)
    expect(righe[0].id).not.toBe('int-1')
  })

  it('non aggiunge nulla se l’acconto è assente o nullo', () => {
    expect(righeDaRiparazione({ ...RIPARAZIONE, acconto: 0 }, true)).toHaveLength(1)
    expect(righeDaRiparazione({ ...RIPARAZIONE, acconto: undefined }, true)).toHaveLength(1)
  })
})

describe('documenti modificabili', () => {
  const preventivo = (stato: Preventivo['stato']): Preventivo => ({
    id: 'p',
    numero: 'P26-0001',
    clienteId: 'c',
    data: '2026-07-01',
    stato,
    righe: [],
    iva: 22,
  })
  const fattura = (stato: Fattura['stato']): Fattura => ({
    id: 'f',
    numero: '0001/2026',
    clienteId: 'c',
    data: '2026-07-01',
    stato,
    righe: [],
    iva: 22,
  })

  it('il preventivo resta modificabile finché non è accettato o rifiutato', () => {
    expect(preventivoModificabile(preventivo('bozza'))).toBe(true)
    expect(preventivoModificabile(preventivo('inviato'))).toBe(true)
    expect(preventivoModificabile(preventivo('accettato'))).toBe(false)
    expect(preventivoModificabile(preventivo('rifiutato'))).toBe(false)
  })

  it('la fattura si blocca una volta incassata o stornata', () => {
    expect(fatturaModificabile(fattura('emessa'))).toBe(true)
    expect(fatturaModificabile(fattura('scaduta'))).toBe(true)
    expect(fatturaModificabile(fattura('pagata'))).toBe(false)
    expect(fatturaModificabile(fattura('annullata'))).toBe(false)
  })
})

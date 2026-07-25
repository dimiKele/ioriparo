import { describe, expect, it } from 'vitest'
import { statoFatturaEffettivo, statoPreventivoEffettivo } from './stati'
import type { Fattura, Preventivo } from '@/types'

const OGGI = '2026-07-26'

function fattura(parziale: Partial<Fattura>): Fattura {
  return {
    id: 'f1',
    numero: '0001/2026',
    clienteId: 'cli-1',
    data: '2026-06-01',
    stato: 'emessa',
    righe: [],
    iva: 22,
    ...parziale,
  }
}

function preventivo(parziale: Partial<Preventivo>): Preventivo {
  return {
    id: 'p1',
    numero: 'P26-0001',
    clienteId: 'cli-1',
    data: '2026-06-01',
    stato: 'inviato',
    righe: [],
    iva: 22,
    ...parziale,
  }
}

describe('statoFatturaEffettivo', () => {
  it('marca come scaduta una fattura non pagata oltre il termine', () => {
    expect(statoFatturaEffettivo(fattura({ scadenza: '2026-07-01' }), OGGI)).toBe('scaduta')
  })

  it('lascia emessa una fattura ancora nei termini', () => {
    expect(statoFatturaEffettivo(fattura({ scadenza: '2026-08-01' }), OGGI)).toBe('emessa')
  })

  it('nel giorno stesso della scadenza non è ancora scaduta', () => {
    expect(statoFatturaEffettivo(fattura({ scadenza: OGGI }), OGGI)).toBe('emessa')
  })

  it('senza scadenza resta emessa', () => {
    expect(statoFatturaEffettivo(fattura({ scadenza: undefined }), OGGI)).toBe('emessa')
  })

  it('non tocca le fatture incassate o stornate', () => {
    expect(statoFatturaEffettivo(fattura({ stato: 'pagata', scadenza: '2026-01-01' }), OGGI)).toBe(
      'pagata',
    )
    expect(
      statoFatturaEffettivo(fattura({ stato: 'annullata', scadenza: '2026-01-01' }), OGGI),
    ).toBe('annullata')
  })

  it('corregge uno stato «scaduta» registrato ma non più vero', () => {
    expect(statoFatturaEffettivo(fattura({ stato: 'scaduta', scadenza: '2026-09-01' }), OGGI)).toBe(
      'emessa',
    )
  })
})

describe('statoPreventivoEffettivo', () => {
  it('marca come scaduto un preventivo oltre la validità', () => {
    expect(statoPreventivoEffettivo(preventivo({ validoFino: '2026-07-01' }), OGGI)).toBe('scaduto')
  })

  it('lascia inviato un preventivo ancora valido', () => {
    expect(statoPreventivoEffettivo(preventivo({ validoFino: '2026-08-01' }), OGGI)).toBe('inviato')
  })

  it('una bozza resta una bozza anche se la data è passata', () => {
    expect(
      statoPreventivoEffettivo(preventivo({ stato: 'bozza', validoFino: '2026-01-01' }), OGGI),
    ).toBe('bozza')
  })

  it('non riapre un preventivo già accettato o rifiutato', () => {
    expect(
      statoPreventivoEffettivo(preventivo({ stato: 'accettato', validoFino: '2026-01-01' }), OGGI),
    ).toBe('accettato')
    expect(
      statoPreventivoEffettivo(preventivo({ stato: 'rifiutato', validoFino: '2026-01-01' }), OGGI),
    ).toBe('rifiutato')
  })
})

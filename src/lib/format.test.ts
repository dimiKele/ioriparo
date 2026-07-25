import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatData,
  giorniAllaData,
  iniziali,
  linkWhatsApp,
  nomeAbbreviato,
  oggiISO,
  scadenzaRelativa,
} from './format'

afterEach(() => vi.useRealTimers())

describe('oggiISO', () => {
  it('restituisce la data locale, non quella UTC', () => {
    // Mezzanotte e mezza del 26 luglio a Roma è ancora il 25 in UTC:
    // usare `toISOString` senza compensazione sposterebbe tutto indietro.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T00:30:00+02:00'))
    expect(oggiISO()).toBe('2026-07-26')
  })

  it('resta corretto anche a fine giornata', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T23:30:00+02:00'))
    expect(oggiISO()).toBe('2026-07-26')
  })
})

describe('formatData', () => {
  it('converte ISO in formato italiano', () => {
    expect(formatData('2026-07-26')).toBe('26/07/2026')
  })

  it('mostra un segnaposto quando la data manca', () => {
    expect(formatData(undefined)).toBe('--')
    expect(formatData('')).toBe('--')
  })
})

describe('giorniAllaData', () => {
  it('conta i giorni mancanti e quelli passati', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T10:00:00+02:00'))
    expect(giorniAllaData('2026-07-29')).toBe(3)
    expect(giorniAllaData('2026-07-26')).toBe(0)
    expect(giorniAllaData('2026-07-24')).toBe(-2)
  })

  it('non sbaglia attraversando il cambio dell’ora legale', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T12:00:00+02:00'))
    // Il 25 ottobre 2026 le lancette tornano indietro di un'ora: senza
    // arrotondamento la differenza darebbe 6,96 giorni invece di 7.
    expect(giorniAllaData('2026-10-31')).toBe(7)
  })
})

describe('scadenzaRelativa', () => {
  it('descrive le scadenze vicine a parole', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T10:00:00+02:00'))
    expect(scadenzaRelativa('2026-07-26')).toBe('Scade oggi')
    expect(scadenzaRelativa('2026-07-27')).toBe('Scade domani')
    expect(scadenzaRelativa('2026-07-25')).toBe('Scaduta ieri')
    expect(scadenzaRelativa('2026-07-20')).toBe('Scaduta da 6 giorni')
  })
})

describe('linkWhatsApp', () => {
  it('antepone il prefisso italiano ai numeri nazionali', () => {
    expect(linkWhatsApp('333 1234567')).toBe('https://wa.me/393331234567')
  })

  it('non duplica il prefisso sui numeri già internazionali', () => {
    expect(linkWhatsApp('+39 333 1234567')).toBe('https://wa.me/393331234567')
    expect(linkWhatsApp('0039 333 1234567')).toBe('https://wa.me/393331234567')
  })

  it('rispetta i numeri esteri', () => {
    expect(linkWhatsApp('+44 7700 900123')).toBe('https://wa.me/447700900123')
  })

  it('non genera un link se il numero non è utilizzabile', () => {
    expect(linkWhatsApp('')).toBeUndefined()
    expect(linkWhatsApp(undefined)).toBeUndefined()
    expect(linkWhatsApp('123')).toBeUndefined()
  })
})

describe('iniziali e nomeAbbreviato', () => {
  it('ricava le iniziali da nomi semplici e composti', () => {
    expect(iniziali('Mario Rossi')).toBe('MR')
    expect(iniziali('Studio Tecnico Bianchi')).toBe('SB')
    expect(iniziali('Farmacia')).toBe('FA')
    expect(iniziali('   ')).toBe('?')
  })

  it('abbrevia il cognome', () => {
    expect(nomeAbbreviato('Giuseppe Nardelli')).toBe('Giuseppe N.')
    expect(nomeAbbreviato('Farmacia')).toBe('Farmacia')
  })
})

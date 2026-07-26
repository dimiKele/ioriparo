import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  dimenticaAccesso,
  haImprontaLocale,
  impostaSoloLocale,
  memorizzaPassword,
  soloLocale,
  verificaPasswordLocale,
} from './accesso'

/** `localStorage` minimo: i test girano in ambiente Node. */
function fintoStorage() {
  const dati = new Map<string, string>()
  return {
    getItem: (chiave: string) => dati.get(chiave) ?? null,
    setItem: (chiave: string, valore: string) => void dati.set(chiave, valore),
    removeItem: (chiave: string) => void dati.delete(chiave),
    clear: () => dati.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
}

beforeEach(() => {
  globalThis.window = { localStorage: fintoStorage() } as unknown as Window & typeof globalThis
})
afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('impronta della password', () => {
  it('all’inizio non c’è nulla di memorizzato', () => {
    expect(haImprontaLocale()).toBe(false)
  })

  it('riconosce la password corretta dopo averla memorizzata', async () => {
    await memorizzaPassword('u7avk-5d6ui')
    expect(haImprontaLocale()).toBe(true)
    expect(await verificaPasswordLocale('u7avk-5d6ui')).toBe(true)
  })

  it('rifiuta una password diversa', async () => {
    await memorizzaPassword('password-giusta')
    expect(await verificaPasswordLocale('password-sbagliata')).toBe(false)
    expect(await verificaPasswordLocale('')).toBe(false)
  })

  it('senza impronta non si sblocca nulla', async () => {
    // È il caso di una postazione nuova offline: deve restare fuori.
    expect(await verificaPasswordLocale('qualsiasi')).toBe(false)
  })

  it('non conserva la password in chiaro', async () => {
    await memorizzaPassword('segretissima')
    const salvato = window.localStorage.getItem('ioriparo:accesso:v1') ?? ''
    expect(salvato).not.toContain('segretissima')
  })

  it('usa un sale diverso a ogni memorizzazione', async () => {
    await memorizzaPassword('stessa')
    const primo = window.localStorage.getItem('ioriparo:accesso:v1')
    await memorizzaPassword('stessa')
    const secondo = window.localStorage.getItem('ioriparo:accesso:v1')
    // Con lo stesso sale due impronte identiche direbbero a un curioso che la
    // password non è cambiata.
    expect(primo).not.toBe(secondo)
  })
})

describe('modalità solo locale', () => {
  it('parte disattivata e si può attivare e togliere', () => {
    expect(soloLocale()).toBe(false)
    impostaSoloLocale(true)
    expect(soloLocale()).toBe(true)
    impostaSoloLocale(false)
    expect(soloLocale()).toBe(false)
  })
})

describe('dimenticaAccesso', () => {
  it('cancella impronta e modalità, lasciando stare l’archivio', async () => {
    await memorizzaPassword('x')
    impostaSoloLocale(true)
    window.localStorage.setItem('ioriparo:db:v1', '{"clienti":[]}')

    dimenticaAccesso()

    expect(haImprontaLocale()).toBe(false)
    expect(soloLocale()).toBe(false)
    // I dati non si toccano: si sta chiudendo la porta, non svuotando la casa.
    expect(window.localStorage.getItem('ioriparo:db:v1')).toBe('{"clienti":[]}')
  })
})

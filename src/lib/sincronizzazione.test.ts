import { describe, expect, it } from 'vitest'
import {
  applica,
  calcolaModifiche,
  conservaAllegati,
  ID_AZIENDA,
  scomponi,
  senzaAllegati,
  sessioneAttiva,
  type RecordRemoto,
} from './sincronizzazione'
import type { Cliente, DatabaseGestionale } from '@/types'

function cliente(id: string, nome: string): Cliente {
  return { id, nome, tipo: 'privato', telefono: '333', creatoIl: '2026-01-01' }
}

/**
 * Riferimento condiviso: il confronto delle modifiche è per riferimento, e
 * ricreare l'oggetto a ogni archivio farebbe apparire l'anagrafica aziendale
 * come sempre modificata.
 */
const AZIENDA: DatabaseGestionale['azienda'] = {
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
}

function archivio(parziale: Partial<DatabaseGestionale> = {}): DatabaseGestionale {
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
    azienda: AZIENDA,
    ...parziale,
  }
}

describe('calcolaModifiche', () => {
  it('su un archivio invariato non propone nulla', () => {
    const db = archivio({ clienti: [cliente('c1', 'Mario')] })
    expect(calcolaModifiche(db, db)).toEqual([])
  })

  it('rileva un record aggiunto', () => {
    const prima = archivio({ clienti: [cliente('c1', 'Mario')] })
    const dopo = archivio({ clienti: [...prima.clienti, cliente('c2', 'Anna')] })
    const modifiche = calcolaModifiche(prima, dopo)
    expect(modifiche).toHaveLength(1)
    expect(modifiche[0]).toMatchObject({ collezione: 'clienti', id: 'c2', eliminato: false })
  })

  it('rileva un record modificato ma ignora quelli intatti', () => {
    const invariato = cliente('c1', 'Mario')
    const prima = archivio({ clienti: [invariato, cliente('c2', 'Anna')] })
    const dopo = archivio({ clienti: [invariato, cliente('c2', 'Anna Bianchi')] })
    const modifiche = calcolaModifiche(prima, dopo)
    expect(modifiche.map((m) => m.id)).toEqual(['c2'])
  })

  it('segnala le eliminazioni, altrimenti il record tornerebbe indietro', () => {
    const prima = archivio({ clienti: [cliente('c1', 'Mario')] })
    const dopo = archivio({ clienti: [] })
    expect(calcolaModifiche(prima, dopo)).toEqual([
      { collezione: 'clienti', id: 'c1', dati: null, eliminato: true },
    ])
  })

  it('rileva il cambio dei dati aziendali', () => {
    const prima = archivio()
    const dopo = archivio({ azienda: { ...AZIENDA, nome: 'Nuovo nome' } })
    const modifiche = calcolaModifiche(prima, dopo)
    expect(modifiche).toHaveLength(1)
    expect(modifiche[0]).toMatchObject({ collezione: 'azienda', id: ID_AZIENDA })
  })

  it('non invia foto e firme, che supererebbero il limite per record', () => {
    const riparazione = {
      id: 'r1',
      codice: '#26-0001',
      clienteId: 'c1',
      tipoDispositivo: 'smartphone' as const,
      marca: 'Apple',
      modello: 'iPhone',
      difettoSegnalato: 'Rotto',
      accessori: { scatola: false, cover: false, caricabatterie: false, cavoUsb: false },
      stato: 'in_attesa' as const,
      dataAccettazione: '2026-07-01',
      interventi: [],
      foto: ['data:image/jpeg;base64,AAAA'],
      firmaCliente: 'data:image/png;base64,BBBB',
    }
    const modifiche = calcolaModifiche(archivio(), archivio({ riparazioni: [riparazione] }))
    const inviato = modifiche[0].dati as Record<string, unknown>
    expect(inviato.foto).toBeUndefined()
    expect(inviato.firmaCliente).toBeUndefined()
    expect(inviato.codice).toBe('#26-0001')
  })
})

describe('applica', () => {
  it('inserisce un record nuovo arrivato dal server', () => {
    const remoti: RecordRemoto[] = [
      {
        collezione: 'clienti',
        id: 'c9',
        dati: cliente('c9', 'Remoto'),
        aggiornatoIl: 1,
        eliminato: false,
      },
    ]
    const risultato = applica(archivio(), remoti)
    expect(risultato.clienti.map((c) => c.id)).toEqual(['c9'])
  })

  it('sostituisce un record esistente', () => {
    const partenza = archivio({ clienti: [cliente('c1', 'Vecchio')] })
    const risultato = applica(partenza, [
      {
        collezione: 'clienti',
        id: 'c1',
        dati: cliente('c1', 'Nuovo'),
        aggiornatoIl: 2,
        eliminato: false,
      },
    ])
    expect(risultato.clienti[0].nome).toBe('Nuovo')
  })

  it('rimuove i record cancellati altrove', () => {
    const partenza = archivio({ clienti: [cliente('c1', 'Mario')] })
    const risultato = applica(partenza, [
      { collezione: 'clienti', id: 'c1', dati: null, aggiornatoIl: 3, eliminato: true },
    ])
    expect(risultato.clienti).toEqual([])
  })

  it('non tocca l’archivio quando non arriva nulla', () => {
    const partenza = archivio({ clienti: [cliente('c1', 'Mario')] })
    expect(applica(partenza, [])).toBe(partenza)
  })

  it('aggiorna i dati aziendali', () => {
    const risultato = applica(archivio(), [
      {
        collezione: 'azienda',
        id: ID_AZIENDA,
        dati: { ...AZIENDA, nome: 'Officina Remota' },
        aggiornatoIl: 4,
        eliminato: false,
      },
    ])
    expect(risultato.azienda.nome).toBe('Officina Remota')
  })

  it('conserva le foto locali quando il server rimanda la scheda senza allegati', () => {
    // Il server non trasporta gli allegati: adottare la sua versione così
    // com'è cancellerebbe le foto dalla postazione che le ha scattate.
    const locale = {
      id: 'r1',
      codice: '#26-0001',
      clienteId: 'c1',
      tipoDispositivo: 'smartphone' as const,
      marca: 'Apple',
      modello: 'iPhone',
      difettoSegnalato: 'Rotto',
      accessori: { scatola: false, cover: false, caricabatterie: false, cavoUsb: false },
      stato: 'in_attesa' as const,
      dataAccettazione: '2026-07-01',
      interventi: [],
      foto: ['data:image/jpeg;base64,AAAA'],
    }
    const risultato = applica(archivio({ riparazioni: [locale] }), [
      {
        collezione: 'riparazioni',
        id: 'r1',
        dati: { ...senzaAllegati(locale), stato: 'in_lavorazione' },
        aggiornatoIl: 5,
        eliminato: false,
      },
    ])
    expect(risultato.riparazioni[0].stato).toBe('in_lavorazione')
    expect(risultato.riparazioni[0].foto).toEqual(['data:image/jpeg;base64,AAAA'])
  })
})

describe('conservaAllegati', () => {
  it('senza record precedente restituisce quello nuovo', () => {
    const nuovo = { id: 'x' }
    expect(conservaAllegati(nuovo, undefined)).toBe(nuovo)
  })
})

describe('scomponi', () => {
  it('produce un record per ogni voce più quello aziendale', () => {
    const db = archivio({ clienti: [cliente('c1', 'Mario'), cliente('c2', 'Anna')] })
    const record = scomponi(db)
    expect(record).toHaveLength(3)
    expect(record.some((r) => r.collezione === 'azienda' && r.id === ID_AZIENDA)).toBe(true)
  })
})

describe('sessioneAttiva', () => {
  it('richiede un token non scaduto', () => {
    expect(sessioneAttiva(null)).toBe(false)
    expect(sessioneAttiva({ indirizzo: 'https://x' })).toBe(false)
    expect(
      sessioneAttiva({ indirizzo: 'https://x', token: 't', scadenzaToken: Date.now() - 1000 }),
    ).toBe(false)
    expect(
      sessioneAttiva({ indirizzo: 'https://x', token: 't', scadenzaToken: Date.now() + 60_000 }),
    ).toBe(true)
  })
})

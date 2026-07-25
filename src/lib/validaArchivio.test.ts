import { describe, expect, it } from 'vitest'
import {
  ArchivioNonValido,
  preparaEsportazione,
  validaArchivio,
  VERSIONE_ARCHIVIO,
} from './validaArchivio'
import { creaDatabaseIniziale } from '@/data/seed'
import type { DatabaseGestionale } from '@/types'

const riferimento = (): DatabaseGestionale => creaDatabaseIniziale()

/** Archivio minimo ma completo, usato come base dei casi limite. */
function archivioMinimo() {
  return {
    clienti: [
      { id: 'cli-1', nome: 'Mario Rossi', tipo: 'privato', telefono: '333', creatoIl: '2026-01-10' },
    ],
    riparazioni: [],
    preventivi: [],
    fatture: [],
    magazzino: [],
    ordini: [],
    scadenze: [],
    impianti: [],
    azienda: riferimento().azienda,
  }
}

describe('rifiuto dei file non pertinenti', () => {
  it('rifiuta ciò che non è un oggetto', () => {
    expect(() => validaArchivio(null, riferimento())).toThrow(ArchivioNonValido)
    expect(() => validaArchivio([1, 2, 3], riferimento())).toThrow(ArchivioNonValido)
    expect(() => validaArchivio('testo', riferimento())).toThrow(ArchivioNonValido)
  })

  it('rifiuta un oggetto senza alcuna sezione riconoscibile', () => {
    expect(() => validaArchivio({ qualcosa: 1 }, riferimento())).toThrow(ArchivioNonValido)
  })

  it('rifiuta un backup di un’altra applicazione', () => {
    expect(() =>
      validaArchivio({ applicazione: 'altro', versione: 1, dati: {} }, riferimento()),
    ).toThrow(/altra applicazione/i)
  })

  it('rifiuta un backup di una versione futura', () => {
    expect(() =>
      validaArchivio(
        { applicazione: 'ioriparo', versione: VERSIONE_ARCHIVIO + 1, dati: archivioMinimo() },
        riferimento(),
      ),
    ).toThrow(/più recente/i)
  })
})

describe('formati accettati', () => {
  it('accetta il database grezzo dei backup precedenti', () => {
    const { db } = validaArchivio(archivioMinimo(), riferimento())
    expect(db.clienti).toHaveLength(1)
  })

  it('accetta il formato con intestazione e ne estrae i dati', () => {
    const esportato = preparaEsportazione(
      archivioMinimo() as unknown as DatabaseGestionale,
      '2026-07-26T10:00:00.000Z',
    )
    const { db } = validaArchivio(esportato, riferimento())
    expect(db.clienti[0].nome).toBe('Mario Rossi')
  })

  it('l’esportazione porta firma e versione dello schema', () => {
    const esportato = preparaEsportazione(riferimento(), '2026-07-26T10:00:00.000Z')
    expect(esportato.applicazione).toBe('ioriparo')
    expect(esportato.versione).toBe(VERSIONE_ARCHIVIO)
  })
})

describe('riparazione dei dati incoerenti', () => {
  it('ripristina le collezioni mancanti invece di lasciarle indefinite', () => {
    // È il caso che prima faceva esplodere l'app a ogni avvio.
    const { db, avvisi } = validaArchivio(
      { clienti: [], riparazioni: [] },
      riferimento(),
    )
    expect(db.fatture).toEqual([])
    expect(db.magazzino).toEqual([])
    expect(db.impianti).toEqual([])
    expect(db.azienda.nome).toBeTypeOf('string')
    expect(avvisi.some((a) => a.includes('Dati aziendali'))).toBe(true)
  })

  it('sostituisce una collezione del tipo sbagliato con una vuota', () => {
    const { db, avvisi } = validaArchivio(
      { ...archivioMinimo(), fatture: {}, magazzino: null },
      riferimento(),
    )
    expect(db.fatture).toEqual([])
    expect(db.magazzino).toEqual([])
    expect(avvisi.length).toBeGreaterThan(0)
  })

  it('riporta a un valore noto gli stati non riconosciuti', () => {
    const { db } = validaArchivio(
      {
        ...archivioMinimo(),
        riparazioni: [
          {
            id: 'rip-1',
            codice: '#26-0001',
            clienteId: 'cli-1',
            stato: 'spedito',
            tipoDispositivo: 'astronave',
            dataAccettazione: '2026-07-01',
            accessori: {},
            interventi: [],
          },
        ],
      },
      riferimento(),
    )
    expect(db.riparazioni[0].stato).toBe('in_attesa')
    expect(db.riparazioni[0].tipoDispositivo).toBe('altro')
  })

  it('scarta i record privi dei campi indispensabili e lo segnala', () => {
    const { db, avvisi } = validaArchivio(
      { ...archivioMinimo(), clienti: [{ id: 'cli-2' }, 'non un oggetto'] },
      riferimento(),
    )
    expect(db.clienti).toHaveLength(0)
    expect(avvisi.some((a) => a.includes('Clienti'))).toBe(true)
  })

  it('scarta i duplicati di identificativo', () => {
    const { db, avvisi } = validaArchivio(
      {
        ...archivioMinimo(),
        clienti: [
          { id: 'cli-1', nome: 'Primo', tipo: 'privato', telefono: '1', creatoIl: '2026-01-01' },
          { id: 'cli-1', nome: 'Secondo', tipo: 'privato', telefono: '2', creatoIl: '2026-01-01' },
        ],
      },
      riferimento(),
    )
    expect(db.clienti).toHaveLength(1)
    expect(db.clienti[0].nome).toBe('Primo')
    expect(avvisi.some((a) => a.includes('duplicato'))).toBe(true)
  })

  it('normalizza le date malformate senza perdere il record', () => {
    const { db } = validaArchivio(
      {
        ...archivioMinimo(),
        scadenze: [
          { id: 's1', titolo: 'Tassa', tipo: 'tassa', priorita: 'urgente', data: '31/12/2026' },
        ],
      },
      riferimento(),
    )
    expect(db.scadenze).toHaveLength(1)
    expect(db.scadenze[0].data).toBe('')
  })

  it('converte gli importi scritti come testo', () => {
    const { db } = validaArchivio(
      {
        ...archivioMinimo(),
        magazzino: [{ id: 'a1', nome: 'Display', prezzoVendita: '99,50', quantita: '3' }],
      },
      riferimento(),
    )
    expect(db.magazzino[0].prezzoVendita).toBe(99.5)
    expect(db.magazzino[0].quantita).toBe(3)
  })

  it('scarta le foto che non sono data URL', () => {
    const { db } = validaArchivio(
      {
        ...archivioMinimo(),
        riparazioni: [
          {
            id: 'rip-1',
            clienteId: 'cli-1',
            dataAccettazione: '2026-07-01',
            interventi: [],
            foto: ['https://esempio.it/foto.jpg', 'data:image/jpeg;base64,AAAA'],
          },
        ],
      },
      riferimento(),
    )
    expect(db.riparazioni[0].foto).toEqual(['data:image/jpeg;base64,AAAA'])
  })

  it('segnala i documenti rimasti senza cliente', () => {
    const { avvisi } = validaArchivio(
      {
        ...archivioMinimo(),
        fatture: [
          {
            id: 'f1',
            numero: '0001/2026',
            clienteId: 'cli-inesistente',
            data: '2026-07-01',
            righe: [],
          },
        ],
      },
      riferimento(),
    )
    expect(avvisi.some((a) => a.includes('fatture') && a.includes('cliente'))).toBe(true)
  })

  it('considera già ricevuti gli ordini chiusi negli archivi precedenti', () => {
    // Prima delle consegne parziali le righe non registravano le quantità:
    // senza riallineamento un ordine chiuso risulterebbe ancora da ricevere.
    const { db } = validaArchivio(
      {
        ...archivioMinimo(),
        ordini: [
          {
            id: 'o1',
            numero: 'O26-0001',
            fornitore: 'Esprinet',
            data: '2026-07-01',
            stato: 'ricevuto',
            righe: [{ id: 'r1', descrizione: 'SSD', quantita: 8, prezzoUnitario: 58 }],
          },
        ],
      },
      riferimento(),
    )
    expect(db.ordini[0].righe[0].quantitaRicevuta).toBe(8)
    expect(db.ordini[0].ricevutoIl).toBe('2026-07-01')
  })
})

describe('archivio dimostrativo', () => {
  it('supera la validazione senza alcuna correzione', () => {
    const { avvisi } = validaArchivio(riferimento(), riferimento())
    expect(avvisi).toEqual([])
  })

  it('sopravvive a un giro completo di esportazione e reimportazione', () => {
    const originale = riferimento()
    const serializzato = JSON.parse(
      JSON.stringify(preparaEsportazione(originale, '2026-07-26T10:00:00.000Z')),
    )
    const { db, avvisi } = validaArchivio(serializzato, riferimento())
    expect(avvisi).toEqual([])
    expect(db.clienti).toHaveLength(originale.clienti.length)
    expect(db.riparazioni).toHaveLength(originale.riparazioni.length)
    expect(db.fatture).toHaveLength(originale.fatture.length)
  })
})

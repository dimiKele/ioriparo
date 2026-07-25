import { describe, expect, it } from 'vitest'
import { cercaOvunque, perGruppo } from './ricercaGlobale'
import type { DatabaseGestionale } from '@/types'

const ARCHIVIO: DatabaseGestionale = {
  clienti: [
    {
      id: 'cli-1',
      nome: 'Antonio Perrucci',
      tipo: 'privato',
      telefono: '333 1234567',
      citta: 'Altamura',
      creatoIl: '2026-01-01',
    },
    {
      id: 'cli-2',
      nome: 'Farmacia Centrale',
      tipo: 'azienda',
      telefono: '080 3141592',
      partitaIva: '01234567890',
      creatoIl: '2026-01-01',
    },
  ],
  riparazioni: [
    {
      id: 'rip-1',
      codice: '#26-0001',
      clienteId: 'cli-1',
      tipoDispositivo: 'smartphone',
      marca: 'Apple',
      modello: 'iPhone 13',
      imei: '352099114587632',
      difettoSegnalato: 'Display rotto',
      accessori: { scatola: false, cover: false, caricabatterie: false, cavoUsb: false },
      stato: 'in_attesa',
      dataAccettazione: '2026-07-01',
      interventi: [],
    },
  ],
  preventivi: [
    {
      id: 'prv-1',
      numero: 'P26-0014',
      clienteId: 'cli-2',
      data: '2026-07-01',
      stato: 'inviato',
      righe: [{ id: 'r', descrizione: 'Stampante fiscale', quantita: 1, prezzoUnitario: 620 }],
      iva: 22,
    },
  ],
  fatture: [
    {
      id: 'fat-1',
      numero: '0123/2026',
      clienteId: 'cli-1',
      data: '2026-07-01',
      stato: 'pagata',
      righe: [{ id: 'r', descrizione: 'Sostituzione display', quantita: 1, prezzoUnitario: 150 }],
      iva: 22,
    },
  ],
  magazzino: [
    {
      id: 'art-1',
      codice: 'BATTIPH',
      nome: 'Batteria iPhone',
      categoria: 'Ricambi',
      fornitore: 'Mobile Parts Italia',
      quantita: 12,
      scorta_minima: 4,
      prezzoAcquisto: 18,
      prezzoVendita: 45,
    },
  ],
  ordini: [
    {
      id: 'ord-1',
      numero: 'O26-0021',
      fornitore: 'Esprinet',
      data: '2026-07-01',
      stato: 'inviato',
      righe: [{ id: 'r', descrizione: 'SSD NVMe', quantita: 8, prezzoUnitario: 58 }],
    },
  ],
  scadenze: [],
  movimenti: [],
  impianti: [
    {
      id: 'imp-1',
      nome: 'Rete uffici',
      clienteId: 'cli-2',
      tipologia: 'Rete LAN',
      dataInstallazione: '2026-01-01',
      stato: 'attivo',
    },
  ],
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
}

const gruppiDi = (query: string) =>
  new Set(cercaOvunque(ARCHIVIO, query).map((r) => r.gruppo))

describe('cercaOvunque', () => {
  it('non cerca sotto i due caratteri', () => {
    expect(cercaOvunque(ARCHIVIO, 'a')).toEqual([])
    expect(cercaOvunque(ARCHIVIO, '')).toEqual([])
  })

  it('trova il cliente e i suoi documenti da un solo cognome', () => {
    const gruppi = gruppiDi('Perrucci')
    expect(gruppi).toContain('Clienti')
    // La riparazione va trovata anche cercando il nome del cliente, non solo
    // il modello del dispositivo.
    expect(gruppi).toContain('Riparazioni')
    expect(gruppi).toContain('Fatture')
  })

  it('copre anche magazzino, ordini e impianti', () => {
    expect(gruppiDi('Batteria')).toContain('Magazzino')
    expect(gruppiDi('Esprinet')).toContain('Ordini')
    expect(gruppiDi('Rete uffici')).toContain('Impianti')
    expect(gruppiDi('Stampante')).toContain('Preventivi')
  })

  it('trova un numero di telefono scritto con spaziatura diversa', () => {
    expect(gruppiDi('3331234567')).toContain('Clienti')
  })

  it('trova per partita IVA e per IMEI', () => {
    expect(gruppiDi('01234567890')).toContain('Clienti')
    expect(gruppiDi('352099114587632')).toContain('Riparazioni')
  })

  it('ignora maiuscole e accenti', () => {
    expect(gruppiDi('farmacìa')).toContain('Clienti')
    expect(gruppiDi('APPLE')).toContain('Riparazioni')
  })

  it('porta a un percorso apribile', () => {
    const risultato = cercaOvunque(ARCHIVIO, 'iPhone 13')[0]
    expect(risultato.percorso).toBe('/riparazioni/rip-1')
  })

  it('non restituisce nulla per un termine assente', () => {
    expect(cercaOvunque(ARCHIVIO, 'zzzzz')).toEqual([])
  })
})

describe('perGruppo', () => {
  it('mantiene l’ordine di rilevanza e salta i gruppi vuoti', () => {
    const gruppi = perGruppo(cercaOvunque(ARCHIVIO, 'Perrucci')).map(([nome]) => nome)
    expect(gruppi[0]).toBe('Riparazioni')
    expect(gruppi).not.toContain('Magazzino')
  })
})

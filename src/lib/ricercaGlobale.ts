/**
 * Ricerca trasversale a tutto l'archivio.
 *
 * Cercando «Rossi» o una partita IVA l'operatore si aspetta di trovare tutto
 * ciò che lo riguarda, non solo le due collezioni storicamente indicizzate.
 */

import { totaleFattura, totalePreventivo } from './calcoli'
import { formatEuro } from './format'
import type { DatabaseGestionale, TipoDispositivo } from '@/types'

export type GruppoRisultati =
  | 'Riparazioni'
  | 'Clienti'
  | 'Fatture'
  | 'Preventivi'
  | 'Magazzino'
  | 'Ordini'
  | 'Impianti'

export interface RisultatoRicerca {
  id: string
  gruppo: GruppoRisultati
  titolo: string
  dettaglio: string
  percorso: string
  /** Presente solo per le riparazioni, per mostrare l'icona del dispositivo. */
  tipoDispositivo?: TipoDispositivo
}

/** Normalizza per un confronto tollerante ad accenti, spazi e maiuscole. */
function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const LIMITE_PER_GRUPPO = 4

export function cercaOvunque(db: DatabaseGestionale, query: string): RisultatoRicerca[] {
  const termine = normalizza(query)
  if (termine.length < 2) return []

  // I numeri di telefono si scrivono con spazi e prefissi diversi da come
  // sono registrati: si confronta anche la sola sequenza di cifre.
  const cifre = query.replace(/\D/g, '')
  const corrisponde = (campi: Array<string | undefined>) => {
    const testo = normalizza(campi.filter(Boolean).join(' '))
    if (testo.includes(termine)) return true
    return cifre.length >= 3 && testo.replace(/\D/g, '').includes(cifre)
  }

  const nomiClienti = new Map(db.clienti.map((cliente) => [cliente.id, cliente.nome]))
  const risultati: RisultatoRicerca[] = []

  for (const r of db.riparazioni) {
    if (risultati.filter((v) => v.gruppo === 'Riparazioni').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([r.codice, r.marca, r.modello, r.imei, r.difettoSegnalato, nomiClienti.get(r.clienteId)])) {
      continue
    }
    risultati.push({
      id: r.id,
      gruppo: 'Riparazioni',
      titolo: `${r.marca} ${r.modello}`,
      dettaglio: `${r.codice} · ${nomiClienti.get(r.clienteId) ?? 'cliente rimosso'}`,
      percorso: `/riparazioni/${r.id}`,
      tipoDispositivo: r.tipoDispositivo,
    })
  }

  for (const c of db.clienti) {
    if (risultati.filter((v) => v.gruppo === 'Clienti').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([c.nome, c.telefono, c.email, c.citta, c.partitaIva, c.codiceFiscale])) continue
    risultati.push({
      id: c.id,
      gruppo: 'Clienti',
      titolo: c.nome,
      dettaglio: [c.telefono, c.citta].filter(Boolean).join(' · '),
      percorso: `/clienti/${c.id}`,
    })
  }

  for (const f of db.fatture) {
    if (risultati.filter((v) => v.gruppo === 'Fatture').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([f.numero, nomiClienti.get(f.clienteId), ...f.righe.map((r) => r.descrizione)])) {
      continue
    }
    risultati.push({
      id: f.id,
      gruppo: 'Fatture',
      titolo: `Fattura ${f.numero}`,
      dettaglio: `${nomiClienti.get(f.clienteId) ?? '—'} · ${formatEuro(totaleFattura(f))}`,
      percorso: `/fatture/${f.id}`,
    })
  }

  for (const p of db.preventivi) {
    if (risultati.filter((v) => v.gruppo === 'Preventivi').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([p.numero, nomiClienti.get(p.clienteId), ...p.righe.map((r) => r.descrizione)])) {
      continue
    }
    risultati.push({
      id: p.id,
      gruppo: 'Preventivi',
      titolo: `Preventivo ${p.numero}`,
      dettaglio: `${nomiClienti.get(p.clienteId) ?? '—'} · ${formatEuro(totalePreventivo(p))}`,
      percorso: `/preventivi/${p.id}`,
    })
  }

  for (const a of db.magazzino) {
    if (risultati.filter((v) => v.gruppo === 'Magazzino').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([a.codice, a.nome, a.categoria, a.fornitore, a.ubicazione])) continue
    risultati.push({
      id: a.id,
      gruppo: 'Magazzino',
      titolo: a.nome,
      dettaglio: `${a.codice} · ${a.quantita} pz · ${formatEuro(a.prezzoVendita)}`,
      percorso: '/magazzino',
    })
  }

  for (const o of db.ordini) {
    if (risultati.filter((v) => v.gruppo === 'Ordini').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([o.numero, o.fornitore, ...o.righe.map((r) => r.descrizione)])) continue
    risultati.push({
      id: o.id,
      gruppo: 'Ordini',
      titolo: `Ordine ${o.numero}`,
      dettaglio: o.fornitore,
      percorso: '/ordini',
    })
  }

  for (const i of db.impianti) {
    if (risultati.filter((v) => v.gruppo === 'Impianti').length >= LIMITE_PER_GRUPPO) break
    if (!corrisponde([i.nome, i.tipologia, i.indirizzo, nomiClienti.get(i.clienteId)])) continue
    risultati.push({
      id: i.id,
      gruppo: 'Impianti',
      titolo: i.nome,
      dettaglio: `${i.tipologia} · ${nomiClienti.get(i.clienteId) ?? '—'}`,
      percorso: '/impianti',
    })
  }

  return risultati
}

/** Raggruppa mantenendo l'ordine di rilevanza delle sezioni. */
export function perGruppo(risultati: RisultatoRicerca[]): Array<[GruppoRisultati, RisultatoRicerca[]]> {
  const ordine: GruppoRisultati[] = [
    'Riparazioni',
    'Clienti',
    'Fatture',
    'Preventivi',
    'Magazzino',
    'Ordini',
    'Impianti',
  ]
  return ordine
    .map((gruppo) => [gruppo, risultati.filter((r) => r.gruppo === gruppo)] as const)
    .filter(([, voci]) => voci.length > 0)
    .map(([gruppo, voci]) => [gruppo, [...voci]])
}

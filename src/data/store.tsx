import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { creaDatabaseDimostrativo, creaDatabaseIniziale } from './seed'
import { validaArchivio } from '@/lib/validaArchivio'
import { FORMATO_ORDINE, componiNumero, prossimoProgressivo } from '@/lib/documenti'
import type {
  ArticoloMagazzino,
  Azienda,
  CausaleMovimento,
  Cliente,
  DatabaseGestionale,
  Fattura,
  Impianto,
  MovimentoMagazzino,
  OrdineFornitore,
  Preventivo,
  Riparazione,
  Scadenza,
} from '@/types'

const CHIAVE_STORAGE = 'ioriparo:db:v1'

/**
 * Tetto al registro dei movimenti: è la collezione che cresce più in fretta e
 * l'archivio sta tutto in una chiave di `localStorage`.
 */
const MAX_MOVIMENTI = 2000

export interface RichiestaMovimento {
  articoloId: string
  delta: number
  causale: CausaleMovimento
  riferimentoId?: string
  riferimento?: string
}

/** Genera un identificativo locale (nessun backend: basta unicità in sessione). */
export function nuovoId(prefisso: string): string {
  return `${prefisso}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

interface CaricamentoArchivio {
  db: DatabaseGestionale
  avvisi: string[]
}

function caricaDatabase(): CaricamentoArchivio {
  const iniziale = creaDatabaseIniziale()
  if (typeof window === 'undefined') return { db: iniziale, avvisi: [] }

  let grezzo: string | null = null
  try {
    grezzo = window.localStorage.getItem(CHIAVE_STORAGE)
  } catch {
    return { db: iniziale, avvisi: [] }
  }
  if (!grezzo) return { db: iniziale, avvisi: [] }

  try {
    // La validazione qui è ciò che impedisce a un archivio corrotto di
    // rendere l'applicazione inutilizzabile a ogni riavvio.
    const { db, avvisi } = validaArchivio(JSON.parse(grezzo), iniziale)
    return { db, avvisi }
  } catch {
    return {
      db: iniziale,
      avvisi: [
        'L’archivio salvato nel browser non era leggibile ed è stato azzerato. Se hai un backup, importalo da Backup / Esportazioni.',
      ],
    }
  }
}

interface ContestoGestionale {
  db: DatabaseGestionale

  aggiungiCliente: (cliente: Omit<Cliente, 'id' | 'creatoIl'>) => Cliente
  aggiornaCliente: (id: string, modifiche: Partial<Cliente>) => void
  eliminaCliente: (id: string) => void

  aggiungiRiparazione: (
    riparazione: Omit<Riparazione, 'id' | 'codice'> & { codice?: string },
  ) => Riparazione
  aggiornaRiparazione: (id: string, modifiche: Partial<Riparazione>) => void
  eliminaRiparazione: (id: string) => void

  aggiungiPreventivo: (
    preventivo: Omit<Preventivo, 'id' | 'numero'> & { numero?: string },
  ) => Preventivo
  aggiornaPreventivo: (id: string, modifiche: Partial<Preventivo>) => void
  eliminaPreventivo: (id: string) => void

  aggiungiFattura: (fattura: Omit<Fattura, 'id' | 'numero'> & { numero?: string }) => Fattura
  aggiornaFattura: (id: string, modifiche: Partial<Fattura>) => void
  eliminaFattura: (id: string) => void

  /** Prossimo numero disponibile della serie fatture, es. `0007/2026`. */
  prossimoNumeroFattura: () => string
  /** Prossimo numero disponibile della serie preventivi, es. `P2026-0007`. */
  prossimoNumeroPreventivo: () => string

  aggiungiArticolo: (articolo: Omit<ArticoloMagazzino, 'id'>) => ArticoloMagazzino
  aggiornaArticolo: (id: string, modifiche: Partial<ArticoloMagazzino>) => void
  eliminaArticolo: (id: string) => void
  /**
   * Somma `delta` alla giacenza di più articoli in un'unica transazione e
   * registra i movimenti nel registro.
   *
   * Va usata al posto di `aggiornaArticolo` per ogni variazione di giacenza:
   * più righe possono toccare lo stesso articolo, e una sequenza di
   * `aggiornaArticolo` leggerebbe tutte lo stesso valore iniziale.
   */
  muoviGiacenze: (movimenti: RichiestaMovimento[]) => void
  /** Movimenti di un articolo, dal più recente. */
  movimentiArticolo: (articoloId: string) => MovimentoMagazzino[]

  aggiungiOrdine: (
    ordine: Omit<OrdineFornitore, 'id' | 'numero'> & { numero?: string },
  ) => OrdineFornitore
  aggiornaOrdine: (id: string, modifiche: Partial<OrdineFornitore>) => void
  eliminaOrdine: (id: string) => void
  prossimoNumeroOrdine: () => string

  aggiungiScadenza: (scadenza: Omit<Scadenza, 'id'>) => Scadenza
  aggiornaScadenza: (id: string, modifiche: Partial<Scadenza>) => void
  eliminaScadenza: (id: string) => void

  aggiungiImpianto: (impianto: Omit<Impianto, 'id'>) => Impianto
  aggiornaImpianto: (id: string, modifiche: Partial<Impianto>) => void
  eliminaImpianto: (id: string) => void
  aggiornaAzienda: (modifiche: Partial<Azienda>) => void

  /** Svuota l'archivio di questo dispositivo. */
  svuotaArchivio: () => void
  /** Carica i dati di esempio, per provare l'applicazione. */
  caricaDatiDimostrativi: () => void
  /** Sostituisce l'intero archivio (import di un backup già validato). */
  importaDatabase: (db: DatabaseGestionale) => void

  clientePerId: (id: string) => Cliente | undefined
  /** Prossimo codice riparazione disponibile, es. `#24-0025`. */
  prossimoCodice: () => string

  /**
   * Errore di persistenza (spazio esaurito, storage non disponibile).
   * Finché è valorizzato le modifiche vivono solo in memoria.
   */
  erroreArchivio: string | null
  /** Correzioni applicate all'archivio in fase di caricamento. */
  avvisiArchivio: string[]
  ignoraAvvisiArchivio: () => void
}

const Contesto = createContext<ContestoGestionale | null>(null)

export function GestionaleProvider({ children }: { children: ReactNode }) {
  const [caricamento] = useState(caricaDatabase)
  const [db, setDb] = useState<DatabaseGestionale>(caricamento.db)
  const [erroreArchivio, setErroreArchivio] = useState<string | null>(null)
  const [avvisiArchivio, setAvvisiArchivio] = useState<string[]>(caricamento.avvisi)
  // Il primo salvataggio riscriverebbe l'archivio con i dati appena caricati.
  const primoRender = useRef(true)

  useEffect(() => {
    if (primoRender.current) {
      primoRender.current = false
      return
    }
    try {
      window.localStorage.setItem(CHIAVE_STORAGE, JSON.stringify(db))
      setErroreArchivio(null)
    } catch (errore) {
      // Silenziare questo errore significherebbe far lavorare l'utente su dati
      // che spariscono al ricaricamento della pagina: va sempre segnalato.
      const spazioEsaurito =
        errore instanceof DOMException &&
        (errore.name === 'QuotaExceededError' || errore.code === 22)
      setErroreArchivio(
        spazioEsaurito
          ? 'Spazio di archiviazione esaurito: le ultime modifiche non sono state salvate e andranno perse ricaricando la pagina. Esporta un backup e libera spazio eliminando le foto delle riparazioni più vecchie.'
          : 'Non è stato possibile salvare nel browser: le ultime modifiche restano solo in memoria.',
      )
    }
  }, [db])

  /** Applica una modifica parziale all'elemento con `id` di una collezione. */
  const aggiornaIn = useCallback(
    <C extends keyof DatabaseGestionale, T extends { id: string }>(
      collezione: C,
      id: string,
      modifiche: Partial<T>,
    ) => {
      setDb((precedente) => ({
        ...precedente,
        [collezione]: (precedente[collezione] as unknown as T[]).map((voce) =>
          voce.id === id ? { ...voce, ...modifiche } : voce,
        ),
      }))
    },
    [],
  )

  const eliminaDa = useCallback(
    <C extends keyof DatabaseGestionale>(collezione: C, id: string) => {
      setDb((precedente) => ({
        ...precedente,
        [collezione]: (precedente[collezione] as unknown as { id: string }[]).filter(
          (voce) => voce.id !== id,
        ),
      }))
    },
    [],
  )

  const annoCorrente = new Date().getFullYear()

  const prossimoNumeroFattura = useCallback(
    () =>
      componiNumero(
        db.azienda.formatoFattura,
        prossimoProgressivo(
          db.fatture.map((f) => f.numero),
          db.azienda.formatoFattura,
          annoCorrente,
        ),
        annoCorrente,
      ),
    [db.fatture, db.azienda.formatoFattura, annoCorrente],
  )

  const prossimoNumeroPreventivo = useCallback(
    () =>
      componiNumero(
        db.azienda.formatoPreventivo,
        prossimoProgressivo(
          db.preventivi.map((p) => p.numero),
          db.azienda.formatoPreventivo,
          annoCorrente,
        ),
        annoCorrente,
      ),
    [db.preventivi, db.azienda.formatoPreventivo, annoCorrente],
  )

  const prossimoNumeroOrdine = useCallback(
    () =>
      componiNumero(
        FORMATO_ORDINE,
        prossimoProgressivo(
          db.ordini.map((o) => o.numero),
          FORMATO_ORDINE,
          annoCorrente,
        ),
        annoCorrente,
      ),
    [db.ordini, annoCorrente],
  )

  const prossimoCodice = useCallback(() => {
    const progressivi = db.riparazioni
      .map((r) => Number.parseInt(r.codice.split('-')[1] ?? '0', 10))
      .filter((n) => !Number.isNaN(n))
    const prossimo = (progressivi.length ? Math.max(...progressivi) : 0) + 1
    return `${db.azienda.prefissoCodice}${String(prossimo).padStart(4, '0')}`
  }, [db.riparazioni, db.azienda.prefissoCodice])

  const valore = useMemo<ContestoGestionale>(
    () => ({
      db,

      aggiungiCliente: (cliente) => {
        const nuovo: Cliente = {
          ...cliente,
          id: nuovoId('cli'),
          creatoIl: new Date().toISOString().slice(0, 10),
        }
        setDb((p) => ({ ...p, clienti: [nuovo, ...p.clienti] }))
        return nuovo
      },
      aggiornaCliente: (id, modifiche) => aggiornaIn('clienti', id, modifiche),
      eliminaCliente: (id) => eliminaDa('clienti', id),

      aggiungiRiparazione: (riparazione) => {
        const nuova: Riparazione = {
          ...riparazione,
          id: nuovoId('rip'),
          codice: riparazione.codice ?? prossimoCodice(),
          storico: [
            {
              id: nuovoId('evt'),
              istante: new Date().toISOString(),
              a: riparazione.stato,
              nota: 'Accettazione registrata',
            },
          ],
        }
        setDb((p) => ({ ...p, riparazioni: [nuova, ...p.riparazioni] }))
        return nuova
      },
      /**
       * Il passaggio di stato viene annotato qui e non nelle pagine: così
       * ogni punto dell'applicazione che cambia lo stato alimenta la
       * cronologia senza doversene ricordare.
       */
      aggiornaRiparazione: (id, modifiche) => {
        const evento = {
          id: nuovoId('evt'),
          istante: new Date().toISOString(),
        }
        setDb((precedente) => ({
          ...precedente,
          riparazioni: precedente.riparazioni.map((voce) => {
            if (voce.id !== id) return voce
            const aggiornata = { ...voce, ...modifiche }
            if (modifiche.stato === undefined || modifiche.stato === voce.stato) return aggiornata
            return {
              ...aggiornata,
              storico: [...(voce.storico ?? []), { ...evento, da: voce.stato, a: modifiche.stato }],
            }
          }),
        }))
      },
      eliminaRiparazione: (id) => eliminaDa('riparazioni', id),

      aggiungiPreventivo: (preventivo) => {
        const nuovo: Preventivo = {
          ...preventivo,
          id: nuovoId('prv'),
          numero: preventivo.numero ?? prossimoNumeroPreventivo(),
        }
        setDb((p) => ({ ...p, preventivi: [nuovo, ...p.preventivi] }))
        return nuovo
      },
      aggiornaPreventivo: (id, modifiche) => aggiornaIn('preventivi', id, modifiche),
      eliminaPreventivo: (id) => eliminaDa('preventivi', id),

      aggiungiFattura: (fattura) => {
        const nuova: Fattura = {
          ...fattura,
          id: nuovoId('fat'),
          numero: fattura.numero ?? prossimoNumeroFattura(),
        }
        setDb((p) => ({ ...p, fatture: [nuova, ...p.fatture] }))
        return nuova
      },
      aggiornaFattura: (id, modifiche) => aggiornaIn('fatture', id, modifiche),
      eliminaFattura: (id) => eliminaDa('fatture', id),

      prossimoNumeroFattura,
      prossimoNumeroPreventivo,

      aggiungiArticolo: (articolo) => {
        const nuovo: ArticoloMagazzino = { ...articolo, id: nuovoId('art') }
        setDb((p) => ({ ...p, magazzino: [nuovo, ...p.magazzino] }))
        return nuovo
      },
      aggiornaArticolo: (id, modifiche) => aggiornaIn('magazzino', id, modifiche),
      eliminaArticolo: (id) => eliminaDa('magazzino', id),
      muoviGiacenze: (richieste) => {
        if (richieste.length === 0) return
        // Identificativi e istante si calcolano fuori dall'aggiornamento, che
        // React può rieseguire: devono restare gli stessi a ogni tentativo.
        const istante = new Date().toISOString()
        const preparate = richieste.map((richiesta) => ({ ...richiesta, id: nuovoId('mov') }))

        setDb((p) => {
          // Più righe possono riguardare lo stesso articolo: si sommano prima,
          // altrimenti l'ultima scrittura sovrascriverebbe le precedenti.
          const somme = new Map<string, number>()
          for (const movimento of preparate) {
            somme.set(movimento.articoloId, (somme.get(movimento.articoloId) ?? 0) + movimento.delta)
          }

          const giacenzeFinali = new Map<string, number>()
          const magazzino = p.magazzino.map((articolo) => {
            const delta = somme.get(articolo.id)
            if (delta === undefined) return articolo
            const quantita = Math.max(0, articolo.quantita + delta)
            giacenzeFinali.set(articolo.id, quantita)
            return { ...articolo, quantita }
          })

          const nuovi: MovimentoMagazzino[] = preparate
            // Un articolo eliminato non ha più giacenza da registrare.
            .filter((movimento) => giacenzeFinali.has(movimento.articoloId))
            .map((movimento) => ({
              id: movimento.id,
              articoloId: movimento.articoloId,
              istante,
              delta: movimento.delta,
              giacenzaFinale: giacenzeFinali.get(movimento.articoloId) as number,
              causale: movimento.causale,
              riferimentoId: movimento.riferimentoId,
              riferimento: movimento.riferimento,
            }))

          return {
            ...p,
            magazzino,
            movimenti: [...nuovi, ...p.movimenti].slice(0, MAX_MOVIMENTI),
          }
        })
      },
      movimentiArticolo: (articoloId) =>
        db.movimenti
          .filter((movimento) => movimento.articoloId === articoloId)
          .sort((a, b) => b.istante.localeCompare(a.istante)),

      aggiungiOrdine: (ordine) => {
        const nuovo: OrdineFornitore = {
          ...ordine,
          id: nuovoId('ord'),
          numero: ordine.numero ?? prossimoNumeroOrdine(),
        }
        setDb((p) => ({ ...p, ordini: [nuovo, ...p.ordini] }))
        return nuovo
      },
      aggiornaOrdine: (id, modifiche) => aggiornaIn('ordini', id, modifiche),
      eliminaOrdine: (id) => eliminaDa('ordini', id),
      prossimoNumeroOrdine,

      aggiungiScadenza: (scadenza) => {
        const nuova: Scadenza = { ...scadenza, id: nuovoId('sca') }
        setDb((p) => ({ ...p, scadenze: [nuova, ...p.scadenze] }))
        return nuova
      },
      aggiornaScadenza: (id, modifiche) => aggiornaIn('scadenze', id, modifiche),
      eliminaScadenza: (id) => eliminaDa('scadenze', id),

      aggiungiImpianto: (impianto) => {
        const nuovo: Impianto = { ...impianto, id: nuovoId('imp') }
        setDb((p) => ({ ...p, impianti: [nuovo, ...p.impianti] }))
        return nuovo
      },
      aggiornaImpianto: (id, modifiche) => aggiornaIn('impianti', id, modifiche),
      eliminaImpianto: (id) => eliminaDa('impianti', id),
      aggiornaAzienda: (modifiche) =>
        setDb((p) => ({ ...p, azienda: { ...p.azienda, ...modifiche } })),

      svuotaArchivio: () => {
        try {
          window.localStorage.removeItem(CHIAVE_STORAGE)
        } catch {
          // Storage non disponibile: si prosegue comunque in memoria.
        }
        setAvvisiArchivio([])
        setErroreArchivio(null)
        setDb(creaDatabaseIniziale())
      },
      caricaDatiDimostrativi: () => {
        setAvvisiArchivio([])
        setErroreArchivio(null)
        setDb(creaDatabaseDimostrativo())
      },
      importaDatabase: (nuovoDb) => {
        setErroreArchivio(null)
        setDb(nuovoDb)
      },

      clientePerId: (id) => db.clienti.find((c) => c.id === id),
      prossimoCodice,

      erroreArchivio,
      avvisiArchivio,
      ignoraAvvisiArchivio: () => setAvvisiArchivio([]),
    }),
    [
      db,
      aggiornaIn,
      eliminaDa,
      prossimoCodice,
      prossimoNumeroFattura,
      prossimoNumeroPreventivo,
      prossimoNumeroOrdine,
      erroreArchivio,
      avvisiArchivio,
    ],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useGestionale(): ContestoGestionale {
  const contesto = useContext(Contesto)
  if (!contesto) {
    throw new Error('useGestionale deve essere usato dentro <GestionaleProvider>')
  }
  return contesto
}

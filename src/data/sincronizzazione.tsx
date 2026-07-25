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
import { useGestionale } from './store'
import {
  accedi as accediAlServer,
  applica,
  calcolaModifiche,
  ErroreServer,
  leggiConfigurazione,
  salvaConfigurazione,
  scomponi,
  sessioneAttiva,
  sincronizza as inviaSincronizzazione,
  verificaServer,
  type ConfigurazioneServer,
  type RecordRemoto,
} from '@/lib/sincronizzazione'
import type { DatabaseGestionale } from '@/types'

/** Ogni quanto riallinearsi quando l'operatore non fa nulla. */
const INTERVALLO_MS = 60_000
/** Attesa dopo una modifica prima di inviarla, per non chiamare a ogni tasto. */
const RITARDO_MODIFICHE_MS = 3_000

const CHIAVE_CURSORE = 'ioriparo:sync:cursore:v1'

export type StatoSincronizzazione =
  | 'non_configurato'
  | 'disconnesso'
  | 'in_corso'
  | 'allineato'
  | 'offline'
  | 'errore'

interface ContestoSincronizzazione {
  stato: StatoSincronizzazione
  configurazione: ConfigurazioneServer | null
  /** Numero di record in attesa di essere inviati. */
  daInviare: number
  ultimoAllineamento: number | null
  messaggio: string
  /** Record scartati perché modificati nel frattempo da un'altra postazione. */
  conflitti: number

  verifica: (indirizzo: string) => Promise<{ configurato: boolean }>
  collega: (indirizzo: string, password: string) => Promise<void>
  scollega: () => void
  allineaAdesso: () => Promise<void>
}

const Contesto = createContext<ContestoSincronizzazione | null>(null)

function leggiCursore(): number {
  const grezzo = Number(window.localStorage.getItem(CHIAVE_CURSORE) ?? '0')
  return Number.isFinite(grezzo) ? grezzo : 0
}

function scriviCursore(valore: number) {
  try {
    window.localStorage.setItem(CHIAVE_CURSORE, String(valore))
  } catch {
    // Senza cursore si riparte da capo: più traffico, nessun dato perso.
  }
}

/** Nome della postazione, per capire dai log chi ha scritto cosa. */
function nomePostazione(): string {
  return `${navigator.platform || 'postazione'} · ${navigator.language}`
}

export function SincronizzazioneProvider({ children }: { children: ReactNode }) {
  const { db, importaDatabase } = useGestionale()

  const [configurazione, setConfigurazione] = useState<ConfigurazioneServer | null>(
    () => leggiConfigurazione(),
  )
  const [stato, setStato] = useState<StatoSincronizzazione>('non_configurato')
  const [messaggio, setMessaggio] = useState('')
  const [conflitti, setConflitti] = useState(0)
  const [ultimoAllineamento, setUltimoAllineamento] = useState<number | null>(null)

  /** Archivio com'era all'ultimo allineamento riuscito: base del confronto. */
  const allineato = useRef<DatabaseGestionale | null>(null)
  /** Vero mentre si applicano i record del server, per non rispedirli subito. */
  const inApplicazione = useRef(false)
  const inCorso = useRef(false)
  const dbRef = useRef(db)
  dbRef.current = db

  const collegato = sessioneAttiva(configurazione)

  const daInviare = useMemo(() => {
    if (!collegato) return 0
    if (!allineato.current) return scomponi(db).length
    return calcolaModifiche(allineato.current, db).length
  }, [db, collegato])

  const aggiornaConfigurazione = useCallback((nuova: ConfigurazioneServer | null) => {
    setConfigurazione(nuova)
    salvaConfigurazione(nuova)
  }, [])

  const allinea = useCallback(async () => {
    const attuale = configurazione
    if (!attuale || !sessioneAttiva(attuale) || inCorso.current) return

    inCorso.current = true
    setStato('in_corso')

    try {
      const partenza = dbRef.current
      const cursore = leggiCursore()
      // Al primo allineamento si invia tutto: il server potrebbe essere vuoto.
      const modifiche = allineato.current
        ? calcolaModifiche(allineato.current, partenza)
        : scomponi(partenza)

      const esito = await inviaSincronizzazione({
        configurazione: attuale,
        da: cursore,
        daInviare: modifiche,
        origine: nomePostazione(),
      })

      // I record accettati non vanno più rispediti; quelli rifiutati restano
      // fuori dalla base, così la prossima passata li riproporrà.
      const rifiutati = new Set(esito.rifiutati.map((v) => `${v.collezione} ${v.id}`))
      const daAdottare: RecordRemoto[] = esito.record
      const nuovoDb = applica(partenza, daAdottare)

      inApplicazione.current = true
      if (nuovoDb !== partenza) importaDatabase(nuovoDb)

      const base = applica(partenza, daAdottare)
      // La base del confronto include le modifiche accettate dal server.
      allineato.current = {
        ...base,
        ...Object.fromEntries(
          (['clienti', 'riparazioni', 'preventivi', 'fatture', 'magazzino', 'ordini', 'scadenze', 'impianti', 'movimenti'] as const).map(
            (collezione) => [
              collezione,
              (base[collezione] as Array<{ id: string }>).filter(
                (voce) => !rifiutati.has(`${collezione} ${voce.id}`),
              ),
            ],
          ),
        ),
      } as DatabaseGestionale

      scriviCursore(esito.istante)
      setUltimoAllineamento(esito.istante)
      setConflitti(esito.rifiutati.length)
      setMessaggio(
        esito.rifiutati.length > 0
          ? `${esito.rifiutati.length} modifiche non applicate: erano già state cambiate da un’altra postazione.`
          : '',
      )
      setStato('allineato')
    } catch (errore) {
      if (errore instanceof ErroreServer && errore.nonAutorizzato) {
        aggiornaConfigurazione({ ...attuale, token: undefined, scadenzaToken: undefined })
        setStato('disconnesso')
        setMessaggio('Sessione scaduta: inserisci di nuovo la password del negozio.')
      } else {
        setStato('offline')
        setMessaggio(
          errore instanceof Error ? errore.message : 'Sincronizzazione non riuscita.',
        )
      }
    } finally {
      inCorso.current = false
      // Il rilascio avviene dopo il commit di React, così le modifiche appena
      // applicate non vengono scambiate per lavoro locale da rispedire.
      setTimeout(() => {
        inApplicazione.current = false
      }, 0)
    }
  }, [configurazione, importaDatabase, aggiornaConfigurazione])

  // Allineamento all'avvio e a intervalli regolari.
  useEffect(() => {
    if (!collegato) {
      setStato(configurazione ? 'disconnesso' : 'non_configurato')
      return
    }
    void allinea()
    const timer = window.setInterval(() => void allinea(), INTERVALLO_MS)
    return () => window.clearInterval(timer)
  }, [collegato, configurazione, allinea])

  // Invio ravvicinato dopo una modifica locale, così il collega la vede subito.
  useEffect(() => {
    if (!collegato || inApplicazione.current || !allineato.current) return
    if (calcolaModifiche(allineato.current, db).length === 0) return
    const timer = window.setTimeout(() => void allinea(), RITARDO_MODIFICHE_MS)
    return () => window.clearTimeout(timer)
  }, [db, collegato, allinea])

  const valore = useMemo<ContestoSincronizzazione>(
    () => ({
      stato,
      configurazione,
      daInviare,
      ultimoAllineamento,
      messaggio,
      conflitti,

      verifica: (indirizzo) => verificaServer(indirizzo),
      collega: async (indirizzo, password) => {
        const nuova = await accediAlServer(indirizzo, password)
        // Cambiando server si riparte da zero: il cursore del precedente non
        // ha alcun significato su un archivio diverso.
        if (nuova.indirizzo !== configurazione?.indirizzo) {
          scriviCursore(0)
          allineato.current = null
        }
        aggiornaConfigurazione(nuova)
      },
      scollega: () => {
        aggiornaConfigurazione(null)
        scriviCursore(0)
        allineato.current = null
        setStato('non_configurato')
        setMessaggio('')
        setConflitti(0)
      },
      allineaAdesso: allinea,
    }),
    [
      stato,
      configurazione,
      daInviare,
      ultimoAllineamento,
      messaggio,
      conflitti,
      allinea,
      aggiornaConfigurazione,
    ],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useSincronizzazione(): ContestoSincronizzazione {
  const contesto = useContext(Contesto)
  if (!contesto) {
    throw new Error('useSincronizzazione deve essere usato dentro <SincronizzazioneProvider>')
  }
  return contesto
}

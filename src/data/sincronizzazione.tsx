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
  componiArchivio,
  scaricaArchivio,
  scomponi,
  sessioneAttiva,
  sincronizza as inviaSincronizzazione,
  verificaServer,
  type ConfigurazioneServer,
  type MetadatoAllegato,
} from '@/lib/sincronizzazione'
import { allineaAllegati } from '@/lib/allegati'
import { memorizzaPassword } from '@/lib/accesso'
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

  const [configurazione, setConfigurazione] = useState<ConfigurazioneServer | null>(() =>
    leggiConfigurazione(),
  )
  const [stato, setStato] = useState<StatoSincronizzazione>('non_configurato')
  const [messaggio, setMessaggio] = useState('')
  const [conflitti, setConflitti] = useState(0)
  const [daInviare, setDaInviare] = useState(0)
  const [ultimoAllineamento, setUltimoAllineamento] = useState<number | null>(null)

  /**
   * Archivio com'era all'ultimo allineamento riuscito: è la base del
   * confronto, e resta indietro rispetto a `db` esattamente di ciò che
   * dev'essere ancora inviato.
   */
  const allineato = useRef<DatabaseGestionale | null>(null)
  const inCorso = useRef(false)
  const dbRef = useRef(db)
  dbRef.current = db

  const collegato = sessioneAttiva(configurazione)

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
      // `partenza` è la fotografia su cui si calcola l'invio. Durante la
      // richiesta l'operatore può continuare a lavorare: quelle modifiche non
      // devono finire nella base, così la passata successiva le riconosce.
      const partenza = dbRef.current
      const cursore = leggiCursore()
      const modifiche = allineato.current
        ? calcolaModifiche(allineato.current, partenza)
        : scomponi(partenza)

      const esito = await inviaSincronizzazione({
        configurazione: attuale,
        da: cursore,
        daInviare: modifiche,
        origine: nomePostazione(),
      })

      // Si applica all'archivio corrente, non alla fotografia: altrimenti si
      // cancellerebbe ciò che è stato scritto durante la richiesta.
      const corrente = dbRef.current
      const conRemoti = applica(corrente, esito.record)
      if (conRemoti !== corrente) importaDatabase(conRemoti)

      // La base include i record accettati dal server e quelli adottati; i
      // rifiutati sono già stati rimandati dal server, quindi vi rientrano.
      allineato.current = applica(partenza, esito.record)

      scriviCursore(esito.istante)
      setUltimoAllineamento(esito.istante)
      setConflitti(esito.rifiutati.length)
      setMessaggio(
        esito.rifiutati.length > 0
          ? `${esito.rifiutati.length} modifiche non applicate: erano già state cambiate da un’altra postazione.`
          : '',
      )
      setStato('allineato')

      // Le immagini viaggiano a parte, in secondo piano: non devono far
      // aspettare l'allineamento dei dati.
      void allineaAllegati({
        configurazione: attuale,
        riparazioni: conRemoti.riparazioni,
        metadati: esito.allegati as MetadatoAllegato[],
        aggiorna: (id, modifiche) => {
          const aggiornate = dbRef.current.riparazioni.map((riparazione) =>
            riparazione.id === id ? { ...riparazione, ...modifiche } : riparazione,
          )
          importaDatabase({ ...dbRef.current, riparazioni: aggiornate })
        },
      })
    } catch (errore) {
      if (errore instanceof ErroreServer && errore.nonAutorizzato) {
        aggiornaConfigurazione({ ...attuale, token: undefined, scadenzaToken: undefined })
        setStato('disconnesso')
        setMessaggio('Sessione scaduta: inserisci di nuovo la password del negozio.')
      } else {
        setStato('offline')
        setMessaggio(errore instanceof Error ? errore.message : 'Sincronizzazione non riuscita.')
      }
    } finally {
      inCorso.current = false
    }
  }, [configurazione, importaDatabase, aggiornaConfigurazione])

  // Allineamento all'avvio e a intervalli regolari.
  useEffect(() => {
    if (!collegato) {
      setStato(configurazione ? 'disconnesso' : 'non_configurato')
      setDaInviare(0)
      return
    }
    void allinea()
    const timer = window.setInterval(() => void allinea(), INTERVALLO_MS)
    return () => window.clearInterval(timer)
  }, [collegato, configurazione, allinea])

  // Conteggio di ciò che resta da inviare e invio ravvicinato dopo una
  // modifica locale, così il collega la vede subito.
  useEffect(() => {
    if (!collegato) return
    const inSospeso = allineato.current ? calcolaModifiche(allineato.current, db).length : 0
    setDaInviare(inSospeso)
    if (inSospeso === 0) return

    const timer = window.setTimeout(() => void allinea(), RITARDO_MODIFICHE_MS)
    return () => window.clearTimeout(timer)
  }, [db, collegato, allinea, ultimoAllineamento])

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
        const cambiaServer = nuova.indirizzo !== configurazione?.indirizzo
        if (cambiaServer) {
          scriviCursore(0)
          allineato.current = null
        }

        // Se il negozio ha già i suoi dati, questa postazione li adotta invece
        // di mandare l'archivio dimostrativo con cui ogni installazione parte.
        if (cambiaServer || leggiCursore() === 0) {
          const esito = await scaricaArchivio(nuova)
          if (esito.record.length > 0) {
            const archivio = componiArchivio(esito.record, dbRef.current)
            importaDatabase(archivio)
            allineato.current = archivio
            scriviCursore(esito.istante)
            setUltimoAllineamento(esito.istante)
          }
        }

        // L'impronta serve a rientrare quando la linea è giù.
        await memorizzaPassword(password)
        aggiornaConfigurazione(nuova)
      },
      scollega: () => {
        aggiornaConfigurazione(null)
        scriviCursore(0)
        allineato.current = null
        setStato('non_configurato')
        setMessaggio('')
        setConflitti(0)
        setDaInviare(0)
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
      importaDatabase,
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

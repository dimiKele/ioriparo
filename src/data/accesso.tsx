import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { SchermataAccesso } from '@/components/accesso/SchermataAccesso'
import { useSincronizzazione } from './sincronizzazione'
import { dimenticaAccesso, impostaSoloLocale, soloLocale } from '@/lib/accesso'
import { sessioneAttiva } from '@/lib/sincronizzazione'

interface ContestoAccesso {
  /** Vero quando questa postazione lavora senza server. */
  senzaServer: boolean
  /** Richiude l'archivio e riporta alla schermata di accesso. */
  blocca: () => void
}

const Contesto = createContext<ContestoAccesso | null>(null)

/**
 * Decide se mostrare l'archivio o la schermata di accesso.
 *
 * Si entra in tre modi: una sessione col server ancora valida, la password
 * verificata sul momento, oppure la scelta esplicita di lavorare solo su
 * questo dispositivo. Il blocco è una porta davanti allo schermo, non una
 * cifratura: serve a non lasciare l'archivio in chiaro su una postazione
 * incustodita.
 */
export function PortaDiAccesso({ children }: { children: ReactNode }) {
  const { configurazione, scollega } = useSincronizzazione()

  // La sessione salvata vale come accesso già fatto: riaprire il gestionale
  // dieci volte al giorno chiedendo la password sarebbe solo un fastidio.
  const [sbloccata, setSbloccata] = useState(
    () => sessioneAttiva(configurazione) || soloLocale(),
  )

  const blocca = useCallback(() => {
    impostaSoloLocale(false)
    scollega()
    setSbloccata(false)
  }, [scollega])

  const valore = useMemo<ContestoAccesso>(
    () => ({ senzaServer: soloLocale(), blocca }),
    [blocca],
  )

  if (!sbloccata) return <SchermataAccesso onSbloccata={() => setSbloccata(true)} />

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useAccesso(): ContestoAccesso {
  const contesto = useContext(Contesto)
  if (!contesto) throw new Error('useAccesso deve essere usato dentro <PortaDiAccesso>')
  return contesto
}

/** Dimentica del tutto la postazione: password e modalità di lavoro. */
export function dimenticaPostazione() {
  dimenticaAccesso()
}

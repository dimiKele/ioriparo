import { useState, type FormEvent } from 'react'
import { KeyRound, Loader2, MonitorSmartphone, ShieldCheck, WifiOff } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Form'
import { useSincronizzazione } from '@/data/sincronizzazione'
import { haImprontaLocale, impostaSoloLocale, verificaPasswordLocale } from '@/lib/accesso'
import { ErroreServer, SERVER_PREDEFINITO } from '@/lib/sincronizzazione'

/**
 * Porta d'ingresso del gestionale.
 *
 * Chiede la password del negozio; se la linea è giù la confronta con
 * l'impronta lasciata da un accesso precedente, così un guasto alla
 * connessione non impedisce di lavorare sulla copia locale.
 */
export function SchermataAccesso({ onSbloccata }: { onSbloccata: () => void }) {
  const { configurazione, collega } = useSincronizzazione()

  const [indirizzo, setIndirizzo] = useState(
    configurazione?.indirizzo ?? SERVER_PREDEFINITO,
  )
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const [senzaRete, setSenzaRete] = useState(false)

  const puoSbloccareOffline = haImprontaLocale()

  async function entra(evento: FormEvent) {
    evento.preventDefault()
    setErrore('')
    setOccupato(true)

    try {
      await collega(indirizzo, password)
      onSbloccata()
      return
    } catch (e) {
      // Password sbagliata: inutile provare la via locale.
      if (e instanceof ErroreServer && !e.nonAutorizzato && puoSbloccareOffline) {
        if (await verificaPasswordLocale(password)) {
          setSenzaRete(true)
          onSbloccata()
          return
        }
      }
      setErrore(
        e instanceof Error ? e.message : 'Accesso non riuscito. Controlla indirizzo e password.',
      )
    } finally {
      setOccupato(false)
    }
  }

  function continuaSenzaServer() {
    impostaSoloLocale(true)
    onSbloccata()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-4 text-lg font-semibold text-ink">Accesso al gestionale</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Inserisci la password del negozio per aprire l’archivio.
          </p>
        </div>

        <form
          onSubmit={entra}
          className="mt-6 rounded-card border border-line bg-surface p-5"
          // Il modulo va inviabile anche con Invio: al banco si digita in fretta.
        >
          <div className="space-y-3">
            <Campo etichetta="Indirizzo del server">
              <Input
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="https://…"
                inputMode="url"
                autoComplete="url"
              />
            </Campo>

            <Campo etichetta="Password del negozio" obbligatorio>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
              />
            </Campo>
          </div>

          <Button
            variante="primario"
            className="mt-4 w-full"
            type="submit"
            disabled={!indirizzo.trim() || !password || occupato}
          >
            {occupato ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {occupato ? 'Verifico…' : 'Entra'}
          </Button>

          {errore && <p className="mt-3 text-[13px] text-rose-400">{errore}</p>}

          {senzaRete && (
            <p className="mt-3 flex items-start gap-2 text-[13px] text-amber-300">
              <WifiOff size={15} className="mt-0.5 shrink-0" />
              Server non raggiungibile: sei entrato con la copia locale.
            </p>
          )}

          {puoSbloccareOffline && !errore && (
            <p className="mt-3 flex items-start gap-2 text-[12px] text-ink-faint">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              Se la linea è giù puoi entrare comunque con la stessa password.
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={continuaSenzaServer}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line-soft px-3 py-2.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          <MonitorSmartphone size={15} />
          Continua solo su questo dispositivo
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          I dati resteranno in questo browser e non verranno condivisi con le altre postazioni.
        </p>
      </div>
    </div>
  )
}

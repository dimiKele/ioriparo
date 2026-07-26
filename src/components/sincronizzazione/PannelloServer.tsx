import { useState } from 'react'
import { CloudOff, RefreshCw, Server, Unplug } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Form'
import { useSincronizzazione } from '@/data/sincronizzazione'
import { SERVER_PREDEFINITO } from '@/lib/sincronizzazione'
import { formatDataOra } from '@/lib/format'

const DESCRIZIONE_STATO: Record<string, string> = {
  non_configurato: 'Nessun server collegato: i dati restano su questo dispositivo.',
  disconnesso: 'Server configurato ma sessione chiusa: inserisci la password per riprendere.',
  in_corso: 'Allineamento in corso…',
  allineato: 'Allineato con il server.',
  offline: 'Server non raggiungibile: si continua a lavorare sulla copia locale.',
  errore: 'Ultimo allineamento non riuscito.',
}

/** Collegamento della postazione al server del negozio. */
export function PannelloServer() {
  const { stato, configurazione, daInviare, ultimoAllineamento, messaggio, verifica, collega, scollega, allineaAdesso } =
    useSincronizzazione()

  const [indirizzo, setIndirizzo] = useState(configurazione?.indirizzo ?? SERVER_PREDEFINITO)
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [avviso, setAvviso] = useState('')
  const [occupato, setOccupato] = useState(false)

  async function provaIndirizzo() {
    setErrore('')
    setAvviso('')
    setOccupato(true)
    try {
      const esito = await verifica(indirizzo)
      setAvviso(
        esito.configurato
          ? 'Server raggiunto: inserisci la password del negozio.'
          : 'Server raggiunto, ma la password del negozio non è ancora stata impostata sul server.',
      )
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Verifica non riuscita.')
    } finally {
      setOccupato(false)
    }
  }

  async function entra() {
    setErrore('')
    setAvviso('')
    setOccupato(true)
    try {
      await collega(indirizzo, password)
      // La password non viene conservata: resta solo il token di sessione.
      setPassword('')
      setAvviso('Postazione collegata.')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Accesso non riuscito.')
    } finally {
      setOccupato(false)
    }
  }

  return (
    <Card>
      <CardHeader
        titolo="Server del negozio"
        sottotitolo="Condivide l’archivio fra più postazioni"
      />

      <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
        {stato === 'offline' ? (
          <CloudOff size={16} className="shrink-0 text-amber-400" />
        ) : (
          <Server size={16} className="shrink-0 text-ink-faint" />
        )}
        {DESCRIZIONE_STATO[stato] ?? ''}
      </p>

      {stato === 'allineato' && ultimoAllineamento && (
        <p className="mt-1 text-[11px] text-ink-faint">
          Ultimo allineamento: {formatDataOra(new Date(ultimoAllineamento).toISOString())}
          {daInviare > 0 && ` · ${daInviare} modifiche da inviare`}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <Campo
          etichetta="Indirizzo del server"
          aiuto="Es. https://ioriparo-api.tuo-account.workers.dev"
        >
          <Input
            value={indirizzo}
            onChange={(e) => setIndirizzo(e.target.value)}
            placeholder="https://…"
            inputMode="url"
            autoComplete="off"
          />
        </Campo>

        <Campo etichetta="Password del negozio">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Campo>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={provaIndirizzo} disabled={!indirizzo.trim() || occupato}>
          Prova l’indirizzo
        </Button>
        <Button
          variante="primario"
          onClick={entra}
          disabled={!indirizzo.trim() || !password || occupato}
        >
          Collega la postazione
        </Button>
        {configurazione && (
          <>
            <Button onClick={() => void allineaAdesso()} disabled={occupato}>
              <RefreshCw size={15} />
              Allinea adesso
            </Button>
            <Button variante="pericolo" onClick={scollega}>
              <Unplug size={15} />
              Scollega
            </Button>
          </>
        )}
      </div>

      {errore && <p className="mt-3 text-sm text-rose-400">{errore}</p>}
      {avviso && !errore && <p className="mt-3 text-sm text-emerald-400">{avviso}</p>}
      {messaggio && <p className="mt-2 text-[13px] text-amber-300">{messaggio}</p>}

      <p className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-[12px] text-ink-muted">
        Foto e firme vengono trasferite in un archivio separato e scaricate su ogni postazione la
        prima volta che servono. Il trasferimento avviene in secondo piano: se la rete è lenta i
        dati si allineano comunque subito e le immagini seguono.
      </p>
    </Card>
  )
}

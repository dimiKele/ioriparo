import { useEffect, useState } from 'react'
import { Check, RotateCcw, Save } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import { componiNumero, formatoValido } from '@/lib/documenti'
import type { Azienda } from '@/types'

export function Impostazioni() {
  useIntestazione({
    titolo: 'Impostazioni',
    sottotitolo: 'Dati aziendali e preferenze del gestionale',
  })

  const { db, aggiornaAzienda, ripristinaDemo } = useGestionale()
  const [form, setForm] = useState<Azienda>(db.azienda)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')
  const [confermaRipristino, setConfermaRipristino] = useState(false)

  // Dopo un ripristino demo o l'import di un backup il modulo deve ripartire
  // dai nuovi dati: altrimenti un salvataggio successivo li sovrascriverebbe.
  useEffect(() => setForm(db.azienda), [db.azienda])

  const anno = new Date().getFullYear()
  const anteprimaFattura = formatoValido(form.formatoFattura)
    ? componiNumero(form.formatoFattura, 1, anno)
    : 'formato non valido'
  const anteprimaPreventivo = formatoValido(form.formatoPreventivo)
    ? componiNumero(form.formatoPreventivo, 1, anno)
    : 'formato non valido'

  function salva() {
    const iva = Number(form.ivaPredefinita)
    if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
      setErrore('L’aliquota IVA deve essere compresa tra 0 e 100.')
      return
    }
    const giorni = Number(form.giorniValiditaPreventivo)
    if (!Number.isFinite(giorni) || giorni < 0) {
      setErrore('La validità dei preventivi non può essere negativa.')
      return
    }
    // `prossimoCodice` legge il progressivo dopo il trattino: senza separatore
    // ogni nuova riparazione ripartirebbe da 0001.
    if (!form.prefissoCodice.includes('-')) {
      setErrore('Il prefisso deve contenere un trattino, per esempio «#25-».')
      return
    }
    if (!formatoValido(form.formatoFattura) || !formatoValido(form.formatoPreventivo)) {
      setErrore('I formati dei documenti devono contenere il segnaposto {n}.')
      return
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrore('L’indirizzo email aziendale non è valido.')
      return
    }

    setErrore('')
    aggiornaAzienda({ ...form, ivaPredefinita: iva, giorniValiditaPreventivo: giorni })
    setSalvato(true)
    window.setTimeout(() => setSalvato(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            titolo="Dati aziendali"
            sottotitolo="Compaiono su schede di accettazione, preventivi e fatture"
          />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etichetta="Denominazione" className="sm:col-span-2">
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </Campo>
            <Campo etichetta="Claim" className="sm:col-span-2">
              <Input
                value={form.claim}
                onChange={(e) => setForm({ ...form, claim: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Indirizzo">
              <Input
                value={form.indirizzo}
                onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
              />
            </Campo>
            <Campo etichetta="CAP e città">
              <Input
                value={form.citta}
                onChange={(e) => setForm({ ...form, citta: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Telefono">
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Partita IVA" className="sm:col-span-2">
              <Input
                value={form.partitaIva}
                onChange={(e) => setForm({ ...form, partitaIva: e.target.value })}
              />
            </Campo>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titolo="Documenti" sottotitolo="Valori applicati ai nuovi documenti" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo etichetta="IVA predefinita (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.ivaPredefinita}
                  onChange={(e) =>
                    setForm({ ...form, ivaPredefinita: Number(e.target.value) })
                  }
                />
              </Campo>
              <Campo etichetta="Validità preventivi (giorni)">
                <Input
                  type="number"
                  min={0}
                  value={form.giorniValiditaPreventivo}
                  onChange={(e) =>
                    setForm({ ...form, giorniValiditaPreventivo: Number(e.target.value) })
                  }
                />
              </Campo>
              <Campo
                etichetta="Prefisso codice riparazione"
                aiuto="Deve terminare con un trattino, es. #26- → #26-0001"
                className="sm:col-span-2"
              >
                <Input
                  value={form.prefissoCodice}
                  onChange={(e) => setForm({ ...form, prefissoCodice: e.target.value })}
                />
              </Campo>

              <Campo
                etichetta="Formato numero fattura"
                aiuto={`{n} progressivo, {anno} 2026, {aa} 26 → ${anteprimaFattura}`}
              >
                <Input
                  value={form.formatoFattura}
                  onChange={(e) => setForm({ ...form, formatoFattura: e.target.value })}
                />
              </Campo>

              <Campo
                etichetta="Formato numero preventivo"
                aiuto={`{n} progressivo, {anno} 2026, {aa} 26 → ${anteprimaPreventivo}`}
              >
                <Input
                  value={form.formatoPreventivo}
                  onChange={(e) => setForm({ ...form, formatoPreventivo: e.target.value })}
                />
              </Campo>
            </div>
          </Card>

          <Card>
            <CardHeader
              titolo="Archivio locale"
              sottotitolo="I dati sono salvati nel browser di questo dispositivo"
            />
            <p className="mt-3 text-sm text-ink-muted">
              Il gestionale funziona senza server: ogni modifica resta nel browser corrente. Usa la
              sezione Backup per esportare i dati prima di cambiare dispositivo.
            </p>
            <Button
              variante="pericolo"
              className="mt-4"
              onClick={() => setConfermaRipristino(true)}
            >
              <RotateCcw size={15} />
              Ripristina dati dimostrativi
            </Button>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {errore && <span className="mr-auto text-sm text-rose-400">{errore}</span>}
        {salvato && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check size={16} />
            Impostazioni salvate
          </span>
        )}
        <Button
          onClick={() => {
            setForm(db.azienda)
            setErrore('')
          }}
        >
          Annulla modifiche
        </Button>
        <Button variante="primario" onClick={salva}>
          <Save size={15} />
          Salva impostazioni
        </Button>
      </div>

      <Modal
        aperta={confermaRipristino}
        titolo="Ripristinare i dati dimostrativi?"
        onChiudi={() => setConfermaRipristino(false)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setConfermaRipristino(false)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                ripristinaDemo()
                setConfermaRipristino(false)
              }}
            >
              <RotateCcw size={15} />
              Ripristina
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Tutte le modifiche locali (clienti, riparazioni, magazzino) verranno sostituite dai dati di
          esempio iniziali. L'operazione non è reversibile.
        </p>
      </Modal>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Campo, Checkbox, Input, Select, Textarea } from '@/components/ui/Form'
import { StatChip } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { StatoVuoto } from '@/components/ui/Tabella'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import { formatData, formatEuro, giorniAllaData, oggiISO, scadenzaRelativa } from '@/lib/format'
import { TIPI_SCADENZA } from '@/lib/stati'
import { cn } from '@/lib/cn'
import type { PrioritaScadenza, Scadenza, TipoScadenza } from '@/types'

interface DatiScadenza {
  titolo: string
  descrizione: string
  tipo: TipoScadenza
  priorita: PrioritaScadenza
  data: string
  importo: string
}

/**
 * La data va calcolata al momento dell'apertura del modulo: un valore fissato
 * all'avvio dell'applicazione proporrebbe la data di ieri a chi la tiene
 * aperta oltre la mezzanotte, come accade su una postazione da banco.
 */
function datiVuoti(): DatiScadenza {
  return {
    titolo: '',
    descrizione: '',
    tipo: 'promemoria',
    priorita: 'normale',
    data: oggiISO(),
    importo: '',
  }
}

export function Scadenze() {
  useIntestazione({
    titolo: 'Scadenze e Promemoria',
    sottotitolo: 'Pagamenti, contratti e attività da ricordare',
  })

  const { db, aggiungiScadenza, aggiornaScadenza, eliminaScadenza } = useGestionale()
  const [parametri, setParametri] = useSearchParams()

  const [filtro, setFiltro] = useState<'aperte' | 'scadute' | 'completate' | 'tutte'>('aperte')
  const [form, setForm] = useState<DatiScadenza | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [errore, setErrore] = useState('')
  const [daEliminare, setDaEliminare] = useState<Scadenza | null>(null)

  useEffect(() => {
    if (parametri.get('nuovo') === '1') {
      setForm(datiVuoti())
      setParametri({}, { replace: true })
    }
  }, [parametri, setParametri])

  const scadute = useMemo(
    () => db.scadenze.filter((s) => !s.completata && giorniAllaData(s.data) < 0),
    [db.scadenze],
  )

  const filtrate = useMemo(() => {
    const elenco = db.scadenze.filter((scadenza) => {
      if (filtro === 'tutte') return true
      if (filtro === 'completate') return scadenza.completata
      if (filtro === 'scadute') return !scadenza.completata && giorniAllaData(scadenza.data) < 0
      return !scadenza.completata
    })
    return elenco.sort((a, b) => a.data.localeCompare(b.data))
  }, [db.scadenze, filtro])

  const importoAperto = db.scadenze
    .filter((s) => !s.completata && s.importo)
    .reduce((somma, s) => somma + (s.importo ?? 0), 0)

  function apriNuovo() {
    setInModifica(null)
    setErrore('')
    setForm(datiVuoti())
  }

  function apriModifica(scadenza: Scadenza) {
    setInModifica(scadenza.id)
    setErrore('')
    setForm({
      titolo: scadenza.titolo,
      descrizione: scadenza.descrizione ?? '',
      tipo: scadenza.tipo,
      priorita: scadenza.priorita,
      data: scadenza.data,
      importo: scadenza.importo !== undefined ? String(scadenza.importo) : '',
    })
  }

  function chiudiForm() {
    setForm(null)
    setInModifica(null)
    setErrore('')
  }

  function salva() {
    if (!form) return
    if (!form.titolo.trim()) {
      setErrore('Indica un titolo per la scadenza.')
      return
    }
    if (!form.data) {
      setErrore('Indica la data di scadenza.')
      return
    }
    const importo = Number.parseFloat(form.importo.replace(',', '.'))
    if (form.importo.trim() && (!Number.isFinite(importo) || importo < 0)) {
      setErrore('L’importo non può essere negativo.')
      return
    }

    const dati = {
      titolo: form.titolo.trim(),
      descrizione: form.descrizione.trim() || undefined,
      tipo: form.tipo,
      priorita: form.priorita,
      data: form.data,
      importo: Number.isFinite(importo) ? importo : undefined,
    }

    if (inModifica) aggiornaScadenza(inModifica, dati)
    else aggiungiScadenza({ ...dati, completata: false })

    chiudiForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variante="primario" onClick={apriNuovo}>
          <Plus size={16} />
          Nuovo promemoria
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip
          etichetta="In programma"
          valore={db.scadenze.filter((s) => !s.completata && giorniAllaData(s.data) >= 0).length}
          icona={CalendarClock}
          colore="#2563eb"
          attivo={filtro === 'aperte'}
          onClick={() => setFiltro('aperte')}
        />
        <StatChip
          etichetta="Scadute"
          valore={scadute.length}
          icona={AlertTriangle}
          colore="#f43f5e"
          attivo={filtro === 'scadute'}
          onClick={() => setFiltro('scadute')}
        />
        <StatChip
          etichetta="Completate"
          valore={db.scadenze.filter((s) => s.completata).length}
          icona={CheckCircle2}
          colore="#22c55e"
          attivo={filtro === 'completate'}
          onClick={() => setFiltro('completate')}
        />
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Importo da versare
          </p>
          <p className="mt-1 text-xl font-bold text-ink">{formatEuro(importoAperto)}</p>
        </Card>
      </div>

      <Card padding={false}>
        <div className="p-5 pb-2">
          <CardHeader
            titolo={
              filtro === 'aperte'
                ? 'Scadenze aperte'
                : filtro === 'scadute'
                  ? 'Scadenze scadute'
                  : filtro === 'completate'
                    ? 'Scadenze completate'
                    : 'Tutte le scadenze'
            }
            azione={
              <Button dimensione="sm" variante="fantasma" onClick={() => setFiltro('tutte')}>
                Mostra tutte
              </Button>
            }
          />
        </div>

        {filtrate.length === 0 ? (
          <StatoVuoto
            titolo={
              db.scadenze.length === 0
                ? 'Nessuna scadenza in agenda'
                : 'Nessuna scadenza in questo filtro'
            }
            descrizione={
              db.scadenze.length === 0
                ? 'Annota tasse, rinnovi e promemoria: le manutenzioni degli impianti arrivano qui da sole.'
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtrate.map((scadenza) => (
              <VoceScadenza
                key={scadenza.id}
                scadenza={scadenza}
                onCompleta={(completata) => aggiornaScadenza(scadenza.id, { completata })}
                onModifica={() => apriModifica(scadenza)}
                onElimina={() => setDaEliminare(scadenza)}
              />
            ))}
          </ul>
        )}
      </Card>

      <Modal
        aperta={form !== null}
        titolo={inModifica ? 'Modifica promemoria' : 'Nuovo promemoria'}
        onChiudi={chiudiForm}
        piede={
          <>
            <Button onClick={chiudiForm}>Annulla</Button>
            <Button variante="primario" onClick={salva}>
              Salva promemoria
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etichetta="Titolo" obbligatorio className="sm:col-span-2">
              <Input
                value={form.titolo}
                onChange={(e) => setForm({ ...form, titolo: e.target.value })}
                autoFocus
              />
            </Campo>
            <Campo etichetta="Descrizione" className="sm:col-span-2">
              <Textarea
                value={form.descrizione}
                onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
                className="min-h-20"
              />
            </Campo>
            <Campo etichetta="Tipo">
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoScadenza })}
              >
                {Object.entries(TIPI_SCADENZA).map(([valore, config]) => (
                  <option key={valore} value={valore}>
                    {config.label}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etichetta="Priorità">
              <Select
                value={form.priorita}
                onChange={(e) =>
                  setForm({ ...form, priorita: e.target.value as PrioritaScadenza })
                }
              >
                <option value="urgente">Urgente</option>
                <option value="normale">Normale</option>
                <option value="bassa">Bassa</option>
              </Select>
            </Campo>
            <Campo etichetta="Data di scadenza">
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Importo (€)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.importo}
                onChange={(e) => setForm({ ...form, importo: e.target.value })}
              />
            </Campo>

            {errore && <p className="text-xs text-rose-400 sm:col-span-2">{errore}</p>}
          </div>
        )}
      </Modal>

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare il promemoria?"
        sottotitolo={daEliminare?.titolo}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) eliminaScadenza(daEliminare.id)
                setDaEliminare(null)
              }}
            >
              <Trash2 size={15} />
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          La scadenza viene rimossa definitivamente dall’archivio.
        </p>
      </Modal>
    </div>
  )
}

function VoceScadenza({
  scadenza,
  onCompleta,
  onModifica,
  onElimina,
}: {
  scadenza: Scadenza
  onCompleta: (completata: boolean) => void
  onModifica: () => void
  onElimina: () => void
}) {
  const tipo = TIPI_SCADENZA[scadenza.tipo]
  const giorni = giorniAllaData(scadenza.data)
  const inRitardo = !scadenza.completata && giorni < 0
  // La priorità impostata dall'operatore ha la precedenza: il conto dei giorni
  // la integra solo per le scadenze ormai imminenti.
  const urgente =
    !scadenza.completata && (scadenza.priorita === 'urgente' || (giorni >= 0 && giorni <= 2))

  return (
    // Su schermo stretto badge e comandi scendono sotto il testo: affiancati
    // lascerebbero al titolo una colonna di poche decine di pixel.
    <li className="flex flex-wrap items-start gap-3 px-5 py-4">
      <span className="pt-0.5">
        <Checkbox
          etichetta=""
          checked={scadenza.completata}
          onChange={(e) => onCompleta(e.target.checked)}
          aria-label={`Segna «${scadenza.titolo}» come completata`}
        />
      </span>

      <span
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tipo.colore}22`, color: tipo.colore }}
      >
        <CalendarClock size={16} />
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p
          className={cn(
            'text-sm font-semibold',
            scadenza.completata ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
          {scadenza.titolo}
        </p>
        {scadenza.descrizione && (
          <p className="text-xs text-ink-muted max-sm:break-words sm:truncate">
            {scadenza.descrizione}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-ink-faint">
          {tipo.label} · Scade il {formatData(scadenza.data)}
          {!scadenza.completata && ` · ${scadenzaRelativa(scadenza.data)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end">
        {scadenza.importo !== undefined && (
          <span className="text-sm font-semibold text-ink">
            {formatEuro(scadenza.importo)}
          </span>
        )}

        {scadenza.completata ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/12 text-emerald-300">
            <Check size={11} />
            Completata
          </Badge>
        ) : (
          <Badge
            className={
              inRitardo
                ? 'border-rose-500/30 bg-rose-500/12 text-rose-300'
                : urgente
                  ? 'border-amber-500/30 bg-amber-500/12 text-amber-300'
                  : 'border-blue-500/30 bg-blue-500/12 text-blue-300'
            }
          >
            {inRitardo ? 'In ritardo' : urgente ? 'Urgente' : 'Promemoria'}
          </Badge>
        )}

        <IconButton etichetta="Modifica promemoria" onClick={onModifica}>
          <Pencil size={14} />
        </IconButton>
        <IconButton etichetta="Elimina promemoria" onClick={onElimina}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </li>
  )
}

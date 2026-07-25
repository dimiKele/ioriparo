import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, MapPin, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { StatChip } from '@/components/ui/StatCard'
import { StatoVuoto } from '@/components/ui/Tabella'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import { formatData, giorniAllaData, oggiISO, scadenzaRelativa } from '@/lib/format'
import { STATI_IMPIANTO } from '@/lib/stati'
import type { Impianto, StatoImpianto } from '@/types'

interface DatiImpianto {
  nome: string
  clienteId: string
  tipologia: string
  indirizzo: string
  dataInstallazione: string
  prossimaManutenzione: string
  stato: StatoImpianto
  note: string
}

function datiVuoti(): DatiImpianto {
  return {
    nome: '',
    clienteId: '',
    tipologia: '',
    indirizzo: '',
    dataInstallazione: oggiISO(),
    prossimaManutenzione: '',
    stato: 'attivo',
    note: '',
  }
}

/** Un impianto dismesso non ha manutenzioni da fare: il countdown sarebbe rumore. */
const manutenzioneAttiva = (impianto: Impianto) =>
  impianto.stato !== 'dismesso' && Boolean(impianto.prossimaManutenzione)

export function Impianti() {
  useIntestazione({
    titolo: 'Impianti & Installazioni',
    sottotitolo: 'Reti, server e postazioni in manutenzione presso i clienti',
  })

  const {
    db,
    aggiungiImpianto,
    aggiornaImpianto,
    eliminaImpianto,
    aggiungiScadenza,
    aggiornaScadenza,
    eliminaScadenza,
  } = useGestionale()

  const [ricerca, setRicerca] = useState('')
  const [stato, setStato] = useState<StatoImpianto | 'tutti'>('tutti')
  const [modulo, setModulo] = useState<DatiImpianto | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [errore, setErrore] = useState('')
  const [daEliminare, setDaEliminare] = useState<Impianto | null>(null)

  const clienti = useMemo(
    () => new Map(db.clienti.map((cliente) => [cliente.id, cliente])),
    [db.clienti],
  )

  const filtrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    return db.impianti.filter((impianto) => {
      if (stato !== 'tutti' && impianto.stato !== stato) return false
      if (!termine) return true
      return [
        impianto.nome,
        impianto.tipologia,
        impianto.indirizzo ?? '',
        clienti.get(impianto.clienteId)?.nome ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(termine)
    })
  }, [db.impianti, clienti, ricerca, stato])

  const manutenzioniImminenti = useMemo(
    () =>
      db.impianti.filter(
        (impianto) =>
          manutenzioneAttiva(impianto) && giorniAllaData(impianto.prossimaManutenzione ?? '') <= 30,
      ).length,
    [db.impianti],
  )

  /**
   * Tiene allineato il promemoria della manutenzione programmata.
   * Senza questo aggancio la data resterebbe visibile solo qui, mentre le
   * scadenze sono ciò che l'operatore guarda ogni mattina.
   */
  function sincronizzaPromemoria(impianto: Impianto) {
    const esistente = db.scadenze.find((s) => s.impiantoId === impianto.id && !s.completata)
    const serve = manutenzioneAttiva(impianto)

    if (!serve) {
      if (esistente) eliminaScadenza(esistente.id)
      return
    }

    const cliente = clienti.get(impianto.clienteId)
    const dati = {
      titolo: `Manutenzione ${impianto.nome}`,
      descrizione: cliente ? `${impianto.tipologia} — ${cliente.nome}` : impianto.tipologia,
      tipo: 'promemoria' as const,
      priorita: 'normale' as const,
      data: impianto.prossimaManutenzione as string,
      completata: false,
      impiantoId: impianto.id,
    }

    if (esistente) aggiornaScadenza(esistente.id, dati)
    else aggiungiScadenza(dati)
  }

  function apriNuovo() {
    setInModifica(null)
    setErrore('')
    setModulo(datiVuoti())
  }

  function apriModifica(impianto: Impianto) {
    setInModifica(impianto.id)
    setErrore('')
    setModulo({
      nome: impianto.nome,
      clienteId: impianto.clienteId,
      tipologia: impianto.tipologia,
      indirizzo: impianto.indirizzo ?? '',
      dataInstallazione: impianto.dataInstallazione,
      prossimaManutenzione: impianto.prossimaManutenzione ?? '',
      stato: impianto.stato,
      note: impianto.note ?? '',
    })
  }

  function salva() {
    if (!modulo) return
    if (!modulo.nome.trim()) {
      setErrore('Indica il nome dell’impianto.')
      return
    }
    if (!modulo.clienteId) {
      setErrore('Seleziona il cliente presso cui è installato.')
      return
    }
    if (!modulo.dataInstallazione) {
      setErrore('Indica la data di installazione.')
      return
    }
    if (modulo.prossimaManutenzione && modulo.prossimaManutenzione < modulo.dataInstallazione) {
      setErrore('La manutenzione non può precedere l’installazione.')
      return
    }

    const dati = {
      nome: modulo.nome.trim(),
      clienteId: modulo.clienteId,
      tipologia: modulo.tipologia.trim() || 'Non specificata',
      indirizzo: modulo.indirizzo.trim() || undefined,
      dataInstallazione: modulo.dataInstallazione,
      prossimaManutenzione: modulo.prossimaManutenzione || undefined,
      stato: modulo.stato,
      note: modulo.note.trim() || undefined,
    }

    const impianto = inModifica
      ? ({ ...dati, id: inModifica } as Impianto)
      : aggiungiImpianto(dati)
    if (inModifica) aggiornaImpianto(inModifica, dati)
    sincronizzaPromemoria(impianto)

    setModulo(null)
    setInModifica(null)
    setErrore('')
  }

  function cambiaStato(impianto: Impianto, nuovo: StatoImpianto) {
    aggiornaImpianto(impianto.id, { stato: nuovo })
    sincronizzaPromemoria({ ...impianto, stato: nuovo })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variante="primario" onClick={apriNuovo}>
          <Plus size={16} />
          Nuovo impianto
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip
          etichetta="Tutti gli impianti"
          valore={db.impianti.length}
          icona={Wrench}
          colore="#2563eb"
          attivo={stato === 'tutti'}
          onClick={() => setStato('tutti')}
        />
        <StatChip
          etichetta="Attivi"
          valore={db.impianti.filter((i) => i.stato === 'attivo').length}
          icona={Wrench}
          colore={STATI_IMPIANTO.attivo.colore}
          attivo={stato === 'attivo'}
          onClick={() => setStato('attivo')}
        />
        <StatChip
          etichetta="Da verificare"
          valore={db.impianti.filter((i) => i.stato === 'da_verificare').length}
          icona={Wrench}
          colore={STATI_IMPIANTO.da_verificare.colore}
          attivo={stato === 'da_verificare'}
          onClick={() => setStato('da_verificare')}
        />
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Manutenzioni entro 30 giorni
          </p>
          <p className="mt-1 flex items-center gap-2 text-xl font-bold text-ink">
            <CalendarClock size={18} className="text-ink-faint" />
            {manutenzioniImminenti}
          </p>
        </Card>
      </div>

      <Card padding={false}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative sm:w-96">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
            />
            <Input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca impianto, cliente o indirizzo…"
              aria-label="Cerca impianto"
              className="pl-9"
            />
          </div>

          <Select
            value={stato}
            onChange={(e) => setStato(e.target.value as StatoImpianto | 'tutti')}
            aria-label="Filtra per stato"
            className="sm:w-52"
          >
            <option value="tutti">Tutti gli stati</option>
            {Object.entries(STATI_IMPIANTO).map(([valore, config]) => (
              <option key={valore} value={valore}>
                {config.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {filtrati.length === 0 ? (
        <Card>
          <StatoVuoto
            titolo="Nessun impianto trovato"
            azione={
              <Button variante="primario" dimensione="sm" onClick={apriNuovo}>
                <Plus size={14} />
                Nuovo impianto
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtrati.map((impianto) => {
            const cliente = clienti.get(impianto.clienteId)
            return (
              <Card key={impianto.id}>
                <CardHeader
                  titolo={impianto.nome}
                  sottotitolo={impianto.tipologia}
                  azione={
                    <span className="flex items-center gap-1.5">
                      <Badge className={STATI_IMPIANTO[impianto.stato].badge}>
                        {STATI_IMPIANTO[impianto.stato].label}
                      </Badge>
                      <IconButton
                        etichetta={`Modifica ${impianto.nome}`}
                        onClick={() => apriModifica(impianto)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        etichetta={`Elimina ${impianto.nome}`}
                        onClick={() => setDaEliminare(impianto)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </span>
                  }
                />

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <dt className="sr-only">Cliente</dt>
                    <dd className="flex items-center gap-2 text-ink">
                      <Wrench size={14} className="text-ink-faint" />
                      {cliente ? (
                        <Link
                          to={`/clienti/${cliente.id}`}
                          className="transition-colors hover:text-blue-400"
                        >
                          {cliente.nome}
                        </Link>
                      ) : (
                        '--'
                      )}
                    </dd>
                  </div>

                  {impianto.indirizzo && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Indirizzo</dt>
                      <dd className="flex items-start gap-2 text-ink-muted">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                        {impianto.indirizzo}
                      </dd>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <dt className="sr-only">Manutenzione</dt>
                    <dd className="flex items-start gap-2 text-ink-muted">
                      <CalendarClock size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                      {manutenzioneAttiva(impianto) ? (
                        <span>
                          Prossima manutenzione il {formatData(impianto.prossimaManutenzione)}
                          <span className="block text-[11px] text-ink-faint">
                            {scadenzaRelativa(impianto.prossimaManutenzione as string)}
                          </span>
                        </span>
                      ) : (
                        'Nessuna manutenzione programmata'
                      )}
                    </dd>
                  </div>
                </dl>

                {impianto.note && (
                  <p className="mt-3 rounded-lg border border-line bg-surface-2 p-2.5 text-xs text-ink-muted">
                    {impianto.note}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-[11px] text-ink-faint">
                    Installato il {formatData(impianto.dataInstallazione)}
                  </span>
                  <Select
                    value={impianto.stato}
                    onChange={(e) => cambiaStato(impianto, e.target.value as StatoImpianto)}
                    aria-label={`Stato di ${impianto.nome}`}
                    className="h-8 w-40 text-xs"
                  >
                    {Object.entries(STATI_IMPIANTO).map(([valore, config]) => (
                      <option key={valore} value={valore}>
                        {config.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        aperta={modulo !== null}
        titolo={inModifica ? 'Modifica impianto' : 'Nuovo impianto'}
        onChiudi={() => {
          setModulo(null)
          setInModifica(null)
          setErrore('')
        }}
        piede={
          <>
            <Button
              onClick={() => {
                setModulo(null)
                setInModifica(null)
                setErrore('')
              }}
            >
              Annulla
            </Button>
            <Button variante="primario" onClick={salva}>
              Salva impianto
            </Button>
          </>
        }
      >
        {modulo && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etichetta="Nome impianto" obbligatorio className="sm:col-span-2">
              <Input
                value={modulo.nome}
                onChange={(e) => setModulo({ ...modulo, nome: e.target.value })}
                placeholder="Rete uffici piano 1"
              />
            </Campo>

            <Campo etichetta="Cliente" obbligatorio>
              <Select
                value={modulo.clienteId}
                onChange={(e) => setModulo({ ...modulo, clienteId: e.target.value })}
              >
                <option value="">Seleziona…</option>
                {[...db.clienti]
                  .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
                  .map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
              </Select>
            </Campo>

            <Campo etichetta="Tipologia">
              <Input
                value={modulo.tipologia}
                onChange={(e) => setModulo({ ...modulo, tipologia: e.target.value })}
                placeholder="Rete LAN, videosorveglianza…"
              />
            </Campo>

            <Campo etichetta="Indirizzo" className="sm:col-span-2">
              <Input
                value={modulo.indirizzo}
                onChange={(e) => setModulo({ ...modulo, indirizzo: e.target.value })}
                placeholder="Via Roma 45, Altamura"
              />
            </Campo>

            <Campo etichetta="Data installazione" obbligatorio>
              <Input
                type="date"
                value={modulo.dataInstallazione}
                onChange={(e) => setModulo({ ...modulo, dataInstallazione: e.target.value })}
              />
            </Campo>

            <Campo
              etichetta="Prossima manutenzione"
              aiuto="Genera un promemoria collegato tra le scadenze"
            >
              <Input
                type="date"
                min={modulo.dataInstallazione}
                value={modulo.prossimaManutenzione}
                onChange={(e) => setModulo({ ...modulo, prossimaManutenzione: e.target.value })}
              />
            </Campo>

            <Campo etichetta="Stato">
              <Select
                value={modulo.stato}
                onChange={(e) => setModulo({ ...modulo, stato: e.target.value as StatoImpianto })}
              >
                {Object.entries(STATI_IMPIANTO).map(([valore, config]) => (
                  <option key={valore} value={valore}>
                    {config.label}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo etichetta="Note" className="sm:col-span-2">
              <Textarea
                value={modulo.note}
                onChange={(e) => setModulo({ ...modulo, note: e.target.value })}
                placeholder="Configurazione, credenziali di riferimento, contatti…"
                className="min-h-20"
              />
            </Campo>

            {errore && <p className="text-xs text-rose-400 sm:col-span-2">{errore}</p>}
          </div>
        )}
      </Modal>

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare l’impianto?"
        sottotitolo={daEliminare?.nome}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) {
                  const promemoria = db.scadenze.find((s) => s.impiantoId === daEliminare.id)
                  if (promemoria) eliminaScadenza(promemoria.id)
                  eliminaImpianto(daEliminare.id)
                }
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
          L’impianto e il relativo promemoria di manutenzione vengono rimossi dall’archivio.
        </p>
      </Modal>
    </div>
  )
}

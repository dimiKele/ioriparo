import { useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  Download,
  FileText,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Truck,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Form'
import { StatChip } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import {
  Paginazione,
  StatoVuoto,
  Tabella,
  TabellaHead,
  Td,
  Th,
  Tr,
} from '@/components/ui/Tabella'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale, nuovoId, type RichiestaMovimento } from '@/data/store'
import { useElenco } from '@/lib/useElenco'
import { totaleRighe } from '@/lib/calcoli'
import { esportaCsv, nomeFileConData, numeroCsv } from '@/lib/esporta'
import { formatData, formatEuro, oggiISO } from '@/lib/format'
import { STATI_ORDINE } from '@/lib/stati'
import type { OrdineFornitore, RigaOrdine, StatoOrdine } from '@/types'

const ORDINE: StatoOrdine[] = ['bozza', 'inviato', 'in_transito', 'ricevuto', 'annullato']

const ICONE = {
  bozza: FileText,
  inviato: Send,
  in_transito: Truck,
  ricevuto: CheckCircle2,
  annullato: Ban,
} as const

interface DatiOrdine {
  numero: string
  fornitore: string
  data: string
  consegnaPrevista: string
  righe: RigaOrdine[]
}

function rigaVuota(): RigaOrdine {
  return { id: nuovoId('rord'), descrizione: '', quantita: 1, prezzoUnitario: 0 }
}

const ricevuti = (riga: RigaOrdine) => riga.quantitaRicevuta ?? 0
const mancanti = (riga: RigaOrdine) => Math.max(0, riga.quantita - ricevuti(riga))

export function OrdiniFornitori() {
  useIntestazione({
    titolo: 'Ordini Fornitori',
    sottotitolo: 'Approvvigionamento ricambi e accessori',
  })

  const {
    db,
    aggiungiOrdine,
    aggiornaOrdine,
    eliminaOrdine,
    aggiornaArticolo,
    muoviGiacenze,
    prossimoNumeroOrdine,
  } = useGestionale()

  const [ricerca, setRicerca] = useState('')
  const [stato, setStato] = useState<StatoOrdine | 'tutti'>('tutti')
  const [dettaglio, setDettaglio] = useState<OrdineFornitore | null>(null)
  const [modulo, setModulo] = useState<DatiOrdine | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [erroreModulo, setErroreModulo] = useState('')
  const [ricezione, setRicezione] = useState<Record<string, string> | null>(null)
  const [daEliminare, setDaEliminare] = useState<OrdineFornitore | null>(null)

  const fornitori = useMemo(
    () =>
      [...new Set(db.ordini.map((o) => o.fornitore).concat(
        db.magazzino.map((a) => a.fornitore ?? '').filter(Boolean),
      ))].sort((a, b) => a.localeCompare(b, 'it')),
    [db.ordini, db.magazzino],
  )

  const conteggi = useMemo(() => {
    const mappa = Object.fromEntries(ORDINE.map((s) => [s, 0])) as Record<StatoOrdine, number>
    for (const ordine of db.ordini) {
      if (mappa[ordine.stato] !== undefined) mappa[ordine.stato] += 1
    }
    return mappa
  }, [db.ordini])

  const filtrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    return db.ordini
      .filter((ordine) => {
        if (stato !== 'tutti' && ordine.stato !== stato) return false
        if (!termine) return true
        return [ordine.numero, ordine.fornitore, ...ordine.righe.map((r) => r.descrizione)]
          .join(' ')
          .toLowerCase()
          .includes(termine)
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [db.ordini, ricerca, stato])

  const elenco = useElenco(filtrati, {
    perPaginaIniziale: 10,
    ordinamentoIniziale: { campo: 'data', direzione: 'desc' },
  })

  const inArrivo = useMemo(
    () =>
      db.ordini
        .filter((o) => o.stato === 'inviato' || o.stato === 'in_transito')
        .reduce(
          (somma, o) =>
            somma + o.righe.reduce((s, riga) => s + mancanti(riga) * riga.prezzoUnitario, 0),
          0,
        ),
    [db.ordini],
  )

  function filtraPer(nuovo: StatoOrdine | 'tutti') {
    setStato(nuovo)
    elenco.azzeraPagina()
  }

  function apriNuovo() {
    setInModifica(null)
    setErroreModulo('')
    setModulo({
      numero: prossimoNumeroOrdine(),
      fornitore: '',
      data: oggiISO(),
      consegnaPrevista: '',
      righe: [rigaVuota()],
    })
  }

  function apriModifica(ordine: OrdineFornitore) {
    setInModifica(ordine.id)
    setErroreModulo('')
    setModulo({
      numero: ordine.numero,
      fornitore: ordine.fornitore,
      data: ordine.data,
      consegnaPrevista: ordine.consegnaPrevista ?? '',
      righe: ordine.righe.map((riga) => ({ ...riga })),
    })
  }

  function salvaModulo() {
    if (!modulo) return
    // I fornitori sono testo libero: normalizzare gli spazi evita che lo stesso
    // fornitore compaia come due voci diverse nei suggerimenti.
    const fornitore = modulo.fornitore.trim().replace(/\s+/g, ' ')
    if (!fornitore) {
      setErroreModulo('Indica il fornitore.')
      return
    }
    if (!modulo.data) {
      setErroreModulo('Indica la data dell’ordine.')
      return
    }
    const righe = modulo.righe.filter((riga) => riga.descrizione.trim() !== '')
    if (righe.length === 0) {
      setErroreModulo('Aggiungi almeno una riga con descrizione.')
      return
    }
    if (righe.some((riga) => !Number.isFinite(riga.quantita) || riga.quantita <= 0)) {
      setErroreModulo('Le quantità devono essere maggiori di zero.')
      return
    }
    if (righe.some((riga) => !Number.isFinite(riga.prezzoUnitario) || riga.prezzoUnitario < 0)) {
      setErroreModulo('I prezzi non possono essere negativi.')
      return
    }
    if (modulo.consegnaPrevista && modulo.consegnaPrevista < modulo.data) {
      setErroreModulo('La consegna prevista non può precedere la data dell’ordine.')
      return
    }

    const comuni = {
      numero: modulo.numero.trim(),
      fornitore,
      data: modulo.data,
      consegnaPrevista: modulo.consegnaPrevista || undefined,
      righe,
    }

    if (inModifica) {
      aggiornaOrdine(inModifica, comuni)
      setDettaglio((precedente) =>
        precedente && precedente.id === inModifica ? { ...precedente, ...comuni } : precedente,
      )
    } else {
      aggiungiOrdine({ ...comuni, stato: 'bozza' })
    }
    setModulo(null)
    setInModifica(null)
  }

  function modificaRiga(id: string, modifiche: Partial<RigaOrdine>) {
    setModulo((precedente) =>
      precedente
        ? {
            ...precedente,
            righe: precedente.righe.map((riga) =>
              riga.id === id ? { ...riga, ...modifiche } : riga,
            ),
          }
        : precedente,
    )
  }

  function collegaArticolo(id: string, articoloId: string) {
    const articolo = db.magazzino.find((a) => a.id === articoloId)
    modificaRiga(id, {
      articoloId: articoloId || undefined,
      ...(articolo ? { descrizione: articolo.nome, prezzoUnitario: articolo.prezzoAcquisto } : {}),
    })
  }

  /** Apre la registrazione della consegna proponendo i pezzi ancora mancanti. */
  function apriRicezione(ordine: OrdineFornitore) {
    setRicezione(
      Object.fromEntries(ordine.righe.map((riga) => [riga.id, String(mancanti(riga))])),
    )
  }

  /**
   * Registra una consegna, anche parziale.
   * Il carico è calcolato sulla differenza rispetto a quanto già ricevuto,
   * quindi ripetere l'operazione non raddoppia mai le giacenze.
   */
  function confermaRicezione(ordine: OrdineFornitore) {
    if (!ricezione) return
    const movimenti: RichiestaMovimento[] = []

    const righe = ordine.righe.map((riga) => {
      const quantita = Number.parseInt(ricezione[riga.id] ?? '0', 10)
      const delta = Number.isFinite(quantita) ? Math.max(0, Math.min(quantita, mancanti(riga))) : 0
      if (delta > 0 && riga.articoloId) {
        movimenti.push({
          articoloId: riga.articoloId,
          delta,
          causale: 'carico_ordine',
          riferimentoId: ordine.id,
          riferimento: `Ordine ${ordine.numero}`,
        })
        // Il costo di magazzino si allinea all'ultimo acquisto effettivo.
        if (riga.prezzoUnitario > 0) {
          aggiornaArticolo(riga.articoloId, { prezzoAcquisto: riga.prezzoUnitario })
        }
      }
      return delta > 0 ? { ...riga, quantitaRicevuta: ricevuti(riga) + delta } : riga
    })

    muoviGiacenze(movimenti)

    const completo = righe.every((riga) => ricevuti(riga) >= riga.quantita)
    const modifiche = {
      righe,
      stato: (completo ? 'ricevuto' : 'in_transito') as StatoOrdine,
      ricevutoIl: completo ? oggiISO() : undefined,
    }
    aggiornaOrdine(ordine.id, modifiche)
    setDettaglio({ ...ordine, ...modifiche })
    setRicezione(null)
  }

  /** Riporta a zero i carichi già registrati, restituendo la merce al fornitore. */
  function stornaRicezione(ordine: OrdineFornitore) {
    const movimenti = ordine.righe
      .filter((riga) => riga.articoloId && ricevuti(riga) > 0)
      .map((riga) => ({
        articoloId: riga.articoloId as string,
        delta: -ricevuti(riga),
        causale: 'storno_ordine' as const,
        riferimentoId: ordine.id,
        riferimento: `Ordine ${ordine.numero}`,
      }))
    muoviGiacenze(movimenti)

    const modifiche = {
      righe: ordine.righe.map((riga) => ({ ...riga, quantitaRicevuta: 0 })),
      stato: 'inviato' as StatoOrdine,
      ricevutoIl: undefined,
    }
    aggiornaOrdine(ordine.id, modifiche)
    setDettaglio({ ...ordine, ...modifiche })
  }

  function cambiaStato(ordine: OrdineFornitore, nuovo: StatoOrdine) {
    if (nuovo === 'ricevuto') {
      apriRicezione(ordine)
      return
    }
    aggiornaOrdine(ordine.id, { stato: nuovo })
    setDettaglio({ ...ordine, stato: nuovo })
  }

  function esporta() {
    esportaCsv(
      nomeFileConData('ordini', 'csv'),
      ['Numero', 'Fornitore', 'Data', 'Consegna prevista', 'Stato', 'Righe', 'Totale'],
      filtrati.map((o) => [
        o.numero,
        o.fornitore,
        formatData(o.data),
        formatData(o.consegnaPrevista),
        STATI_ORDINE[o.stato].label,
        o.righe.length,
        numeroCsv(totaleRighe(o.righe)),
      ]),
    )
  }

  const righeNonCollegate = dettaglio?.righe.filter((riga) => !riga.articoloId).length ?? 0
  const daRicevere = dettaglio?.righe.reduce((somma, riga) => somma + mancanti(riga), 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={esporta}>
          <Download size={15} />
          Esporta
        </Button>
        <Button variante="primario" onClick={apriNuovo}>
          <Plus size={16} />
          Nuovo ordine
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatChip
          etichetta="Tutti gli ordini"
          valore={db.ordini.length}
          icona={Truck}
          colore="#2563eb"
          attivo={stato === 'tutti'}
          onClick={() => filtraPer('tutti')}
        />
        {ORDINE.map((valore) => (
          <StatChip
            key={valore}
            etichetta={STATI_ORDINE[valore].label}
            valore={conteggi[valore]}
            icona={ICONE[valore]}
            colore={STATI_ORDINE[valore].colore}
            attivo={stato === valore}
            onClick={() => filtraPer(valore)}
          />
        ))}
      </div>

      <Card>
        <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
          Merce ancora attesa (ordini inviati o in transito)
        </p>
        <p className="mt-1 text-2xl font-bold text-ink">{formatEuro(inArrivo)}</p>
      </Card>

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <div className="relative sm:w-96">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
            />
            <Input
              value={ricerca}
              onChange={(e) => {
                setRicerca(e.target.value)
                elenco.azzeraPagina()
              }}
              placeholder="Cerca per numero, fornitore o articolo…"
              aria-label="Cerca ordine"
              className="pl-9"
            />
          </div>
        </div>

        {elenco.totale === 0 ? (
          <StatoVuoto
            titolo="Nessun ordine trovato"
            azione={
              <Button variante="primario" dimensione="sm" onClick={apriNuovo}>
                <Plus size={14} />
                Nuovo ordine
              </Button>
            }
          />
        ) : (
          <>
            <Tabella>
              <TabellaHead>
                <Th>Numero</Th>
                <Th>Fornitore</Th>
                <Th>Data</Th>
                <Th>Consegna prevista</Th>
                <Th allineamento="center">Righe</Th>
                <Th>Stato</Th>
                <Th allineamento="right">Totale</Th>
              </TabellaHead>
              <tbody>
                {elenco.visibili.map((ordine) => (
                  <Tr key={ordine.id} onClick={() => setDettaglio(ordine)}>
                    <Td className="font-medium whitespace-nowrap text-ink">{ordine.numero}</Td>
                    <Td className="text-[13px]">{ordine.fornitore}</Td>
                    <Td className="whitespace-nowrap">{formatData(ordine.data)}</Td>
                    <Td className="whitespace-nowrap">{formatData(ordine.consegnaPrevista)}</Td>
                    <Td allineamento="center">{ordine.righe.length}</Td>
                    <Td>
                      <Badge className={STATI_ORDINE[ordine.stato].badge}>
                        {STATI_ORDINE[ordine.stato].label}
                      </Badge>
                    </Td>
                    <Td allineamento="right" className="font-semibold text-ink">
                      {formatEuro(totaleRighe(ordine.righe))}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabella>

            <Paginazione
              pagina={elenco.pagina}
              pagine={elenco.pagine}
              totale={elenco.totale}
              primoElemento={elenco.primoElemento}
              ultimoElemento={elenco.ultimoElemento}
              perPagina={elenco.perPagina}
              etichettaElementi="ordini"
              onCambiaPagina={elenco.vaiAPagina}
              onCambiaPerPagina={elenco.cambiaPerPagina}
            />
          </>
        )}
      </Card>

      <Modal
        aperta={dettaglio !== null}
        titolo={dettaglio ? `Ordine ${dettaglio.numero}` : ''}
        sottotitolo={dettaglio?.fornitore}
        onChiudi={() => setDettaglio(null)}
        piede={
          dettaglio && (
            <>
              <Select
                value={dettaglio.stato}
                onChange={(e) => cambiaStato(dettaglio, e.target.value as StatoOrdine)}
                aria-label="Cambia stato ordine"
                className="mr-auto w-40"
              >
                {ORDINE.map((valore) => (
                  <option key={valore} value={valore}>
                    {STATI_ORDINE[valore].label}
                  </option>
                ))}
              </Select>
              <Button onClick={() => apriModifica(dettaglio)}>
                <Pencil size={15} />
                Modifica
              </Button>
              <Button variante="pericolo" onClick={() => setDaEliminare(dettaglio)}>
                <Trash2 size={15} />
                Elimina
              </Button>
              {daRicevere > 0 && (
                <Button variante="successo" onClick={() => apriRicezione(dettaglio)}>
                  <PackageCheck size={15} />
                  Registra consegna
                </Button>
              )}
            </>
          )
        }
      >
        {dettaglio && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Data ordine</dt>
                <dd className="text-ink">{formatData(dettaglio.data)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Consegna prevista</dt>
                <dd className="text-ink">{formatData(dettaglio.consegnaPrevista)}</dd>
              </div>
            </dl>

            <Tabella>
              <TabellaHead>
                <Th>Articolo</Th>
                <Th allineamento="center">Ordinati</Th>
                <Th allineamento="center">Ricevuti</Th>
                <Th allineamento="right">Prezzo</Th>
                <Th allineamento="right">Totale</Th>
              </TabellaHead>
              <tbody>
                {dettaglio.righe.map((riga) => (
                  <Tr key={riga.id}>
                    <Td className="text-[13px] text-ink">{riga.descrizione}</Td>
                    <Td allineamento="center">{riga.quantita}</Td>
                    <Td
                      allineamento="center"
                      className={ricevuti(riga) < riga.quantita ? 'text-amber-300' : 'text-ink'}
                    >
                      {ricevuti(riga)}
                    </Td>
                    <Td allineamento="right">{formatEuro(riga.prezzoUnitario)}</Td>
                    <Td allineamento="right" className="font-semibold text-ink">
                      {formatEuro(riga.quantita * riga.prezzoUnitario)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabella>

            <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
              <span>Totale ordine</span>
              <span>{formatEuro(totaleRighe(dettaglio.righe))}</span>
            </div>

            {dettaglio.ricevutoIl && (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3 text-xs text-ink-muted">
                Consegna completata il {formatData(dettaglio.ricevutoIl)}.
              </p>
            )}

            {dettaglio.righe.some((riga) => ricevuti(riga) > 0) && (
              <Button dimensione="sm" variante="pericolo" onClick={() => stornaRicezione(dettaglio)}>
                Storna i carichi registrati
              </Button>
            )}

            {righeNonCollegate > 0 && (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-3 text-xs text-ink-muted">
                {righeNonCollegate} righe non sono collegate a un articolo di magazzino: alla
                consegna non movimenteranno alcuna giacenza.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        aperta={modulo !== null}
        titolo={inModifica ? 'Modifica ordine' : 'Nuovo ordine a fornitore'}
        onChiudi={() => {
          setModulo(null)
          setInModifica(null)
        }}
        larghezza="lg"
        piede={
          <>
            <Button
              onClick={() => {
                setModulo(null)
                setInModifica(null)
              }}
            >
              Annulla
            </Button>
            <Button variante="primario" onClick={salvaModulo}>
              Salva ordine
            </Button>
          </>
        }
      >
        {modulo && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etichetta="Fornitore" obbligatorio className="sm:col-span-2">
                <Input
                  value={modulo.fornitore}
                  onChange={(e) => setModulo({ ...modulo, fornitore: e.target.value })}
                  list="elenco-fornitori"
                  placeholder="Esprinet"
                />
              </Campo>
              <Campo etichetta="Numero">
                <Input
                  value={modulo.numero}
                  onChange={(e) => setModulo({ ...modulo, numero: e.target.value })}
                />
              </Campo>
              <Campo etichetta="Data" obbligatorio>
                <Input
                  type="date"
                  value={modulo.data}
                  onChange={(e) => setModulo({ ...modulo, data: e.target.value })}
                />
              </Campo>
              <Campo etichetta="Consegna prevista">
                <Input
                  type="date"
                  min={modulo.data}
                  value={modulo.consegnaPrevista}
                  onChange={(e) => setModulo({ ...modulo, consegnaPrevista: e.target.value })}
                />
              </Campo>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                  Righe dell’ordine
                </p>
                <Button
                  dimensione="sm"
                  onClick={() => setModulo({ ...modulo, righe: [...modulo.righe, rigaVuota()] })}
                >
                  <Plus size={14} />
                  Aggiungi riga
                </Button>
              </div>

              <ul className="space-y-2">
                {modulo.righe.map((riga) => (
                  <li
                    key={riga.id}
                    className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_5rem_7rem_2rem]"
                  >
                    <div className="col-span-2 space-y-2 sm:col-span-1">
                      <Input
                        value={riga.descrizione}
                        onChange={(e) => modificaRiga(riga.id, { descrizione: e.target.value })}
                        placeholder="Descrizione articolo"
                        aria-label="Descrizione"
                      />
                      <Select
                        value={riga.articoloId ?? ''}
                        onChange={(e) => collegaArticolo(riga.id, e.target.value)}
                        aria-label="Articolo di magazzino"
                        className="h-8 text-xs"
                      >
                        <option value="">Nessun articolo collegato</option>
                        {db.magazzino.map((articolo) => (
                          <option key={articolo.id} value={articolo.id}>
                            {articolo.nome} ({articolo.quantita} pz)
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={riga.quantita}
                      onChange={(e) =>
                        modificaRiga(riga.id, { quantita: Number(e.target.value) })
                      }
                      aria-label="Quantità"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={riga.prezzoUnitario}
                      onChange={(e) =>
                        modificaRiga(riga.id, { prezzoUnitario: Number(e.target.value) })
                      }
                      aria-label="Prezzo di acquisto"
                    />
                    <span className="self-center justify-self-end">
                      <IconButton
                        etichetta="Rimuovi riga"
                        onClick={() =>
                          setModulo({
                            ...modulo,
                            righe: modulo.righe.filter((voce) => voce.id !== riga.id),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-ink">
              <span>Totale ordine</span>
              <span>{formatEuro(totaleRighe(modulo.righe))}</span>
            </div>

            {erroreModulo && <p className="text-[13px] text-rose-400">{erroreModulo}</p>}
          </div>
        )}
      </Modal>

      <Modal
        aperta={ricezione !== null}
        titolo="Registra la consegna"
        sottotitolo={dettaglio?.numero}
        onChiudi={() => setRicezione(null)}
        piede={
          <>
            <Button onClick={() => setRicezione(null)}>Annulla</Button>
            <Button
              variante="primario"
              onClick={() => dettaglio && confermaRicezione(dettaglio)}
            >
              Carica in magazzino
            </Button>
          </>
        }
      >
        {dettaglio && ricezione && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Indica quanti pezzi sono arrivati. Se la consegna è parziale l’ordine resta in
              transito e potrai registrare il resto più avanti.
            </p>
            <ul className="space-y-2">
              {dettaglio.righe.map((riga) => (
                <li
                  key={riga.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{riga.descrizione}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {ricevuti(riga)} di {riga.quantita} già ricevuti
                      {!riga.articoloId && ' · nessun articolo collegato'}
                    </span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={mancanti(riga)}
                    value={ricezione[riga.id] ?? '0'}
                    onChange={(e) =>
                      setRicezione({ ...ricezione, [riga.id]: e.target.value })
                    }
                    aria-label={`Pezzi ricevuti di ${riga.descrizione}`}
                    className="w-24"
                    disabled={mancanti(riga) === 0}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare l’ordine?"
        sottotitolo={daEliminare?.numero}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) eliminaOrdine(daEliminare.id)
                setDaEliminare(null)
                setDettaglio(null)
              }}
            >
              <Trash2 size={15} />
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          L’ordine viene rimosso dall’archivio. Le giacenze già caricate restano in magazzino:
          se vuoi annullarle usa prima «Storna i carichi registrati».
        </p>
      </Modal>

      <datalist id="elenco-fornitori">
        {fornitori.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>
    </div>
  )
}

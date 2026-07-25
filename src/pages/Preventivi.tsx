import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Send,
  ThumbsDown,
  Trash2,
  Search,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
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
import { AnteprimaStampa } from '@/components/stampa/AnteprimaStampa'
import { DocumentoCommerciale } from '@/components/stampa/DocumentoCommerciale'
import { FormDocumento, type DatiDocumento } from '@/components/documenti/FormDocumento'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import { useElenco } from '@/lib/useElenco'
import { clonaRighe, dataPiuGiorni, preventivoModificabile, rigaVuota } from '@/lib/documenti'
import { oggiISO } from '@/lib/format'
import { esportaCsv, nomeFileConData, numeroCsv } from '@/lib/esporta'
import { imponibile, scorporoIva, totalePreventivo } from '@/lib/calcoli'
import { formatData, formatEuro } from '@/lib/format'
import { STATI_PREVENTIVO, statoPreventivoEffettivo } from '@/lib/stati'
import type { Preventivo, StatoPreventivo } from '@/types'

const ORDINE: StatoPreventivo[] = ['bozza', 'inviato', 'accettato', 'rifiutato', 'scaduto']

const ICONE = {
  bozza: FileText,
  inviato: Send,
  accettato: CheckCircle2,
  rifiutato: ThumbsDown,
  scaduto: Clock,
} as const

export function Preventivi() {
  useIntestazione({
    titolo: 'Preventivi',
    sottotitolo: 'Proposte di intervento inviate ai clienti',
  })

  const {
    db,
    aggiungiPreventivo,
    aggiornaPreventivo,
    eliminaPreventivo,
    aggiungiFattura,
    aggiornaRiparazione,
    prossimoNumeroPreventivo,
    prossimoNumeroFattura,
  } = useGestionale()
  const navigate = useNavigate()
  const { id: idRotta } = useParams()
  const [parametri, setParametri] = useSearchParams()

  const [ricerca, setRicerca] = useState('')
  const [stato, setStato] = useState<StatoPreventivo | 'tutti'>('tutti')
  const [dettaglio, setDettaglio] = useState<Preventivo | null>(null)
  const [daStampare, setDaStampare] = useState<Preventivo | null>(null)
  const [modulo, setModulo] = useState<DatiDocumento | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Preventivo | null>(null)
  const [avviso, setAvviso] = useState('')

  const nomiClienti = useMemo(
    () => new Map(db.clienti.map((cliente) => [cliente.id, cliente.nome])),
    [db.clienti],
  )

  /** Stato mostrato ovunque: la scadenza è calcolata, non registrata a mano. */
  const statiEffettivi = useMemo(
    () => new Map(db.preventivi.map((p) => [p.id, statoPreventivoEffettivo(p)])),
    [db.preventivi],
  )
  const statoDi = (preventivo: Preventivo) =>
    statiEffettivi.get(preventivo.id) ?? preventivo.stato

  const conteggi = useMemo(() => {
    const mappa = Object.fromEntries(ORDINE.map((s) => [s, 0])) as Record<StatoPreventivo, number>
    for (const preventivo of db.preventivi) {
      mappa[statiEffettivi.get(preventivo.id) ?? preventivo.stato] += 1
    }
    return mappa
  }, [db.preventivi, statiEffettivi])

  const filtrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    return db.preventivi.filter((preventivo) => {
      if (stato !== 'tutti' && (statiEffettivi.get(preventivo.id) ?? preventivo.stato) !== stato) {
        return false
      }
      if (!termine) return true
      return [
        preventivo.numero,
        nomiClienti.get(preventivo.clienteId) ?? '',
        ...preventivo.righe.map((r) => r.descrizione),
      ]
        .join(' ')
        .toLowerCase()
        .includes(termine)
    })
  }, [db.preventivi, nomiClienti, statiEffettivi, ricerca, stato])

  const elenco = useElenco(filtrati, {
    perPaginaIniziale: 10,
    ordinamentoIniziale: { campo: 'data', direzione: 'desc' },
  })

  // Apertura da link diretto (`/preventivi/:id`) e da scorciatoia (`?nuovo=1`).
  useEffect(() => {
    if (!idRotta) return
    const preventivo = db.preventivi.find((p) => p.id === idRotta)
    if (preventivo) setDettaglio(preventivo)
  }, [idRotta, db.preventivi])

  useEffect(() => {
    if (parametri.get('nuovo') !== '1') return
    setParametri({}, { replace: true })
    setInModifica(null)
    setModulo({
      clienteId: '',
      numero: prossimoNumeroPreventivo(),
      data: oggiISO(),
      termine: dataPiuGiorni(oggiISO(), db.azienda.giorniValiditaPreventivo),
      iva: db.azienda.ivaPredefinita,
      righe: [rigaVuota()],
      note: '',
    })
    // Le dipendenze restano le sole necessarie ad accorgersi del parametro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametri])

  // Solo i preventivi ancora validi: quelli scaduti non sono più in attesa di risposta.
  const valoreInviati = useMemo(
    () =>
      db.preventivi
        .filter((p) => (statiEffettivi.get(p.id) ?? p.stato) === 'inviato')
        .reduce((somma, p) => somma + totalePreventivo(p), 0),
    [db.preventivi, statiEffettivi],
  )

  function filtraPer(nuovo: StatoPreventivo | 'tutti') {
    setStato(nuovo)
    elenco.azzeraPagina()
  }

  function apriNuovo() {
    setInModifica(null)
    setModulo({
      clienteId: '',
      numero: prossimoNumeroPreventivo(),
      data: oggiISO(),
      termine: dataPiuGiorni(oggiISO(), db.azienda.giorniValiditaPreventivo),
      iva: db.azienda.ivaPredefinita,
      righe: [rigaVuota()],
      note: '',
    })
  }

  function apriModifica(preventivo: Preventivo) {
    setInModifica(preventivo.id)
    setModulo({
      clienteId: preventivo.clienteId,
      numero: preventivo.numero,
      data: preventivo.data,
      termine: preventivo.validoFino ?? '',
      iva: preventivo.iva,
      righe: clonaRighe(preventivo.righe),
      note: preventivo.note ?? '',
      riparazioneId: preventivo.riparazioneId,
    })
  }

  function salvaModulo(dati: DatiDocumento) {
    const comuni = {
      clienteId: dati.clienteId,
      numero: dati.numero.trim(),
      data: dati.data,
      validoFino: dati.termine || undefined,
      righe: dati.righe,
      iva: dati.iva,
      note: dati.note.trim() || undefined,
      riparazioneId: dati.riparazioneId,
    }

    if (inModifica) {
      aggiornaPreventivo(inModifica, comuni)
      setDettaglio((precedente) =>
        precedente && precedente.id === inModifica ? { ...precedente, ...comuni } : precedente,
      )
    } else {
      aggiungiPreventivo({ ...comuni, stato: 'bozza' })
    }
    setModulo(null)
    setInModifica(null)
  }

  /**
   * Il cambio di stato del preventivo trascina la riparazione collegata:
   * altrimenti il tecnico non riceve alcun segnale che può iniziare o che il
   * dispositivo va restituito.
   */
  function cambiaStato(preventivo: Preventivo, nuovo: StatoPreventivo) {
    aggiornaPreventivo(preventivo.id, { stato: nuovo })
    setDettaglio({ ...preventivo, stato: nuovo })
    setAvviso('')

    const riparazione = preventivo.riparazioneId
      ? db.riparazioni.find((r) => r.id === preventivo.riparazioneId)
      : undefined
    if (!riparazione || riparazione.stato !== 'preventivo_inviato') return

    if (nuovo === 'accettato') {
      aggiornaRiparazione(riparazione.id, { stato: 'in_lavorazione' })
      setAvviso(`La riparazione ${riparazione.codice} è passata in lavorazione.`)
    } else if (nuovo === 'rifiutato') {
      aggiornaRiparazione(riparazione.id, { stato: 'pronto_per_ritiro' })
      setAvviso(`La riparazione ${riparazione.codice} è pronta per la restituzione.`)
    }
  }

  /** Genera la fattura corrispondente, mantenendo righe, IVA e riferimenti. */
  function convertiInFattura(preventivo: Preventivo) {
    const fattura = aggiungiFattura({
      clienteId: preventivo.clienteId,
      numero: prossimoNumeroFattura(),
      riparazioneId: preventivo.riparazioneId,
      data: oggiISO(),
      scadenza: dataPiuGiorni(oggiISO(), 30),
      stato: 'emessa',
      righe: clonaRighe(preventivo.righe),
      iva: preventivo.iva,
    })
    navigate(`/fatture/${fattura.id}`)
  }

  function esporta() {
    esportaCsv(
      nomeFileConData('preventivi', 'csv'),
      ['Numero', 'Cliente', 'Data', 'Valido fino', 'Stato', 'Totale'],
      filtrati.map((p) => [
        p.numero,
        nomiClienti.get(p.clienteId),
        formatData(p.data),
        formatData(p.validoFino),
        STATI_PREVENTIVO[statoDi(p)].label,
        numeroCsv(totalePreventivo(p)),
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          Valore dei preventivi in attesa di risposta:{' '}
          <span className="font-semibold text-ink">{formatEuro(valoreInviati)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={esporta}>
            <Download size={15} />
            Esporta
          </Button>
          <Button variante="primario" onClick={apriNuovo}>
            <Plus size={16} />
            Nuovo preventivo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatChip
          etichetta="Tutti"
          valore={db.preventivi.length}
          icona={FileText}
          colore="#2563eb"
          attivo={stato === 'tutti'}
          onClick={() => filtraPer('tutti')}
        />
        {ORDINE.map((valore) => (
          <StatChip
            key={valore}
            etichetta={STATI_PREVENTIVO[valore].label}
            valore={conteggi[valore]}
            icona={ICONE[valore]}
            colore={STATI_PREVENTIVO[valore].colore}
            attivo={stato === valore}
            onClick={() => filtraPer(valore)}
          />
        ))}
      </div>

      <Card padding={false}>
        <div className="border-b border-line p-4">
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
              placeholder="Cerca per numero, cliente o descrizione…"
              aria-label="Cerca preventivo"
              className="pl-9"
            />
          </div>
        </div>

        {elenco.totale === 0 ? (
          <StatoVuoto titolo="Nessun preventivo trovato" />
        ) : (
          <>
            <Tabella>
              <TabellaHead>
                <Th>Numero</Th>
                <Th>Cliente</Th>
                <Th>Oggetto</Th>
                <Th>Data</Th>
                <Th>Valido fino</Th>
                <Th>Stato</Th>
                <Th allineamento="right">Totale</Th>
              </TabellaHead>
              <tbody>
                {elenco.visibili.map((preventivo) => (
                  <Tr key={preventivo.id} onClick={() => setDettaglio(preventivo)}>
                    <Td etichetta="Numero" className="font-medium whitespace-nowrap text-ink">
                      {preventivo.numero}
                    </Td>
                    <Td etichetta="Cliente" className="text-[13px]">
                      {nomiClienti.get(preventivo.clienteId) ?? '--'}
                    </Td>
                    <Td
                      etichetta="Oggetto"
                      className="max-w-[260px] truncate text-[13px] max-sm:max-w-none"
                    >
                      {preventivo.righe.map((r) => r.descrizione).join(', ')}
                    </Td>
                    <Td etichetta="Data" className="whitespace-nowrap">
                      {formatData(preventivo.data)}
                    </Td>
                    <Td etichetta="Valido fino" className="whitespace-nowrap">
                      {formatData(preventivo.validoFino)}
                    </Td>
                    <Td etichetta="Stato">
                      <Badge className={STATI_PREVENTIVO[statoDi(preventivo)].badge}>
                        {STATI_PREVENTIVO[statoDi(preventivo)].label}
                      </Badge>
                    </Td>
                    <Td etichetta="Totale" allineamento="right" className="font-semibold text-ink">
                      {formatEuro(totalePreventivo(preventivo))}
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
              etichettaElementi="preventivi"
              onCambiaPagina={elenco.vaiAPagina}
              onCambiaPerPagina={elenco.cambiaPerPagina}
            />
          </>
        )}
      </Card>

      <Modal
        aperta={dettaglio !== null}
        titolo={dettaglio ? `Preventivo ${dettaglio.numero}` : ''}
        sottotitolo={dettaglio ? nomiClienti.get(dettaglio.clienteId) : undefined}
        onChiudi={() => {
          setDettaglio(null)
          setAvviso('')
          if (idRotta) navigate('/preventivi', { replace: true })
        }}
        piede={
          dettaglio && (
            <>
              <Select
                value={statoDi(dettaglio)}
                onChange={(e) => cambiaStato(dettaglio, e.target.value as StatoPreventivo)}
                aria-label="Cambia stato preventivo"
                className="mr-auto w-40"
              >
                {ORDINE.map((valore) => (
                  <option key={valore} value={valore}>
                    {STATI_PREVENTIVO[valore].label}
                  </option>
                ))}
              </Select>
              {preventivoModificabile(dettaglio) && (
                <Button onClick={() => apriModifica(dettaglio)}>
                  <Pencil size={15} />
                  Modifica
                </Button>
              )}
              <Button variante="pericolo" onClick={() => setDaEliminare(dettaglio)}>
                <Trash2 size={15} />
                Elimina
              </Button>
              {dettaglio.riparazioneId && (
                <Button onClick={() => navigate(`/riparazioni/${dettaglio.riparazioneId}`)}>
                  Apri riparazione
                </Button>
              )}
              <Button onClick={() => setDaStampare(dettaglio)}>Stampa</Button>
              <Button variante="primario" onClick={() => convertiInFattura(dettaglio)}>
                <Receipt size={15} />
                Crea fattura
              </Button>
            </>
          )
        }
      >
        {dettaglio && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Data</dt>
                <dd className="text-ink">{formatData(dettaglio.data)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valido fino al</dt>
                <dd className="text-ink">{formatData(dettaglio.validoFino)}</dd>
              </div>
            </dl>

            <Tabella larghezzaMinima="">
              <TabellaHead>
                <Th>Descrizione</Th>
                <Th allineamento="center">Q.tà</Th>
                <Th allineamento="right">Prezzo</Th>
                <Th allineamento="right">Totale</Th>
              </TabellaHead>
              <tbody>
                {dettaglio.righe.map((riga) => (
                  <Tr key={riga.id}>
                    <Td className="text-[13px] text-ink">{riga.descrizione}</Td>
                    <Td allineamento="center">{riga.quantita}</Td>
                    <Td allineamento="right">{formatEuro(riga.prezzoUnitario)}</Td>
                    <Td allineamento="right" className="font-semibold text-ink">
                      {formatEuro(riga.quantita * riga.prezzoUnitario)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabella>

            <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-ink-muted">
                <dt>Imponibile</dt>
                <dd>{formatEuro(imponibile(totalePreventivo(dettaglio), dettaglio.iva))}</dd>
              </div>
              <div className="flex justify-between text-ink-muted">
                <dt>IVA {dettaglio.iva}%</dt>
                <dd>{formatEuro(scorporoIva(totalePreventivo(dettaglio), dettaglio.iva))}</dd>
              </div>
              <div className="flex justify-between text-base font-bold text-ink">
                <dt>Totale</dt>
                <dd>{formatEuro(totalePreventivo(dettaglio))}</dd>
              </div>
            </dl>

            {dettaglio.note && (
              <p className="rounded-lg bg-surface-2 p-3 text-[13px] text-ink-muted">
                {dettaglio.note}
              </p>
            )}

            {avviso && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[13px] text-emerald-300">
                {avviso}
              </p>
            )}
          </div>
        )}
      </Modal>

      <FormDocumento
        aperta={modulo !== null}
        tipo="preventivo"
        iniziali={modulo}
        titolo={inModifica ? 'Modifica preventivo' : 'Nuovo preventivo'}
        onSalva={salvaModulo}
        onChiudi={() => {
          setModulo(null)
          setInModifica(null)
        }}
      />

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare il preventivo?"
        sottotitolo={daEliminare?.numero}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) eliminaPreventivo(daEliminare.id)
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
          Il documento viene rimosso dall’archivio. Le fatture già generate da questo preventivo
          non vengono toccate.
        </p>
      </Modal>

      <AnteprimaStampa
        aperta={daStampare !== null}
        titolo={daStampare ? `Preventivo ${daStampare.numero}` : ''}
        nomeFile={`preventivo-${daStampare?.numero.replace(/[^\w-]/g, '') ?? ''}.html`}
        documento={
          daStampare && (
            <DocumentoCommerciale
              azienda={db.azienda}
              cliente={db.clienti.find((c) => c.id === daStampare.clienteId)}
              documento={daStampare}
              tipo="preventivo"
              statoLabel={STATI_PREVENTIVO[statoDi(daStampare)].label}
            />
          )
        }
        onChiudi={() => setDaStampare(null)}
      />
    </div>
  )
}

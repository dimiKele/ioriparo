import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wrench,
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
import { clonaRighe, dataPiuGiorni, fatturaModificabile, rigaVuota } from '@/lib/documenti'
import { esportaCsv, nomeFileConData, numeroCsv } from '@/lib/esporta'
import { imponibile, scorporoIva, totaleFattura } from '@/lib/calcoli'
import { formatData, formatEuro, oggiISO } from '@/lib/format'
import { STATI_FATTURA, statoFatturaEffettivo } from '@/lib/stati'
import type { Fattura, MetodoPagamento, StatoFattura } from '@/types'

const ORDINE: StatoFattura[] = ['emessa', 'pagata', 'scaduta', 'annullata']

const ICONE = {
  emessa: Receipt,
  pagata: CheckCircle2,
  scaduta: AlertTriangle,
  annullata: Ban,
} as const

const METODI: Array<{ valore: MetodoPagamento; label: string }> = [
  { valore: 'contanti', label: 'Contanti' },
  { valore: 'carta', label: 'Carta' },
  { valore: 'bonifico', label: 'Bonifico' },
  { valore: 'satispay', label: 'Satispay' },
  { valore: 'altro', label: 'Altro' },
]

export function Fatture() {
  useIntestazione({
    titolo: 'Fatture',
    sottotitolo: 'Documenti emessi e stato degli incassi',
  })

  const {
    db,
    aggiungiFattura,
    aggiornaFattura,
    eliminaFattura,
    prossimoNumeroFattura,
  } = useGestionale()
  const navigate = useNavigate()
  const { id: idRotta } = useParams()
  const [parametri, setParametri] = useSearchParams()

  const [ricerca, setRicerca] = useState('')
  const [stato, setStato] = useState<StatoFattura | 'tutti'>('tutti')
  const [mese, setMese] = useState('')
  const [dettaglio, setDettaglio] = useState<Fattura | null>(null)
  const [daStampare, setDaStampare] = useState<Fattura | null>(null)
  const [modulo, setModulo] = useState<DatiDocumento | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Fattura | null>(null)

  const nomiClienti = useMemo(
    () => new Map(db.clienti.map((cliente) => [cliente.id, cliente.nome])),
    [db.clienti],
  )

  /** «Scaduta» dipende dalla data, non da un campo aggiornato a mano. */
  const statiEffettivi = useMemo(
    () => new Map(db.fatture.map((f) => [f.id, statoFatturaEffettivo(f)])),
    [db.fatture],
  )
  const statoDi = (fattura: Fattura) => statiEffettivi.get(fattura.id) ?? fattura.stato

  const conteggi = useMemo(() => {
    const mappa = Object.fromEntries(ORDINE.map((s) => [s, 0])) as Record<StatoFattura, number>
    for (const fattura of db.fatture) {
      mappa[statiEffettivi.get(fattura.id) ?? fattura.stato] += 1
    }
    return mappa
  }, [db.fatture, statiEffettivi])

  const filtrate = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    return db.fatture.filter((fattura) => {
      if (stato !== 'tutti' && (statiEffettivi.get(fattura.id) ?? fattura.stato) !== stato) {
        return false
      }
      if (mese && !fattura.data.startsWith(mese)) return false
      if (!termine) return true
      return [
        fattura.numero,
        nomiClienti.get(fattura.clienteId) ?? '',
        ...fattura.righe.map((r) => r.descrizione),
      ]
        .join(' ')
        .toLowerCase()
        .includes(termine)
    })
  }, [db.fatture, nomiClienti, statiEffettivi, ricerca, stato, mese])

  const elenco = useElenco(filtrate, {
    perPaginaIniziale: 10,
    ordinamentoIniziale: { campo: 'data', direzione: 'desc' },
  })

  const daIncassare = filtrate
    .filter((f) => {
      const effettivo = statoDi(f)
      return effettivo === 'emessa' || effettivo === 'scaduta'
    })
    .reduce((somma, f) => somma + totaleFattura(f), 0)

  const incassato = filtrate
    .filter((f) => f.stato === 'pagata')
    .reduce((somma, f) => somma + totaleFattura(f), 0)

  // Apertura da link diretto (`/fatture/:id`) e da scorciatoia (`?nuovo=1`).
  useEffect(() => {
    if (!idRotta) return
    const fattura = db.fatture.find((f) => f.id === idRotta)
    if (fattura) setDettaglio(fattura)
  }, [idRotta, db.fatture])

  useEffect(() => {
    if (parametri.get('nuovo') !== '1') return
    setParametri({}, { replace: true })
    setInModifica(null)
    setModulo(moduloVuoto())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametri])

  function moduloVuoto(): DatiDocumento {
    return {
      clienteId: '',
      numero: prossimoNumeroFattura(),
      data: oggiISO(),
      termine: dataPiuGiorni(oggiISO(), 30),
      iva: db.azienda.ivaPredefinita,
      righe: [rigaVuota()],
      note: '',
    }
  }

  function filtraPer(nuovo: StatoFattura | 'tutti') {
    setStato(nuovo)
    elenco.azzeraPagina()
  }

  function apriModifica(fattura: Fattura) {
    setInModifica(fattura.id)
    setModulo({
      clienteId: fattura.clienteId,
      numero: fattura.numero,
      data: fattura.data,
      termine: fattura.scadenza ?? '',
      iva: fattura.iva,
      righe: clonaRighe(fattura.righe),
      note: '',
      riparazioneId: fattura.riparazioneId,
    })
  }

  function salvaModulo(dati: DatiDocumento) {
    const comuni = {
      clienteId: dati.clienteId,
      numero: dati.numero.trim(),
      data: dati.data,
      scadenza: dati.termine || undefined,
      righe: dati.righe,
      iva: dati.iva,
      riparazioneId: dati.riparazioneId,
    }

    if (inModifica) {
      aggiornaFattura(inModifica, comuni)
      setDettaglio((precedente) =>
        precedente && precedente.id === inModifica ? { ...precedente, ...comuni } : precedente,
      )
    } else {
      aggiungiFattura({ ...comuni, stato: 'emessa' })
    }
    setModulo(null)
    setInModifica(null)
  }

  function esporta() {
    esportaCsv(
      nomeFileConData('fatture', 'csv'),
      ['Numero', 'Cliente', 'Data', 'Scadenza', 'Stato', 'Metodo', 'Imponibile', 'IVA', 'Totale'],
      filtrate.map((f) => {
        const totale = totaleFattura(f)
        return [
          f.numero,
          nomiClienti.get(f.clienteId),
          formatData(f.data),
          formatData(f.scadenza),
          STATI_FATTURA[statoDi(f)].label,
          METODI.find((m) => m.valore === f.metodoPagamento)?.label,
          numeroCsv(imponibile(totale, f.iva)),
          numeroCsv(scorporoIva(totale, f.iva)),
          numeroCsv(totale),
        ]
      }),
    )
  }

  function segnaPagata(fattura: Fattura, metodo: MetodoPagamento) {
    const modifiche = {
      stato: 'pagata' as const,
      metodoPagamento: metodo,
      dataPagamento: oggiISO(),
    }
    aggiornaFattura(fattura.id, modifiche)
    setDettaglio({ ...fattura, ...modifiche })
  }

  /**
   * Riporta la fattura a «emessa»: senza questa azione un incasso registrato
   * per errore non è più correggibile dall'interfaccia.
   */
  function annullaPagamento(fattura: Fattura) {
    const modifiche = {
      stato: 'emessa' as const,
      metodoPagamento: undefined,
      dataPagamento: undefined,
    }
    aggiornaFattura(fattura.id, modifiche)
    setDettaglio({ ...fattura, ...modifiche })
  }

  function cambiaStatoFattura(fattura: Fattura, nuovo: StatoFattura) {
    if (nuovo === 'pagata') {
      segnaPagata(fattura, fattura.metodoPagamento ?? 'contanti')
      return
    }
    if (nuovo === 'annullata') {
      const modifiche = {
        stato: 'annullata' as const,
        metodoPagamento: undefined,
        dataPagamento: undefined,
      }
      aggiornaFattura(fattura.id, modifiche)
      setDettaglio({ ...fattura, ...modifiche })
      return
    }
    // «Emessa» e «scaduta» sono lo stesso stato registrato: la differenza la fa la data.
    annullaPagamento(fattura)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Documenti nel filtro
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{filtrate.length}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">Incassato</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{formatEuro(incassato)}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Da incassare
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{formatEuro(daIncassare)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatChip
          etichetta="Tutte"
          valore={db.fatture.length}
          icona={Receipt}
          colore="#2563eb"
          attivo={stato === 'tutti'}
          onClick={() => filtraPer('tutti')}
        />
        {ORDINE.map((valore) => (
          <StatChip
            key={valore}
            etichetta={STATI_FATTURA[valore].label}
            valore={conteggi[valore]}
            icona={ICONE[valore]}
            colore={STATI_FATTURA[valore].colore}
            attivo={stato === valore}
            onClick={() => filtraPer(valore)}
          />
        ))}
      </div>

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <div className="relative sm:w-80">
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
              placeholder="Cerca per numero o cliente…"
              aria-label="Cerca fattura"
              className="pl-9"
            />
          </div>

          <Input
            type="month"
            value={mese}
            onChange={(e) => {
              setMese(e.target.value)
              elenco.azzeraPagina()
            }}
            aria-label="Filtra per mese"
            className="sm:w-48"
          />

          <Button onClick={esporta} className="sm:ml-auto">
            <Download size={15} />
            Esporta
          </Button>
          <Button
            variante="primario"
            onClick={() => {
              setInModifica(null)
              setModulo(moduloVuoto())
            }}
          >
            <Plus size={16} />
            Nuova fattura
          </Button>
        </div>

        {elenco.totale === 0 ? (
          <StatoVuoto
            titolo={db.fatture.length === 0 ? 'Nessuna fattura emessa' : 'Nessuna fattura trovata'}
            descrizione={
              db.fatture.length === 0
                ? 'La numerazione parte dal primo documento che emetti; il formato si imposta in Impostazioni.'
                : undefined
            }
          />
        ) : (
          <>
            <Tabella>
              <TabellaHead>
                <Th>Numero</Th>
                <Th>Cliente</Th>
                <Th>Data</Th>
                <Th>Scadenza</Th>
                <Th>Stato</Th>
                <Th>Pagamento</Th>
                <Th allineamento="right">Totale</Th>
              </TabellaHead>
              <tbody>
                {elenco.visibili.map((fattura) => (
                  <Tr key={fattura.id} onClick={() => setDettaglio(fattura)}>
                    <Td etichetta="Numero" className="font-medium whitespace-nowrap text-ink">
                      {fattura.numero}
                    </Td>
                    <Td etichetta="Cliente" className="text-[13px]">
                      {nomiClienti.get(fattura.clienteId) ?? '--'}
                    </Td>
                    <Td etichetta="Data" className="whitespace-nowrap">
                      {formatData(fattura.data)}
                    </Td>
                    <Td etichetta="Scadenza" className="whitespace-nowrap">
                      {formatData(fattura.scadenza)}
                    </Td>
                    <Td etichetta="Stato">
                      <Badge className={STATI_FATTURA[statoDi(fattura)].badge}>
                        {STATI_FATTURA[statoDi(fattura)].label}
                      </Badge>
                    </Td>
                    <Td etichetta="Pagamento" className="text-[13px]">
                      {METODI.find((m) => m.valore === fattura.metodoPagamento)?.label ?? '--'}
                    </Td>
                    <Td etichetta="Totale" allineamento="right" className="font-semibold text-ink">
                      {formatEuro(totaleFattura(fattura))}
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
              etichettaElementi="fatture"
              onCambiaPagina={elenco.vaiAPagina}
              onCambiaPerPagina={elenco.cambiaPerPagina}
            />
          </>
        )}
      </Card>

      <Modal
        aperta={dettaglio !== null}
        titolo={dettaglio ? `Fattura ${dettaglio.numero}` : ''}
        sottotitolo={dettaglio ? nomiClienti.get(dettaglio.clienteId) : undefined}
        onChiudi={() => {
          setDettaglio(null)
          if (idRotta) navigate('/fatture', { replace: true })
        }}
        piede={
          dettaglio && (
            <>
              {dettaglio.stato === 'pagata' ? (
                <Select
                  value="pagata"
                  onChange={(e) =>
                    cambiaStatoFattura(dettaglio, e.target.value as StatoFattura)
                  }
                  aria-label="Stato della fattura"
                  className="mr-auto w-52"
                >
                  <option value="pagata">Incassata</option>
                  <option value="emessa">Annulla l’incasso</option>
                  <option value="annullata">Storna la fattura</option>
                </Select>
              ) : (
                <Select
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    if (e.target.value === 'annullata') {
                      cambiaStatoFattura(dettaglio, 'annullata')
                      return
                    }
                    segnaPagata(dettaglio, e.target.value as MetodoPagamento)
                  }}
                  aria-label="Registra incasso"
                  className="mr-auto w-52"
                >
                  <option value="">Registra incasso…</option>
                  {METODI.map((metodo) => (
                    <option key={metodo.valore} value={metodo.valore}>
                      {metodo.label}
                    </option>
                  ))}
                  <option value="annullata">Storna la fattura</option>
                </Select>
              )}
              {fatturaModificabile(dettaglio) && (
                <Button onClick={() => apriModifica(dettaglio)}>
                  <Pencil size={15} />
                  Modifica
                </Button>
              )}
              {dettaglio.riparazioneId && (
                <Button onClick={() => navigate(`/riparazioni/${dettaglio.riparazioneId}`)}>
                  <Wrench size={15} />
                  Riparazione
                </Button>
              )}
              <Button variante="pericolo" onClick={() => setDaEliminare(dettaglio)}>
                <Trash2 size={15} />
                Elimina
              </Button>
              <Button variante="primario" onClick={() => setDaStampare(dettaglio)}>
                Stampa
              </Button>
            </>
          )
        }
      >
        {dettaglio && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Data emissione</dt>
                <dd className="text-ink">{formatData(dettaglio.data)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Scadenza</dt>
                <dd className="text-ink">{formatData(dettaglio.scadenza)}</dd>
              </div>
              {dettaglio.dataPagamento && (
                <div>
                  <dt className="text-xs text-ink-faint">Incassata il</dt>
                  <dd className="text-emerald-400">{formatData(dettaglio.dataPagamento)}</dd>
                </div>
              )}
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
                <dd>{formatEuro(imponibile(totaleFattura(dettaglio), dettaglio.iva))}</dd>
              </div>
              <div className="flex justify-between text-ink-muted">
                <dt>IVA {dettaglio.iva}%</dt>
                <dd>{formatEuro(scorporoIva(totaleFattura(dettaglio), dettaglio.iva))}</dd>
              </div>
              <div className="flex justify-between text-base font-bold text-ink">
                <dt>Totale documento</dt>
                <dd>{formatEuro(totaleFattura(dettaglio))}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      <AnteprimaStampa
        aperta={daStampare !== null}
        titolo={daStampare ? `Fattura ${daStampare.numero}` : ''}
        nomeFile={`fattura-${daStampare?.numero.replace(/[^\w-]/g, '') ?? ''}.html`}
        documento={
          daStampare && (
            <DocumentoCommerciale
              azienda={db.azienda}
              cliente={db.clienti.find((c) => c.id === daStampare.clienteId)}
              documento={daStampare}
              tipo="fattura"
              statoLabel={STATI_FATTURA[statoDi(daStampare)].label}
            />
          )
        }
        onChiudi={() => setDaStampare(null)}
      />

      <FormDocumento
        aperta={modulo !== null}
        tipo="fattura"
        iniziali={modulo}
        titolo={inModifica ? 'Modifica fattura' : 'Nuova fattura'}
        onSalva={salvaModulo}
        onChiudi={() => {
          setModulo(null)
          setInModifica(null)
        }}
      />

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare la fattura?"
        sottotitolo={daEliminare?.numero}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) eliminaFattura(daEliminare.id)
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
          Il documento sparisce dall’archivio e dalle statistiche. Per conservare traccia di una
          fattura emessa per errore è preferibile stornarla invece di eliminarla.
        </p>
      </Modal>
    </div>
  )
}

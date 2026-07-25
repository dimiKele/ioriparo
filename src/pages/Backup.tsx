import { useRef, useState } from 'react'
import { Database, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import { creaDatabaseIniziale } from '@/data/seed'
import { esportaCsv, esportaJson, nomeFileConData, numeroCsv } from '@/lib/esporta'
import { totaleFattura, totalePreventivo, totaleRighe, totaleRiparazione } from '@/lib/calcoli'
import { formatData } from '@/lib/format'
import {
  STATI_FATTURA,
  STATI_IMPIANTO,
  STATI_ORDINE,
  STATI_PREVENTIVO,
  STATI_RIPARAZIONE,
  TIPI_DISPOSITIVO,
} from '@/lib/stati'
import { ArchivioNonValido, preparaEsportazione, validaArchivio } from '@/lib/validaArchivio'
import type { DatabaseGestionale } from '@/types'

/** Oltre questa soglia il file non è un backup di questa applicazione. */
const DIMENSIONE_MASSIMA = 50 * 1024 * 1024

interface Proposta {
  db: DatabaseGestionale
  avvisi: string[]
  nomeFile: string
}

export function Backup() {
  useIntestazione({
    titolo: 'Backup / Esportazioni',
    sottotitolo: 'Salva una copia dell’archivio o esporta i dati in CSV',
  })

  const { db, importaDatabase } = useGestionale()
  const inputImport = useRef<HTMLInputElement>(null)
  const [esito, setEsito] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null)
  const [proposta, setProposta] = useState<Proposta | null>(null)

  function esportaTutto() {
    esportaJson(
      nomeFileConData('ioriparo-backup', 'json'),
      preparaEsportazione(db, new Date().toISOString()),
    )
    setEsito({ tipo: 'ok', testo: 'Backup completo esportato.' })
  }

  async function analizza(file: File) {
    setEsito(null)
    try {
      if (file.size > DIMENSIONE_MASSIMA) {
        throw new ArchivioNonValido('Il file è troppo grande per essere un backup IO RIPARO.')
      }
      const testo = await file.text()
      // La validazione avviene prima di toccare l'archivio in uso: un file
      // malformato non deve poter sostituire dati di lavoro.
      const { db: candidato, avvisi } = validaArchivio(JSON.parse(testo), creaDatabaseIniziale())
      setProposta({ db: candidato, avvisi, nomeFile: file.name })
    } catch (errore) {
      setProposta(null)
      setEsito({
        tipo: 'errore',
        testo:
          errore instanceof ArchivioNonValido
            ? errore.message
            : 'File non valido: attesa un’esportazione IO RIPARO.',
      })
    }
  }

  function confermaImport() {
    if (!proposta) return
    // Copia di sicurezza automatica: l'importazione è irreversibile.
    esportaJson(
      nomeFileConData('ioriparo-prima-del-ripristino', 'json'),
      preparaEsportazione(db, new Date().toISOString()),
    )
    importaDatabase(proposta.db)
    const riepilogo = proposta.avvisi.length
      ? ` ${proposta.avvisi.length} correzioni applicate.`
      : ''
    setEsito({ tipo: 'ok', testo: `Backup importato correttamente.${riepilogo}` })
    setProposta(null)
  }

  const conteggi = proposta
    ? [
        ['Clienti', proposta.db.clienti.length],
        ['Riparazioni', proposta.db.riparazioni.length],
        ['Preventivi', proposta.db.preventivi.length],
        ['Fatture', proposta.db.fatture.length],
        ['Magazzino', proposta.db.magazzino.length],
        ['Ordini', proposta.db.ordini.length],
        ['Scadenze', proposta.db.scadenze.length],
        ['Impianti', proposta.db.impianti.length],
      ]
    : []

  const esportazioni = [
    {
      titolo: 'Riparazioni',
      descrizione: `${db.riparazioni.length} schede di accettazione`,
      azione: () =>
        esportaCsv(
          nomeFileConData('riparazioni', 'csv'),
          ['ID', 'Cliente', 'Dispositivo', 'Tipo', 'Difetto', 'Stato', 'Accettazione', 'Totale'],
          db.riparazioni.map((r) => [
            r.codice,
            db.clienti.find((c) => c.id === r.clienteId)?.nome,
            `${r.marca} ${r.modello}`,
            TIPI_DISPOSITIVO[r.tipoDispositivo],
            r.difettoSegnalato,
            STATI_RIPARAZIONE[r.stato].label,
            formatData(r.dataAccettazione),
            numeroCsv(totaleRiparazione(r)),
          ]),
        ),
    },
    {
      titolo: 'Clienti',
      descrizione: `${db.clienti.length} anagrafiche`,
      azione: () =>
        esportaCsv(
          nomeFileConData('clienti', 'csv'),
          ['Nome', 'Tipo', 'Telefono', 'Email', 'Città', 'P.IVA', 'Cliente dal'],
          db.clienti.map((c) => [
            c.nome,
            c.tipo,
            c.telefono,
            c.email,
            c.citta,
            c.partitaIva,
            formatData(c.creatoIl),
          ]),
        ),
    },
    {
      titolo: 'Fatture',
      descrizione: `${db.fatture.length} documenti emessi`,
      azione: () =>
        esportaCsv(
          nomeFileConData('fatture', 'csv'),
          ['Numero', 'Cliente', 'Data', 'Stato', 'Metodo', 'Totale'],
          db.fatture.map((f) => [
            f.numero,
            db.clienti.find((c) => c.id === f.clienteId)?.nome,
            formatData(f.data),
            STATI_FATTURA[f.stato].label,
            f.metodoPagamento,
            numeroCsv(totaleFattura(f)),
          ]),
        ),
    },
    {
      titolo: 'Preventivi',
      descrizione: `${db.preventivi.length} proposte`,
      azione: () =>
        esportaCsv(
          nomeFileConData('preventivi', 'csv'),
          ['Numero', 'Cliente', 'Data', 'Stato', 'Totale'],
          db.preventivi.map((p) => [
            p.numero,
            db.clienti.find((c) => c.id === p.clienteId)?.nome,
            formatData(p.data),
            STATI_PREVENTIVO[p.stato].label,
            numeroCsv(totalePreventivo(p)),
          ]),
        ),
    },
    {
      titolo: 'Magazzino',
      descrizione: `${db.magazzino.length} articoli a catalogo`,
      azione: () =>
        esportaCsv(
          nomeFileConData('magazzino', 'csv'),
          ['Codice', 'Articolo', 'Categoria', 'Giacenza', 'Scorta minima', 'Acquisto', 'Vendita'],
          db.magazzino.map((a) => [
            a.codice,
            a.nome,
            a.categoria,
            a.quantita,
            a.scorta_minima,
            numeroCsv(a.prezzoAcquisto),
            numeroCsv(a.prezzoVendita),
          ]),
        ),
    },
    {
      titolo: 'Ordini fornitori',
      descrizione: `${db.ordini.length} ordini`,
      azione: () =>
        esportaCsv(
          nomeFileConData('ordini', 'csv'),
          ['Numero', 'Fornitore', 'Data', 'Consegna prevista', 'Stato', 'Righe', 'Totale'],
          db.ordini.map((o) => [
            o.numero,
            o.fornitore,
            formatData(o.data),
            formatData(o.consegnaPrevista),
            STATI_ORDINE[o.stato].label,
            o.righe.length,
            numeroCsv(totaleRighe(o.righe)),
          ]),
        ),
    },
    {
      titolo: 'Scadenze',
      descrizione: `${db.scadenze.length} promemoria`,
      azione: () =>
        esportaCsv(
          nomeFileConData('scadenze', 'csv'),
          ['Titolo', 'Descrizione', 'Tipo', 'Priorità', 'Data', 'Importo', 'Completata'],
          db.scadenze.map((s) => [
            s.titolo,
            s.descrizione,
            s.tipo,
            s.priorita,
            formatData(s.data),
            numeroCsv(s.importo),
            s.completata ? 'sì' : 'no',
          ]),
        ),
    },
    {
      titolo: 'Impianti',
      descrizione: `${db.impianti.length} installazioni`,
      azione: () =>
        esportaCsv(
          nomeFileConData('impianti', 'csv'),
          ['Nome', 'Cliente', 'Tipologia', 'Indirizzo', 'Installazione', 'Manutenzione', 'Stato'],
          db.impianti.map((i) => [
            i.nome,
            db.clienti.find((c) => c.id === i.clienteId)?.nome,
            i.tipologia,
            i.indirizzo,
            formatData(i.dataInstallazione),
            formatData(i.prossimaManutenzione),
            STATI_IMPIANTO[i.stato].label,
          ]),
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titolo="Backup completo"
            sottotitolo="Un unico file JSON con tutto l’archivio"
          />
          <p className="mt-3 text-sm text-ink-muted">
            Contiene clienti, riparazioni, preventivi, fatture, magazzino, ordini, scadenze e
            impianti. Conservalo per trasferire i dati su un altro dispositivo.
          </p>
          <Button variante="primario" className="mt-4" onClick={esportaTutto}>
            <Database size={15} />
            Esporta backup JSON
          </Button>
        </Card>

        <Card>
          <CardHeader titolo="Ripristino" sottotitolo="Importa un backup esportato in precedenza" />
          <p className="mt-3 text-sm text-ink-muted">
            L’importazione sostituisce integralmente i dati presenti nel browser. Il file viene
            prima controllato e ti viene mostrato un riepilogo; una copia dell’archivio attuale
            viene scaricata automaticamente prima di procedere.
          </p>
          <Button className="mt-4" onClick={() => inputImport.current?.click()}>
            <Upload size={15} />
            Importa backup JSON
          </Button>
          <input
            ref={inputImport}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void analizza(file)
              e.target.value = ''
            }}
          />

          {esito && (
            <p
              className={
                esito.tipo === 'ok' ? 'mt-3 text-sm text-emerald-400' : 'mt-3 text-sm text-rose-400'
              }
            >
              {esito.testo}
            </p>
          )}
        </Card>
      </div>

      <Card padding={false}>
        <div className="p-5 pb-2">
          <CardHeader
            titolo="Esportazioni CSV"
            sottotitolo="Compatibili con Excel e con il commercialista"
          />
        </div>
        <ul className="divide-y divide-line">
          {esportazioni.map((voce) => (
            <li key={voce.titolo} className="flex items-center gap-4 px-5 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
                <FileSpreadsheet size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-ink">{voce.titolo}</span>
                <span className="block text-[11px] text-ink-faint">{voce.descrizione}</span>
              </span>
              <Button dimensione="sm" onClick={voce.azione}>
                <Download size={14} />
                CSV
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Modal
        aperta={proposta !== null}
        titolo="Confermi il ripristino?"
        sottotitolo={proposta?.nomeFile}
        onChiudi={() => setProposta(null)}
        piede={
          <>
            <Button onClick={() => setProposta(null)}>Annulla</Button>
            <Button variante="pericolo" onClick={confermaImport}>
              Sostituisci l’archivio
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          I dati attualmente nel browser verranno <strong className="text-ink">sostituiti</strong>{' '}
          da quelli del file. Prima di procedere viene scaricata automaticamente una copia
          dell’archivio attuale.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {conteggi.map(([etichetta, quantita]) => (
            <div key={etichetta} className="rounded-lg bg-surface-2 px-3 py-2">
              <dt className="text-[11px] text-ink-faint">{etichetta}</dt>
              <dd className="text-sm font-semibold text-ink">{quantita}</dd>
            </div>
          ))}
        </dl>

        {proposta && proposta.avvisi.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-[13px] font-semibold text-amber-300">
              Il file contiene dati da correggere
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] text-ink-muted">
              {proposta.avvisi.map((avviso) => (
                <li key={avviso}>{avviso}</li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}

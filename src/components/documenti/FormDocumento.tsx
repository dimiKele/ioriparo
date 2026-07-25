import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useGestionale } from '@/data/store'
import { imponibile, scorporoIva, totaleRighe } from '@/lib/calcoli'
import { formatEuro } from '@/lib/format'
import { rigaVuota } from '@/lib/documenti'
import type { RigaIntervento } from '@/types'

export interface DatiDocumento {
  clienteId: string
  numero: string
  data: string
  /** Scadenza della fattura o validità del preventivo. */
  termine: string
  iva: number
  righe: RigaIntervento[]
  note: string
  riparazioneId?: string
}

/**
 * Modulo di creazione e modifica di preventivi e fatture.
 *
 * I due documenti condividono struttura e calcoli: cambiano solo le etichette
 * e il campo di scadenza, quindi conviene un modulo solo.
 */
export function FormDocumento({
  aperta,
  tipo,
  iniziali,
  titolo,
  onSalva,
  onChiudi,
}: {
  aperta: boolean
  tipo: 'preventivo' | 'fattura'
  iniziali: DatiDocumento | null
  titolo: string
  onSalva: (dati: DatiDocumento) => void
  onChiudi: () => void
}) {
  const { db } = useGestionale()
  const [dati, setDati] = useState<DatiDocumento | null>(iniziali)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    setDati(iniziali)
    setErrore('')
  }, [iniziali])

  if (!aperta || !dati) return null

  const documento = dati

  const modifica = (modifiche: Partial<DatiDocumento>) => {
    setDati((precedenti) => (precedenti ? { ...precedenti, ...modifiche } : precedenti))
    setErrore('')
  }

  const modificaRiga = (id: string, modifiche: Partial<RigaIntervento>) => {
    setDati((precedenti) =>
      precedenti
        ? {
            ...precedenti,
            righe: precedenti.righe.map((riga) =>
              riga.id === id ? { ...riga, ...modifiche } : riga,
            ),
          }
        : precedenti,
    )
  }

  /** Selezionando un ricambio si compilano descrizione e prezzo di listino. */
  const collegaArticolo = (id: string, articoloId: string) => {
    const articolo = db.magazzino.find((a) => a.id === articoloId)
    modificaRiga(id, {
      articoloId: articoloId || undefined,
      ...(articolo ? { descrizione: articolo.nome, prezzoUnitario: articolo.prezzoVendita } : {}),
    })
  }

  const salva = () => {
    if (!documento.clienteId) {
      setErrore('Seleziona il cliente intestatario.')
      return
    }
    if (!documento.data) {
      setErrore('Indica la data del documento.')
      return
    }
    const valide = documento.righe.filter((riga) => riga.descrizione.trim() !== '')
    if (valide.length === 0) {
      setErrore('Aggiungi almeno una riga con descrizione.')
      return
    }
    if (valide.some((riga) => !Number.isFinite(riga.quantita) || riga.quantita <= 0)) {
      setErrore('Le quantità devono essere maggiori di zero.')
      return
    }
    if (valide.some((riga) => !Number.isFinite(riga.prezzoUnitario))) {
      setErrore('Controlla i prezzi inseriti.')
      return
    }
    if (documento.termine && documento.termine < documento.data) {
      setErrore(
        tipo === 'fattura'
          ? 'La scadenza non può precedere la data di emissione.'
          : 'La validità non può precedere la data del preventivo.',
      )
      return
    }

    onSalva({ ...documento, righe: valide })
  }

  const totale = totaleRighe(documento.righe)

  return (
    <Modal
      aperta={aperta}
      titolo={titolo}
      sottotitolo={documento.numero}
      onChiudi={onChiudi}
      larghezza="lg"
      piede={
        <>
          <Button onClick={onChiudi}>Annulla</Button>
          <Button variante="primario" onClick={salva}>
            Salva {tipo}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etichetta="Cliente" obbligatorio className="sm:col-span-2">
            <Select
              value={documento.clienteId}
              onChange={(e) => modifica({ clienteId: e.target.value })}
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

          <Campo etichetta="Numero">
            <Input value={documento.numero} onChange={(e) => modifica({ numero: e.target.value })} />
          </Campo>

          <Campo etichetta="IVA (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={documento.iva}
              onChange={(e) => modifica({ iva: Number(e.target.value) })}
            />
          </Campo>

          <Campo etichetta="Data" obbligatorio>
            <Input
              type="date"
              value={documento.data}
              onChange={(e) => modifica({ data: e.target.value })}
            />
          </Campo>

          <Campo etichetta={tipo === 'fattura' ? 'Scadenza pagamento' : 'Valido fino al'}>
            <Input
              type="date"
              value={documento.termine}
              min={documento.data}
              onChange={(e) => modifica({ termine: e.target.value })}
            />
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
              Righe del documento
            </p>
            <Button
              dimensione="sm"
              onClick={() => modifica({ righe: [...documento.righe, rigaVuota()] })}
            >
              <Plus size={14} />
              Aggiungi riga
            </Button>
          </div>

          <ul className="space-y-2">
            {documento.righe.map((riga) => (
              <li
                key={riga.id}
                className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_5rem_7rem_7rem_2rem]"
              >
                <div className="col-span-2 space-y-2 sm:col-span-1">
                  <Input
                    value={riga.descrizione}
                    onChange={(e) => modificaRiga(riga.id, { descrizione: e.target.value })}
                    placeholder="Descrizione della voce"
                    aria-label="Descrizione"
                  />
                  <Select
                    value={riga.articoloId ?? ''}
                    onChange={(e) => collegaArticolo(riga.id, e.target.value)}
                    aria-label="Ricambio collegato"
                    className="h-8 text-xs"
                  >
                    <option value="">Nessun ricambio collegato</option>
                    {db.magazzino.map((articolo) => (
                      <option key={articolo.id} value={articolo.id}>
                        {articolo.nome} — {formatEuro(articolo.prezzoVendita)}
                      </option>
                    ))}
                  </Select>
                </div>

                <Input
                  type="number"
                  min={1}
                  value={riga.quantita}
                  onChange={(e) => modificaRiga(riga.id, { quantita: Number(e.target.value) })}
                  aria-label="Quantità"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={riga.prezzoUnitario}
                  onChange={(e) =>
                    modificaRiga(riga.id, { prezzoUnitario: Number(e.target.value) })
                  }
                  aria-label="Prezzo unitario"
                />
                <span className="self-center text-right text-[13px] font-semibold text-ink">
                  {formatEuro(riga.quantita * riga.prezzoUnitario)}
                </span>
                <span className="self-center justify-self-end">
                  <IconButton
                    etichetta="Rimuovi riga"
                    onClick={() =>
                      modifica({ righe: documento.righe.filter((voce) => voce.id !== riga.id) })
                    }
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              </li>
            ))}
            {documento.righe.length === 0 && (
              <li className="rounded-lg border border-dashed border-line-soft py-6 text-center text-xs text-ink-faint">
                Nessuna riga: aggiungine una per comporre il documento.
              </li>
            )}
          </ul>

          <p className="mt-2 text-[11px] text-ink-faint">
            I prezzi sono IVA inclusa. Per uno sconto o un acconto già versato usa un importo
            negativo.
          </p>
        </div>

        <Campo etichetta="Note">
          <Textarea
            value={documento.note}
            onChange={(e) => modifica({ note: e.target.value })}
            placeholder="Condizioni, tempi di consegna, riferimenti…"
            className="min-h-16"
          />
        </Campo>

        <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-ink-muted">
            <dt>Imponibile</dt>
            <dd>{formatEuro(imponibile(totale, documento.iva))}</dd>
          </div>
          <div className="flex justify-between text-ink-muted">
            <dt>IVA {documento.iva}%</dt>
            <dd>{formatEuro(scorporoIva(totale, documento.iva))}</dd>
          </div>
          <div className="flex justify-between text-base font-bold text-ink">
            <dt>Totale</dt>
            <dd>{formatEuro(totale)}</dd>
          </div>
        </dl>

        {errore && <p className="text-[13px] text-rose-400">{errore}</p>}
      </div>
    </Modal>
  )
}

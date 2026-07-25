import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  Download,
  History,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
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
import { useGestionale } from '@/data/store'
import { articoliSottoScorta, valoreMagazzino } from '@/data/metriche'
import { useElenco } from '@/lib/useElenco'
import { esportaCsv, nomeFileConData, numeroCsv } from '@/lib/esporta'
import { margine } from '@/lib/calcoli'
import { CAUSALI_MOVIMENTO } from '@/lib/stati'
import { cn } from '@/lib/cn'
import { formatDataOra, formatEuro } from '@/lib/format'
import type { ArticoloMagazzino } from '@/types'

const VUOTO = {
  codice: '',
  nome: '',
  categoria: '',
  fornitore: '',
  quantita: '0',
  scorta_minima: '2',
  prezzoAcquisto: '',
  prezzoVendita: '',
  ubicazione: '',
}

export function Magazzino() {
  useIntestazione({
    titolo: 'Magazzino',
    sottotitolo: 'Ricambi, accessori e disponibilità',
  })

  const { db, aggiungiArticolo, aggiornaArticolo, eliminaArticolo, muoviGiacenze, movimentiArticolo } =
    useGestionale()
  const [parametri, setParametri] = useSearchParams()

  const [ricerca, setRicerca] = useState('')
  const [categoria, setCategoria] = useState('tutte')
  const [soloSottoScorta, setSoloSottoScorta] = useState(false)
  const [form, setForm] = useState<typeof VUOTO | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<ArticoloMagazzino | null>(null)
  const [storicoDi, setStoricoDi] = useState<ArticoloMagazzino | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    if (parametri.get('nuovo') === '1') {
      setForm({ ...VUOTO })
      setParametri({}, { replace: true })
    }
  }, [parametri, setParametri])

  const categorie = useMemo(
    () => [...new Set(db.magazzino.map((a) => a.categoria))].sort((a, b) => a.localeCompare(b, 'it')),
    [db.magazzino],
  )

  const sottoScorta = useMemo(() => articoliSottoScorta(db), [db])

  const filtrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    return db.magazzino.filter((articolo) => {
      if (categoria !== 'tutte' && articolo.categoria !== categoria) return false
      if (
        soloSottoScorta &&
        !(articolo.scorta_minima > 0 && articolo.quantita <= articolo.scorta_minima)
      ) {
        return false
      }
      if (!termine) return true
      return [articolo.codice, articolo.nome, articolo.fornitore ?? '', articolo.ubicazione ?? '']
        .join(' ')
        .toLowerCase()
        .includes(termine)
    })
  }, [db.magazzino, ricerca, categoria, soloSottoScorta])

  const elenco = useElenco(filtrati, {
    perPaginaIniziale: 10,
    ordinamentoIniziale: { campo: 'nome', direzione: 'asc' },
  })

  const movimenti = storicoDi ? movimentiArticolo(storicoDi.id) : []

  /** Quante righe di documenti citano l'articolo in eliminazione. */
  const riferimentiArticolo = useMemo(() => {
    if (!daEliminare) return 0
    const conta = (righe: Array<{ articoloId?: string }>) =>
      righe.filter((riga) => riga.articoloId === daEliminare.id).length
    return (
      db.riparazioni.reduce((somma, r) => somma + conta(r.interventi), 0) +
      db.preventivi.reduce((somma, p) => somma + conta(p.righe), 0) +
      db.fatture.reduce((somma, f) => somma + conta(f.righe), 0) +
      db.ordini.reduce((somma, o) => somma + conta(o.righe), 0)
    )
  }, [daEliminare, db])

  /** Codice univoco derivato dal nome quando l'utente non ne indica uno. */
  function codiceAutomatico(nome: string, escludiId: string | null): string {
    const base =
      nome
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 8) || 'ART'
    const presi = new Set(
      db.magazzino.filter((a) => a.id !== escludiId).map((a) => a.codice.toUpperCase()),
    )
    if (!presi.has(base)) return base
    let contatore = 2
    while (presi.has(`${base}-${contatore}`)) contatore += 1
    return `${base}-${contatore}`
  }

  function salva() {
    if (!form) return
    const quantita = Number.parseInt(form.quantita, 10)
    const scorta = Number.parseInt(form.scorta_minima, 10)
    const acquisto = Number.parseFloat(form.prezzoAcquisto.replace(',', '.'))
    const vendita = Number.parseFloat(form.prezzoVendita.replace(',', '.'))

    if (!form.nome.trim()) {
      setErrore('Il nome dell’articolo è obbligatorio.')
      return
    }
    if (!Number.isFinite(vendita) || vendita < 0) {
      setErrore('Indica un prezzo di vendita pari o superiore a zero.')
      return
    }
    if (Number.isFinite(acquisto) && acquisto < 0) {
      setErrore('Il prezzo di acquisto non può essere negativo.')
      return
    }
    // Una giacenza negativa falsa il valore di magazzino e gli avvisi di scorta.
    if (Number.isFinite(quantita) && quantita < 0) {
      setErrore('La giacenza non può essere negativa.')
      return
    }
    if (Number.isFinite(scorta) && scorta < 0) {
      setErrore('La scorta minima non può essere negativa.')
      return
    }

    const codice = form.codice.trim().toUpperCase()
    if (
      codice &&
      db.magazzino.some((a) => a.id !== inModifica && a.codice.toUpperCase() === codice)
    ) {
      setErrore(`Il codice ${codice} è già usato da un altro articolo.`)
      return
    }

    const nuovaQuantita = Number.isFinite(quantita) ? quantita : 0
    const dati = {
      codice: codice || codiceAutomatico(form.nome, inModifica),
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || 'Varie',
      fornitore: form.fornitore.trim() || undefined,
      quantita: nuovaQuantita,
      scorta_minima: Number.isFinite(scorta) ? scorta : 0,
      prezzoAcquisto: Number.isFinite(acquisto) ? acquisto : 0,
      prezzoVendita: vendita,
      ubicazione: form.ubicazione.trim() || undefined,
    }

    if (inModifica) {
      const precedente = db.magazzino.find((a) => a.id === inModifica)
      aggiornaArticolo(inModifica, dati)
      // La rettifica della giacenza passa dal registro, così resta tracciata
      // come tutte le altre variazioni.
      if (precedente && precedente.quantita !== nuovaQuantita) {
        muoviGiacenze([
          {
            articoloId: inModifica,
            delta: nuovaQuantita - precedente.quantita,
            causale: 'inventario',
          },
        ])
      }
    } else {
      const creato = aggiungiArticolo({ ...dati, quantita: 0 })
      if (nuovaQuantita !== 0) {
        muoviGiacenze([
          { articoloId: creato.id, delta: nuovaQuantita, causale: 'inventario' },
        ])
      }
    }

    chiudiForm()
  }

  function chiudiForm() {
    setForm(null)
    setInModifica(null)
    setErrore('')
  }

  function apriModifica(articolo: ArticoloMagazzino) {
    setInModifica(articolo.id)
    setErrore('')
    setForm({
      codice: articolo.codice,
      nome: articolo.nome,
      categoria: articolo.categoria,
      fornitore: articolo.fornitore ?? '',
      quantita: String(articolo.quantita),
      scorta_minima: String(articolo.scorta_minima),
      prezzoAcquisto: String(articolo.prezzoAcquisto),
      prezzoVendita: String(articolo.prezzoVendita),
      ubicazione: articolo.ubicazione ?? '',
    })
  }

  /** Carico e scarico rapido dalla riga della tabella. */
  function muoviGiacenza(articolo: ArticoloMagazzino, delta: number) {
    muoviGiacenze([{ articoloId: articolo.id, delta, causale: 'rettifica_manuale' }])
  }

  function esporta() {
    esportaCsv(
      nomeFileConData('magazzino', 'csv'),
      [
        'Codice',
        'Articolo',
        'Categoria',
        'Fornitore',
        'Giacenza',
        'Scorta minima',
        'Prezzo acquisto',
        'Prezzo vendita',
        'Ubicazione',
      ],
      filtrati.map((a) => [
        a.codice,
        a.nome,
        a.categoria,
        a.fornitore,
        a.quantita,
        a.scorta_minima,
        numeroCsv(a.prezzoAcquisto),
        numeroCsv(a.prezzoVendita),
        a.ubicazione,
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={esporta}>
          <Download size={15} />
          Esporta
        </Button>
        <Button
          variante="primario"
          onClick={() => {
            setInModifica(null)
            setErrore('')
            setForm({ ...VUOTO })
          }}
        >
          <Plus size={16} />
          Nuovo articolo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip
          etichetta="Articoli a catalogo"
          valore={db.magazzino.length}
          icona={Boxes}
          colore="#2563eb"
          attivo={!soloSottoScorta && categoria === 'tutte'}
          onClick={() => {
            setSoloSottoScorta(false)
            setCategoria('tutte')
          }}
        />
        <StatChip
          etichetta="Sotto scorta"
          valore={sottoScorta.length}
          icona={AlertTriangle}
          colore="#f43f5e"
          attivo={soloSottoScorta}
          onClick={() => {
            setSoloSottoScorta((attivo) => !attivo)
            elenco.azzeraPagina()
          }}
        />
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Pezzi in giacenza
          </p>
          <p className="mt-1 flex items-center gap-2 text-xl font-bold text-ink">
            <Package size={18} className="text-ink-faint" />
            {db.magazzino.reduce((somma, a) => somma + a.quantita, 0)}
          </p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Valore di magazzino
          </p>
          <p className="mt-1 flex items-center gap-2 text-xl font-bold text-ink">
            <TrendingUp size={18} className="text-ink-faint" />
            {formatEuro(valoreMagazzino(db))}
          </p>
        </Card>
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
              placeholder="Cerca articolo, codice, fornitore…"
              aria-label="Cerca articolo"
              className="pl-9"
            />
          </div>

          <Select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value)
              elenco.azzeraPagina()
            }}
            aria-label="Filtra per categoria"
            className="sm:w-52"
          >
            <option value="tutte">Tutte le categorie</option>
            {categorie.map((valore) => (
              <option key={valore} value={valore}>
                {valore}
              </option>
            ))}
          </Select>
        </div>

        {elenco.totale === 0 ? (
          <StatoVuoto titolo="Nessun articolo trovato" />
        ) : (
          <>
            <Tabella larghezzaMinima="sm:min-w-[900px]">
              <TabellaHead>
                <Th>Codice</Th>
                <Th>Articolo</Th>
                <Th>Categoria</Th>
                <Th allineamento="center">Giacenza</Th>
                <Th allineamento="right">Acquisto</Th>
                <Th allineamento="right">Vendita</Th>
                <Th allineamento="center">Margine</Th>
                <Th allineamento="right">Azioni</Th>
              </TabellaHead>
              <tbody>
                {elenco.visibili.map((articolo) => {
                  const critico = articolo.quantita <= articolo.scorta_minima
                  return (
                    <Tr key={articolo.id}>
                      <Td className="font-mono text-xs whitespace-nowrap">{articolo.codice}</Td>
                      <Td>
                        <span className="block text-[13px] font-medium text-ink">
                          {articolo.nome}
                        </span>
                        <span className="block text-[11px] text-ink-faint">
                          {articolo.fornitore ?? 'Fornitore non indicato'}
                          {articolo.ubicazione ? ` · ${articolo.ubicazione}` : ''}
                        </span>
                      </Td>
                      <Td className="text-[13px]">{articolo.categoria}</Td>
                      <Td allineamento="center">
                        <span className="flex items-center justify-center gap-1.5">
                          <IconButton
                            etichetta="Scarica un pezzo"
                            onClick={() => muoviGiacenza(articolo, -1)}
                          >
                            <Minus size={14} />
                          </IconButton>
                          <span
                            className={
                              critico
                                ? 'w-8 font-semibold text-rose-400'
                                : 'w-8 font-semibold text-ink'
                            }
                          >
                            {articolo.quantita}
                          </span>
                          <IconButton
                            etichetta="Carica un pezzo"
                            onClick={() => muoviGiacenza(articolo, 1)}
                          >
                            <Plus size={14} />
                          </IconButton>
                        </span>
                        {critico && (
                          <span className="mt-1.5 block">
                            <Badge className="border-rose-500/30 bg-rose-500/12 text-rose-300">
                              Sotto scorta
                            </Badge>
                          </span>
                        )}
                      </Td>
                      <Td allineamento="right">{formatEuro(articolo.prezzoAcquisto)}</Td>
                      <Td allineamento="right" className="font-semibold text-ink">
                        {formatEuro(articolo.prezzoVendita)}
                      </Td>
                      <Td allineamento="center" className="text-[13px] text-emerald-400">
                        {margine(articolo.prezzoAcquisto, articolo.prezzoVendita).toFixed(0)}%
                      </Td>
                      <Td allineamento="right">
                        <span className="flex justify-end gap-1.5">
                          <Button
                            dimensione="sm"
                            onClick={() => setStoricoDi(articolo)}
                            aria-label="Storico movimenti"
                          >
                            <History size={14} />
                          </Button>
                          <Button
                            dimensione="sm"
                            variante="primario"
                            onClick={() => apriModifica(articolo)}
                            aria-label="Modifica articolo"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            dimensione="sm"
                            variante="pericolo"
                            onClick={() => setDaEliminare(articolo)}
                            aria-label="Elimina articolo"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Tabella>

            <Paginazione
              pagina={elenco.pagina}
              pagine={elenco.pagine}
              totale={elenco.totale}
              primoElemento={elenco.primoElemento}
              ultimoElemento={elenco.ultimoElemento}
              perPagina={elenco.perPagina}
              etichettaElementi="articoli"
              onCambiaPagina={elenco.vaiAPagina}
              onCambiaPerPagina={elenco.cambiaPerPagina}
            />
          </>
        )}
      </Card>

      <Modal
        aperta={form !== null}
        titolo={inModifica ? 'Modifica articolo' : 'Nuovo articolo'}
        onChiudi={chiudiForm}
        piede={
          <>
            <Button onClick={chiudiForm}>Annulla</Button>
            <Button variante="primario" onClick={salva}>
              Salva articolo
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etichetta="Nome articolo" obbligatorio className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </Campo>
            <Campo etichetta="Codice">
              <Input
                value={form.codice}
                onChange={(e) => setForm({ ...form, codice: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Categoria">
              <Input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                list="categorie-magazzino"
              />
            </Campo>
            <Campo etichetta="Fornitore" className="sm:col-span-2">
              <Input
                value={form.fornitore}
                onChange={(e) => setForm({ ...form, fornitore: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Giacenza">
              <Input
                type="number"
                min={0}
                value={form.quantita}
                onChange={(e) => setForm({ ...form, quantita: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Scorta minima">
              <Input
                type="number"
                min={0}
                value={form.scorta_minima}
                onChange={(e) => setForm({ ...form, scorta_minima: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Prezzo acquisto (€)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.prezzoAcquisto}
                onChange={(e) => setForm({ ...form, prezzoAcquisto: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Prezzo vendita (€)" obbligatorio>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.prezzoVendita}
                onChange={(e) => setForm({ ...form, prezzoVendita: e.target.value })}
              />
            </Campo>
            <Campo etichetta="Ubicazione" className="sm:col-span-2">
              <Input
                value={form.ubicazione}
                onChange={(e) => setForm({ ...form, ubicazione: e.target.value })}
                placeholder="A1-03"
              />
            </Campo>

            {errore && <p className="text-xs text-rose-400 sm:col-span-2">{errore}</p>}
          </div>
        )}
      </Modal>

      <datalist id="categorie-magazzino">
        {categorie.map((valore) => (
          <option key={valore} value={valore} />
        ))}
      </datalist>

      <Modal
        aperta={storicoDi !== null}
        titolo="Movimenti di magazzino"
        sottotitolo={storicoDi ? `${storicoDi.nome} · ${storicoDi.quantita} pz in giacenza` : ''}
        onChiudi={() => setStoricoDi(null)}
        piede={<Button onClick={() => setStoricoDi(null)}>Chiudi</Button>}
      >
        {storicoDi &&
          (movimenti.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              Nessun movimento registrato per questo articolo. Il registro parte dal momento in cui
              è stato introdotto: le giacenze precedenti non hanno una storia.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {movimenti.map((movimento) => (
                <li key={movimento.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      'w-14 shrink-0 text-right text-sm font-bold',
                      movimento.delta > 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    {movimento.delta > 0 ? '+' : ''}
                    {movimento.delta}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink">
                      {CAUSALI_MOVIMENTO[movimento.causale]}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {formatDataOra(movimento.istante)}
                      {movimento.riferimento ? ` · ${movimento.riferimento}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] text-ink-muted">
                    {movimento.giacenzaFinale} pz
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </Modal>

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare l'articolo?"
        sottotitolo={daEliminare?.nome}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) eliminaArticolo(daEliminare.id)
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
          L'articolo sparisce dal catalogo; i documenti già emessi non vengono modificati.
        </p>
        {riferimentiArticolo > 0 && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-ink-muted">
            L’articolo è citato in <strong className="text-ink">{riferimentiArticolo}</strong> tra
            riparazioni, preventivi, fatture e ordini. Le righe restano leggibili, ma i ricavi
            passeranno alla categoria «Manodopera e servizi» nelle statistiche.
          </p>
        )}
      </Modal>
    </div>
  )
}

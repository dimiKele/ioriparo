import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Download, Eye, Pencil, Plus, Search, Trash2, User, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Form'
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
import { useElenco } from '@/lib/useElenco'
import { esportaCsv, nomeFileConData } from '@/lib/esporta'
import { formatData, iniziali } from '@/lib/format'
import type { Cliente, TipoCliente } from '@/types'

const VUOTO = {
  nome: '',
  tipo: 'privato' as TipoCliente,
  telefono: '',
  email: '',
  indirizzo: '',
  citta: '',
  cap: '',
  partitaIva: '',
  codiceFiscale: '',
  note: '',
}

export function ClientiList() {
  useIntestazione({
    titolo: 'Clienti',
    sottotitolo: 'Anagrafica clienti privati e aziende',
  })

  const { db, aggiungiCliente, aggiornaCliente, eliminaCliente } = useGestionale()
  const navigate = useNavigate()
  const [parametri, setParametri] = useSearchParams()

  const [ricerca, setRicerca] = useState('')
  const [tipo, setTipo] = useState<TipoCliente | 'tutti'>('tutti')
  const [form, setForm] = useState<typeof VUOTO | null>(null)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Cliente | null>(null)
  const [errore, setErrore] = useState('')

  // La dashboard può aprire direttamente il modulo di inserimento.
  useEffect(() => {
    if (parametri.get('nuovo') === '1') {
      setForm({ ...VUOTO })
      setParametri({}, { replace: true })
    }
  }, [parametri, setParametri])

  const filtrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    return db.clienti.filter((cliente) => {
      if (tipo !== 'tutti' && cliente.tipo !== tipo) return false
      if (!termine) return true
      return [
        cliente.nome,
        cliente.telefono,
        cliente.email ?? '',
        cliente.citta ?? '',
        cliente.partitaIva ?? '',
        cliente.codiceFiscale ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(termine)
    })
  }, [db.clienti, ricerca, tipo])

  const elenco = useElenco(filtrati, {
    perPaginaIniziale: 10,
    ordinamentoIniziale: { campo: 'nome', direzione: 'asc' },
  })

  /** Documenti che resterebbero orfani eliminando il cliente selezionato. */
  const collegamentiCliente = useMemo(() => {
    if (!daEliminare) return { totale: 0, voci: [] as Array<[string, number]> }
    const id = daEliminare.id
    const voci: Array<[string, number]> = [
      ['riparazioni', db.riparazioni.filter((r) => r.clienteId === id).length],
      ['preventivi', db.preventivi.filter((p) => p.clienteId === id).length],
      ['fatture', db.fatture.filter((f) => f.clienteId === id).length],
      ['impianti', db.impianti.filter((i) => i.clienteId === id).length],
    ]
    const presenti = voci.filter(([, quantita]) => quantita > 0)
    return { totale: presenti.reduce((somma, [, q]) => somma + q, 0), voci: presenti }
  }, [daEliminare, db])

  const riparazioniPerCliente = useMemo(() => {
    const mappa = new Map<string, number>()
    for (const riparazione of db.riparazioni) {
      mappa.set(riparazione.clienteId, (mappa.get(riparazione.clienteId) ?? 0) + 1)
    }
    return mappa
  }, [db.riparazioni])

  function salva() {
    if (!form) return
    if (!form.nome.trim() || !form.telefono.trim()) {
      setErrore('Nome e telefono sono obbligatori.')
      return
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrore('Indirizzo email non valido.')
      return
    }

    const dati = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      telefono: form.telefono.trim(),
      email: form.email.trim() || undefined,
      indirizzo: form.indirizzo.trim() || undefined,
      citta: form.citta.trim() || undefined,
      cap: form.cap.trim() || undefined,
      // Il campo fiscale non pertinente al tipo non va conservato: resterebbe
      // invisibile nel modulo ma presente in anagrafica e nei backup.
      partitaIva: form.tipo === 'azienda' ? form.partitaIva.trim() || undefined : undefined,
      codiceFiscale: form.tipo === 'privato' ? form.codiceFiscale.trim() || undefined : undefined,
      note: form.note.trim() || undefined,
    }

    if (inModifica) aggiornaCliente(inModifica, dati)
    else aggiungiCliente(dati)

    chiudiForm()
  }

  function chiudiForm() {
    setForm(null)
    setInModifica(null)
    setErrore('')
  }

  function apriModifica(cliente: Cliente) {
    setInModifica(cliente.id)
    setErrore('')
    setForm({
      nome: cliente.nome,
      tipo: cliente.tipo,
      telefono: cliente.telefono,
      email: cliente.email ?? '',
      indirizzo: cliente.indirizzo ?? '',
      citta: cliente.citta ?? '',
      cap: cliente.cap ?? '',
      partitaIva: cliente.partitaIva ?? '',
      codiceFiscale: cliente.codiceFiscale ?? '',
      note: cliente.note ?? '',
    })
  }

  function esporta() {
    esportaCsv(
      nomeFileConData('clienti', 'csv'),
      ['Nome', 'Tipo', 'Telefono', 'Email', 'Indirizzo', 'CAP', 'Città', 'P.IVA', 'Cliente dal'],
      filtrati.map((c) => [
        c.nome,
        c.tipo,
        c.telefono,
        c.email,
        c.indirizzo,
        c.cap,
        c.citta,
        c.partitaIva,
        formatData(c.creatoIl),
      ]),
    )
  }

  const privati = db.clienti.filter((c) => c.tipo === 'privato').length

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
          Nuovo cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatChip
          etichetta="Clienti totali"
          valore={db.clienti.length}
          icona={Users}
          colore="#2563eb"
          attivo={tipo === 'tutti'}
          onClick={() => setTipo('tutti')}
        />
        <StatChip
          etichetta="Privati"
          valore={privati}
          icona={User}
          colore="#22c55e"
          attivo={tipo === 'privato'}
          onClick={() => setTipo('privato')}
        />
        <StatChip
          etichetta="Aziende"
          valore={db.clienti.length - privati}
          icona={Building2}
          colore="#a855f7"
          attivo={tipo === 'azienda'}
          onClick={() => setTipo('azienda')}
        />
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
              placeholder="Cerca per nome, telefono, email…"
              aria-label="Cerca cliente"
              className="pl-9"
            />
          </div>

          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCliente | 'tutti')}
            aria-label="Filtra per tipo"
            className="sm:w-44"
          >
            <option value="tutti">Tutti i tipi</option>
            <option value="privato">Privati</option>
            <option value="azienda">Aziende</option>
          </Select>
        </div>

        {elenco.totale === 0 ? (
          <StatoVuoto
            titolo="Nessun cliente trovato"
            descrizione="Modifica la ricerca oppure inserisci un nuovo cliente in anagrafica."
          />
        ) : (
          <>
            <Tabella>
              <TabellaHead>
                <Th>Cliente</Th>
                <Th>Contatti</Th>
                <Th>Località</Th>
                <Th allineamento="center">Riparazioni</Th>
                <Th>Cliente dal</Th>
                <Th allineamento="right">Azioni</Th>
              </TabellaHead>
              <tbody>
                {elenco.visibili.map((cliente) => (
                  <Tr key={cliente.id} onClick={() => navigate(`/clienti/${cliente.id}`)}>
                    <Td etichetta="Cliente">
                      <span className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-ink-muted">
                          {iniziali(cliente.nome)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {cliente.nome}
                          </span>
                          <span className="block text-[11px] text-ink-faint capitalize">
                            {cliente.tipo}
                            {cliente.partitaIva ? ` · P.IVA ${cliente.partitaIva}` : ''}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td etichetta="Contatti" className="text-[13px]">
                      <span className="block text-ink">{cliente.telefono}</span>
                      {cliente.email && (
                        <span className="block truncate text-[11px] text-ink-faint">
                          {cliente.email}
                        </span>
                      )}
                    </Td>
                    <Td etichetta="Località" className="text-[13px]">
                      {cliente.citta ? `${cliente.cap ?? ''} ${cliente.citta}`.trim() : '--'}
                    </Td>
                    <Td
                      etichetta="Riparazioni"
                      allineamento="center"
                      className="text-[13px] font-semibold text-ink"
                    >
                      {riparazioniPerCliente.get(cliente.id) ?? 0}
                    </Td>
                    <Td etichetta="Cliente dal" className="text-[13px] whitespace-nowrap">
                      {formatData(cliente.creatoIl)}
                    </Td>
                    <Td allineamento="right">
                      <span
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button dimensione="sm" onClick={() => navigate(`/clienti/${cliente.id}`)}>
                          <Eye size={14} />
                        </Button>
                        <Button dimensione="sm" variante="primario" onClick={() => apriModifica(cliente)}>
                          <Pencil size={14} />
                        </Button>
                        <Button dimensione="sm" variante="pericolo" onClick={() => setDaEliminare(cliente)}>
                          <Trash2 size={14} />
                        </Button>
                      </span>
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
              etichettaElementi="clienti"
              onCambiaPagina={elenco.vaiAPagina}
              onCambiaPerPagina={elenco.cambiaPerPagina}
            />
          </>
        )}
      </Card>

      <Modal
        aperta={form !== null}
        titolo={inModifica ? 'Modifica cliente' : 'Nuovo cliente'}
        onChiudi={chiudiForm}
        piede={
          <>
            <Button onClick={chiudiForm}>Annulla</Button>
            <Button variante="primario" onClick={salva}>
              Salva cliente
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etichetta="Nome / Ragione sociale" obbligatorio className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </Campo>

            <Campo etichetta="Tipo">
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCliente })}
              >
                <option value="privato">Privato</option>
                <option value="azienda">Azienda</option>
              </Select>
            </Campo>

            <Campo etichetta="Telefono" obbligatorio>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Campo>

            <Campo etichetta="Email" className="sm:col-span-2">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Campo>

            <Campo etichetta="Indirizzo" className="sm:col-span-2">
              <Input
                value={form.indirizzo}
                onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
              />
            </Campo>

            <Campo etichetta="CAP">
              <Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} />
            </Campo>

            <Campo etichetta="Città">
              <Input
                value={form.citta}
                onChange={(e) => setForm({ ...form, citta: e.target.value })}
              />
            </Campo>

            {form.tipo === 'azienda' ? (
              <Campo etichetta="Partita IVA">
                <Input
                  value={form.partitaIva}
                  onChange={(e) => setForm({ ...form, partitaIva: e.target.value })}
                />
              </Campo>
            ) : (
              <Campo etichetta="Codice fiscale">
                <Input
                  value={form.codiceFiscale}
                  onChange={(e) => setForm({ ...form, codiceFiscale: e.target.value })}
                />
              </Campo>
            )}

            <Campo etichetta="Note" className="sm:col-span-2">
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="min-h-20"
              />
            </Campo>

            {errore && <p className="text-xs text-rose-400 sm:col-span-2">{errore}</p>}
          </div>
        )}
      </Modal>

      <Modal
        aperta={daEliminare !== null}
        titolo="Eliminare il cliente?"
        sottotitolo={daEliminare?.nome}
        onChiudi={() => setDaEliminare(null)}
        larghezza="sm"
        piede={
          <>
            <Button onClick={() => setDaEliminare(null)}>Annulla</Button>
            <Button
              variante="pericolo"
              onClick={() => {
                if (daEliminare) eliminaCliente(daEliminare.id)
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
          I documenti collegati restano in archivio ma perderanno il riferimento anagrafico: non
          saranno più ricercabili per nome e le stampe usciranno senza intestatario.
        </p>
        {collegamentiCliente.totale > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-ink-muted">
            {collegamentiCliente.voci.map(([etichetta, quantita]) => (
              <li key={etichetta}>
                <strong className="text-ink">{quantita}</strong> {etichetta}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}

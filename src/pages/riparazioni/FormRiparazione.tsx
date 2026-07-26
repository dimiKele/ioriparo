import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Link2Off,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Upload,
  UserCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Campo,
  Checkbox,
  GruppoSegmenti,
  Input,
  InputData,
  Radio,
  Select,
  SezioneForm,
  Textarea,
} from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { SignaturePad } from '@/components/ui/SignaturePad'
import { useGestionale } from '@/data/store'
import { linkWhatsApp, oggiISO } from '@/lib/format'
import { comprimiImmagine, formatPeso, pesoDataUrl } from '@/lib/immagini'
import { impronta } from '@/lib/allegati'
import {
  MARCHE_PER_TIPO,
  ORDINE_STATI,
  STATI_RIPARAZIONE,
  TIPI_DISPOSITIVO,
} from '@/lib/stati'
import type {
  CondizioneEsterna,
  Cliente,
  RiferimentoAllegato,
  Riparazione,
  StatoRiparazione,
  TipoDispositivo,
} from '@/types'

const MAX_DIFETTO = 500

export interface DatiForm {
  /** Cliente esistente selezionato; se assente ne viene creato uno nuovo */
  clienteId?: string
  nomeCliente: string
  telefono: string
  email: string
  indirizzo: string
  citta: string
  cap: string

  tipoDispositivo: TipoDispositivo
  marca: string
  modello: string
  colore: string
  capacita: string
  imei: string
  passwordBlocco: string

  difettoSegnalato: string
  condizioniEsterne?: CondizioneEsterna
  noteCondizioni: string

  accessori: Riparazione['accessori']
  foto: string[]
  firmaCliente?: string
  /** Riferimenti alle immagini già caricate sul server. */
  allegati: RiferimentoAllegato[]

  stato: StatoRiparazione
  dataAccettazione: string
  consegnaPrevista: string
  tecnico: string
  acconto: string
  noteInterne: string
}

const CONDIZIONI: Array<{ valore: CondizioneEsterna; label: string; classeAttiva: string }> = [
  { valore: 'ottime', label: 'Ottime', classeAttiva: 'border-emerald-500 bg-emerald-500/15 text-emerald-300' },
  { valore: 'buone', label: 'Buone', classeAttiva: 'border-blue-500 bg-blue-500/15 text-blue-300' },
  { valore: 'sufficienti', label: 'Sufficienti', classeAttiva: 'border-amber-500 bg-amber-500/15 text-amber-300' },
  { valore: 'danneggiato', label: 'Danneggiato', classeAttiva: 'border-rose-500 bg-rose-500/15 text-rose-300' },
]

export function datiVuoti(): DatiForm {
  return {
    nomeCliente: '',
    telefono: '',
    email: '',
    indirizzo: '',
    citta: '',
    cap: '',
    tipoDispositivo: 'smartphone',
    marca: '',
    modello: '',
    colore: '',
    capacita: '',
    imei: '',
    passwordBlocco: '',
    difettoSegnalato: '',
    condizioniEsterne: undefined,
    noteCondizioni: '',
    accessori: { scatola: false, cover: false, caricabatterie: false, cavoUsb: false, altro: '', note: '' },
    foto: [],
    allegati: [],
    stato: 'in_attesa',
    dataAccettazione: oggiISO(),
    consegnaPrevista: '',
    tecnico: '',
    acconto: '',
    noteInterne: '',
  }
}

export function datiDaRiparazione(riparazione: Riparazione, cliente?: Cliente): DatiForm {
  return {
    clienteId: riparazione.clienteId,
    nomeCliente: cliente?.nome ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    indirizzo: cliente?.indirizzo ?? '',
    citta: cliente?.citta ?? '',
    cap: cliente?.cap ?? '',
    tipoDispositivo: riparazione.tipoDispositivo,
    marca: riparazione.marca,
    modello: riparazione.modello,
    colore: riparazione.colore ?? '',
    capacita: riparazione.capacita ?? '',
    imei: riparazione.imei ?? '',
    passwordBlocco: riparazione.passwordBlocco ?? '',
    difettoSegnalato: riparazione.difettoSegnalato,
    condizioniEsterne: riparazione.condizioniEsterne,
    noteCondizioni: riparazione.noteCondizioni ?? '',
    accessori: { altro: '', note: '', ...riparazione.accessori },
    foto: riparazione.foto ?? [],
    firmaCliente: riparazione.firmaCliente,
    allegati: riparazione.allegati ?? [],
    stato: riparazione.stato,
    dataAccettazione: riparazione.dataAccettazione,
    consegnaPrevista: riparazione.consegnaPrevista ?? '',
    tecnico: riparazione.tecnico ?? '',
    acconto: riparazione.acconto ? String(riparazione.acconto) : '',
    noteInterne: riparazione.noteInterne ?? '',
  }
}

/**
 * Modulo di accettazione, condiviso da «Nuova accettazione» e «Modifica».
 * Il salvataggio è delegato alla pagina che lo ospita.
 */
export function FormRiparazione({
  iniziali,
  etichettaSalva = 'Salva e Stampa',
  onSalva,
}: {
  iniziali: DatiForm
  etichettaSalva?: string
  onSalva: (dati: DatiForm, stampa: boolean) => void
}) {
  const { db } = useGestionale()
  const navigate = useNavigate()

  const [dati, setDati] = useState<DatiForm>(iniziali)
  const [errori, setErrori] = useState<Record<string, string>>({})
  const [sceltaCliente, setSceltaCliente] = useState(false)
  const [ricercaCliente, setRicercaCliente] = useState('')
  const [modoFirma, setModoFirma] = useState<'schermo' | 'carica'>('schermo')
  const [elaborazioneFoto, setElaborazioneFoto] = useState(false)
  const [erroreFoto, setErroreFoto] = useState('')
  const [modificato, setModificato] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)
  const inputFirma = useRef<HTMLInputElement>(null)

  // Un'accettazione può richiedere minuti di lavoro, foto e firma del cliente:
  // chiudere la scheda per sbaglio non deve far perdere tutto in silenzio.
  useEffect(() => {
    if (!modificato) return
    const avvisa = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [modificato])

  function aggiorna<K extends keyof DatiForm>(campo: K, valore: DatiForm[K]) {
    setDati((precedenti) => ({ ...precedenti, [campo]: valore }))
    setModificato(true)
    if (errori[campo as string]) {
      setErrori(({ [campo as string]: _rimosso, ...resto }) => resto)
    }
  }

  /**
   * Toglie la foto e con essa il riferimento all'immagine sul server.
   *
   * È l'unico punto in cui si sa che l'operatore vuole davvero eliminarla:
   * altrove un riferimento senza immagine locale può semplicemente voler dire
   * che questa postazione non l'ha ancora scaricata.
   */
  function rimuoviFoto(indice: number) {
    const daTogliere = dati.foto[indice]
    setDati((precedenti) => ({
      ...precedenti,
      foto: precedenti.foto.filter((_, i) => i !== indice),
      allegati: precedenti.allegati.filter(
        (voce) => !(voce.tipo === 'foto' && voce.impronta === impronta(daTogliere)),
      ),
    }))
    setModificato(true)
  }

  function annulla() {
    if (modificato && !window.confirm('Vuoi uscire? Le modifiche non salvate andranno perse.')) {
      return
    }
    navigate(-1)
  }

  const clientiFiltrati = useMemo(() => {
    const termine = ricercaCliente.trim().toLowerCase()
    const elenco = termine
      ? db.clienti.filter((c) =>
          [c.nome, c.telefono, c.email ?? ''].join(' ').toLowerCase().includes(termine),
        )
      : db.clienti
    return elenco.slice(0, 40)
  }, [db.clienti, ricercaCliente])

  function selezionaCliente(cliente: Cliente) {
    setDati((precedenti) => ({
      ...precedenti,
      clienteId: cliente.id,
      nomeCliente: cliente.nome,
      telefono: cliente.telefono,
      email: cliente.email ?? '',
      indirizzo: cliente.indirizzo ?? '',
      citta: cliente.citta ?? '',
      cap: cliente.cap ?? '',
    }))
    setModificato(true)
    setSceltaCliente(false)
    setRicercaCliente('')
  }

  /**
   * Sgancia la scheda dall'anagrafica: i dati inseriti creeranno un cliente
   * nuovo invece di aggiornare quello collegato. È una scelta esplicita,
   * perché correggere un refuso nel nome deve aggiornare il cliente, non
   * duplicarlo.
   */
  function scollegaCliente() {
    setDati((precedenti) => ({ ...precedenti, clienteId: undefined }))
    setModificato(true)
  }

  async function aggiungiFoto(files: FileList | null) {
    if (!files?.length) return
    setErroreFoto('')
    setElaborazioneFoto(true)
    const errori: string[] = []
    const nuove: string[] = []

    for (const file of [...files].slice(0, 6)) {
      try {
        nuove.push(await comprimiImmagine(file))
      } catch (errore) {
        errori.push(errore instanceof Error ? errore.message : `«${file.name}» non caricata.`)
      }
    }

    if (nuove.length > 0) {
      setDati((precedenti) => ({ ...precedenti, foto: [...precedenti.foto, ...nuove].slice(0, 8) }))
      setModificato(true)
    }
    setErroreFoto(errori.join(' '))
    setElaborazioneFoto(false)
  }

  async function caricaFirma(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    try {
      aggiorna('firmaCliente', await comprimiImmagine(file))
    } catch (errore) {
      setErroreFoto(errore instanceof Error ? errore.message : 'Firma non caricata.')
    }
  }

  function valida(): boolean {
    const nuoviErrori: Record<string, string> = {}
    if (!dati.nomeCliente.trim()) nuoviErrori.nomeCliente = 'Indica il nome del cliente'
    if (!dati.telefono.trim()) {
      nuoviErrori.telefono = 'Indica un recapito telefonico'
    } else if (dati.telefono.replace(/\D/g, '').length < 6) {
      nuoviErrori.telefono = 'Il numero di telefono non sembra completo'
    }
    if (dati.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dati.email.trim())) {
      nuoviErrori.email = 'Indirizzo email non valido'
    }
    if (!dati.marca.trim()) nuoviErrori.marca = 'Seleziona la marca'
    if (!dati.modello.trim()) nuoviErrori.modello = 'Indica il modello'
    if (!dati.difettoSegnalato.trim()) nuoviErrori.difettoSegnalato = 'Descrivi il difetto segnalato'
    // Senza data di accettazione la scheda sparisce da ogni filtro per periodo.
    if (!dati.dataAccettazione) {
      nuoviErrori.dataAccettazione = 'Indica la data di accettazione'
    }
    if (dati.consegnaPrevista && dati.consegnaPrevista < dati.dataAccettazione) {
      nuoviErrori.consegnaPrevista = 'La consegna non può precedere l’accettazione'
    }
    const acconto = Number(dati.acconto.replace(',', '.'))
    if (dati.acconto.trim() && (!Number.isFinite(acconto) || acconto < 0)) {
      nuoviErrori.acconto = 'L’acconto non può essere negativo'
    }
    setErrori(nuoviErrori)

    if (Object.keys(nuoviErrori).length > 0) {
      document.querySelector('[data-errore="true"]')?.scrollIntoView({ block: 'center' })
      return false
    }
    return true
  }

  function salva(stampa: boolean) {
    if (!valida()) return
    setModificato(false)
    onSalva(dati, stampa)
  }

  const pesoFoto = dati.foto.reduce((somma, foto) => somma + pesoDataUrl(foto), 0)

  const marche = MARCHE_PER_TIPO[dati.tipoDispositivo]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={annulla}>
          <X size={15} />
          Annulla
        </Button>
        <Button variante="secondario" onClick={() => salva(false)}>
          Salva
        </Button>
        <Button variante="primario" onClick={() => salva(true)}>
          <Printer size={15} />
          {etichettaSalva}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Colonna 1 — cliente, condizioni, lavorazione */}
        <div className="space-y-4">
          <SezioneForm titolo="Dati cliente">
            <div className="space-y-3">
              <div data-errore={Boolean(errori.nomeCliente)}>
                <Campo etichetta="Nome e Cognome" obbligatorio errore={errori.nomeCliente}>
                  <Input
                    value={dati.nomeCliente}
                    onChange={(e) => aggiorna('nomeCliente', e.target.value)}
                    placeholder="Mario Rossi"
                  />
                </Campo>
              </div>

              <div data-errore={Boolean(errori.telefono)}>
                <Campo etichetta="Telefono" obbligatorio errore={errori.telefono}>
                  <Input
                    value={dati.telefono}
                    onChange={(e) => aggiorna('telefono', e.target.value)}
                    placeholder="333 1234567"
                    inputMode="tel"
                    iconaDestra={
                      linkWhatsApp(dati.telefono) ? (
                        <a
                          href={linkWhatsApp(dati.telefono)}
                          target="_blank"
                          rel="noreferrer"
                          title="Scrivi su WhatsApp"
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <MessageCircle size={16} />
                        </a>
                      ) : undefined
                    }
                  />
                </Campo>
              </div>

              <div data-errore={Boolean(errori.email)}>
                <Campo etichetta="Email" errore={errori.email}>
                  <Input
                    type="email"
                    value={dati.email}
                    onChange={(e) => aggiorna('email', e.target.value)}
                    placeholder="mario.rossi@email.com"
                  />
                </Campo>
              </div>

              <Campo etichetta="Indirizzo">
                <Input
                  value={dati.indirizzo}
                  onChange={(e) => aggiorna('indirizzo', e.target.value)}
                  placeholder="Via Roma 45"
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo etichetta="Città">
                  <Input
                    value={dati.citta}
                    onChange={(e) => aggiorna('citta', e.target.value)}
                    placeholder="Altamura"
                  />
                </Campo>
                <Campo etichetta="CAP">
                  <Input
                    value={dati.cap}
                    onChange={(e) => aggiorna('cap', e.target.value)}
                    placeholder="70022"
                    inputMode="numeric"
                  />
                </Campo>
              </div>

              <Button className="w-full" onClick={() => setSceltaCliente(true)}>
                <UserCheck size={15} />
                Seleziona cliente esistente
              </Button>

              {dati.clienteId ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <p className="text-[11px] text-emerald-300">
                    Collegato a un cliente in anagrafica: le correzioni qui sopra ne aggiornano
                    la scheda.
                  </p>
                  <button
                    type="button"
                    onClick={scollegaCliente}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
                  >
                    <Link2Off size={12} />
                    Scollega e registra un nuovo cliente
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-ink-faint">
                  Al salvataggio verrà creata una nuova anagrafica cliente.
                </p>
              )}
            </div>
          </SezioneForm>

          <SezioneForm titolo="Condizioni esterne">
            <GruppoSegmenti
              valore={dati.condizioniEsterne}
              opzioni={CONDIZIONI}
              onChange={(valore) => aggiorna('condizioniEsterne', valore)}
            />
            <Textarea
              value={dati.noteCondizioni}
              onChange={(e) => aggiorna('noteCondizioni', e.target.value)}
              placeholder="Note condizioni esterne…"
              className="mt-3 min-h-20"
            />
          </SezioneForm>

          <SezioneForm titolo="Lavorazione">
            <div className="grid grid-cols-2 gap-3">
              <Campo etichetta="Stato">
                <Select
                  value={dati.stato}
                  onChange={(e) => aggiorna('stato', e.target.value as StatoRiparazione)}
                >
                  {ORDINE_STATI.map((stato) => (
                    <option key={stato} value={stato}>
                      {STATI_RIPARAZIONE[stato].label}
                    </option>
                  ))}
                </Select>
              </Campo>

              <Campo etichetta="Tecnico assegnato">
                <Input
                  value={dati.tecnico}
                  onChange={(e) => aggiorna('tecnico', e.target.value)}
                  placeholder="Antonio"
                  list="elenco-tecnici"
                />
              </Campo>

              <div data-errore={Boolean(errori.dataAccettazione)}>
                <Campo etichetta="Data accettazione" obbligatorio errore={errori.dataAccettazione}>
                  <Input
                    type="date"
                    value={dati.dataAccettazione}
                    onChange={(e) => aggiorna('dataAccettazione', e.target.value)}
                  />
                </Campo>
              </div>

              <Campo etichetta="Consegna prevista" errore={errori.consegnaPrevista}>
                <InputData
                  value={dati.consegnaPrevista}
                  min={dati.dataAccettazione}
                  onChange={(e) => aggiorna('consegnaPrevista', e.target.value)}
                  placeholder="Da definire"
                />
              </Campo>

              <Campo etichetta="Acconto (€)" className="col-span-2" errore={errori.acconto}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={dati.acconto}
                  onChange={(e) => aggiorna('acconto', e.target.value)}
                  placeholder="0.00"
                />
              </Campo>
            </div>
          </SezioneForm>
        </div>

        {/* Colonna 2 — dispositivo e foto */}
        <div className="space-y-4">
          <SezioneForm titolo="Dati dispositivo">
            <div className="space-y-3">
              <Campo etichetta="Tipo dispositivo" obbligatorio>
                <Select
                  value={dati.tipoDispositivo}
                  onChange={(e) => {
                    const tipo = e.target.value as TipoDispositivo
                    aggiorna('tipoDispositivo', tipo)
                    // La marca resta solo se prevista per il nuovo tipo.
                    if (!MARCHE_PER_TIPO[tipo].includes(dati.marca)) aggiorna('marca', '')
                  }}
                >
                  {Object.entries(TIPI_DISPOSITIVO).map(([valore, label]) => (
                    <option key={valore} value={valore}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Campo>

              <Campo etichetta="Marca" obbligatorio errore={errori.marca}>
                <Select value={dati.marca} onChange={(e) => aggiorna('marca', e.target.value)}>
                  <option value="">Seleziona…</option>
                  {marche.map((marca) => (
                    <option key={marca} value={marca}>
                      {marca}
                    </option>
                  ))}
                </Select>
              </Campo>

              <Campo etichetta="Modello" obbligatorio errore={errori.modello}>
                <Input
                  value={dati.modello}
                  onChange={(e) => aggiorna('modello', e.target.value)}
                  placeholder="iPhone 13"
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo etichetta="Colore">
                  <Input
                    value={dati.colore}
                    onChange={(e) => aggiorna('colore', e.target.value)}
                    placeholder="Nero"
                  />
                </Campo>
                <Campo etichetta="Capacità">
                  <Input
                    value={dati.capacita}
                    onChange={(e) => aggiorna('capacita', e.target.value)}
                    placeholder="128 GB"
                  />
                </Campo>
              </div>

              <Campo etichetta="IMEI / Serial Number">
                <Input
                  value={dati.imei}
                  onChange={(e) => aggiorna('imei', e.target.value)}
                  placeholder="352099114587632"
                />
              </Campo>

              <Campo
                etichetta="Password / Blocco"
                aiuto="Utile per collaudare il dispositivo dopo l'intervento."
              >
                <Input
                  value={dati.passwordBlocco}
                  onChange={(e) => aggiorna('passwordBlocco', e.target.value)}
                  placeholder="Inserisci se conosciuta"
                />
              </Campo>
            </div>
          </SezioneForm>

          <SezioneForm titolo="Foto dispositivo">
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                disabled={elaborazioneFoto || dati.foto.length >= 8}
                className="flex aspect-3/4 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-soft bg-surface-2 text-ink-faint transition-colors hover:border-brand hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {elaborazioneFoto ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                <span className="text-[10px] leading-tight">
                  {elaborazioneFoto ? 'Elaboro…' : 'Aggiungi foto'}
                </span>
              </button>

              {dati.foto.map((foto, indice) => (
                <div key={indice} className="group relative aspect-3/4">
                  <img
                    src={foto}
                    alt={`Foto dispositivo ${indice + 1}`}
                    className="size-full rounded-lg border border-line-soft object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => rimuoviFoto(indice)}
                    aria-label={`Rimuovi foto ${indice + 1}`}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-rose-600 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void aggiungiFoto(e.target.files)
                e.target.value = ''
              }}
            />

            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Camera size={12} />
              Documenta graffi e ammaccature prima dell'intervento.
              {dati.foto.length > 0 && ` ${dati.foto.length}/8 · ${formatPeso(pesoFoto)}`}
            </p>

            {erroreFoto && <p className="mt-1 text-[11px] text-rose-400">{erroreFoto}</p>}
          </SezioneForm>
        </div>

        {/* Colonna 3 — difetto, accessori, firma */}
        <div className="space-y-4 lg:col-span-2 xl:col-span-1">
          <SezioneForm titolo="Difetto segnalato">
            <div data-errore={Boolean(errori.difettoSegnalato)}>
              <Campo obbligatorio errore={errori.difettoSegnalato}>
                <Textarea
                  value={dati.difettoSegnalato}
                  maxLength={MAX_DIFETTO}
                  onChange={(e) => aggiorna('difettoSegnalato', e.target.value)}
                  placeholder="Il display si è rotto dopo una caduta e non risponde più al tocco nella parte superiore."
                  className="min-h-28"
                />
              </Campo>
            </div>
            <p className="mt-1 text-right text-[11px] text-ink-faint">
              {dati.difettoSegnalato.length} / {MAX_DIFETTO}
            </p>
          </SezioneForm>

          <SezioneForm titolo="Accessori consegnati">
            <div className="grid grid-cols-2 gap-2.5">
              <Checkbox
                etichetta="Scatola"
                checked={dati.accessori.scatola}
                onChange={(e) =>
                  aggiorna('accessori', { ...dati.accessori, scatola: e.target.checked })
                }
              />
              <Checkbox
                etichetta="Caricabatterie"
                checked={dati.accessori.caricabatterie}
                onChange={(e) =>
                  aggiorna('accessori', { ...dati.accessori, caricabatterie: e.target.checked })
                }
              />
              <Checkbox
                etichetta="Cover"
                checked={dati.accessori.cover}
                onChange={(e) =>
                  aggiorna('accessori', { ...dati.accessori, cover: e.target.checked })
                }
              />
              <Checkbox
                etichetta="Cavo USB"
                checked={dati.accessori.cavoUsb}
                onChange={(e) =>
                  aggiorna('accessori', { ...dati.accessori, cavoUsb: e.target.checked })
                }
              />
            </div>

            <Input
              value={dati.accessori.altro ?? ''}
              onChange={(e) => aggiorna('accessori', { ...dati.accessori, altro: e.target.value })}
              placeholder="Altro (es. SIM, microSD…)"
              className="mt-3"
            />

            <Textarea
              value={dati.accessori.note ?? ''}
              onChange={(e) => aggiorna('accessori', { ...dati.accessori, note: e.target.value })}
              placeholder="Note accessori…"
              className="mt-2 min-h-16"
            />
          </SezioneForm>

          <SezioneForm titolo="Firma cliente">
            <div className="mb-3 flex flex-wrap gap-4">
              <Radio
                name="modo-firma"
                etichetta="Firma su schermo"
                checked={modoFirma === 'schermo'}
                onChange={() => setModoFirma('schermo')}
              />
              <Radio
                name="modo-firma"
                etichetta="Carica firma"
                checked={modoFirma === 'carica'}
                onChange={() => setModoFirma('carica')}
              />
            </div>

            {modoFirma === 'schermo' ? (
              <SignaturePad
                valore={dati.firmaCliente}
                onChange={(firma) => {
                  // Rifirmando si scarta il riferimento alla firma precedente.
                  setDati((precedenti) => ({
                    ...precedenti,
                    firmaCliente: firma,
                    allegati: precedenti.allegati.filter((voce) => voce.tipo !== 'firma'),
                  }))
                  setModificato(true)
                }}
              />
            ) : (
              <div className="space-y-3">
                <Button className="w-full" onClick={() => inputFirma.current?.click()}>
                  <Upload size={15} />
                  Carica immagine della firma
                </Button>
                <input
                  ref={inputFirma}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void caricaFirma(e.target.files)
                    e.target.value = ''
                  }}
                />
                {dati.firmaCliente && (
                  <img
                    src={dati.firmaCliente}
                    alt="Firma del cliente"
                    className="w-full rounded-lg border border-line-soft bg-surface-2 p-2"
                  />
                )}
              </div>
            )}

            <p className="mt-2 text-[11px] text-ink-faint">
              Con la firma il cliente accetta le condizioni di servizio e il preventivo di massima.
            </p>
          </SezioneForm>

          <SezioneForm titolo="Note interne">
            <Textarea
              value={dati.noteInterne}
              onChange={(e) => aggiorna('noteInterne', e.target.value)}
              placeholder="Visibili solo al personale del laboratorio…"
              className="min-h-20"
            />
          </SezioneForm>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={annulla}>Annulla</Button>
        <Button variante="secondario" onClick={() => salva(false)}>
          Salva
        </Button>
        <Button variante="primario" onClick={() => salva(true)}>
          <Printer size={15} />
          {etichettaSalva}
        </Button>
      </div>

      <datalist id="elenco-tecnici">
        {[...new Set(db.riparazioni.map((r) => r.tecnico).filter(Boolean))].map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>

      <Modal
        aperta={sceltaCliente}
        titolo="Seleziona cliente esistente"
        sottotitolo="Cerca per nome, telefono o email"
        onChiudi={() => setSceltaCliente(false)}
      >
        <div className="relative mb-3">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={ricercaCliente}
            onChange={(e) => setRicercaCliente(e.target.value)}
            placeholder="Cerca cliente…"
            className="pl-9"
            autoFocus
          />
        </div>

        <ul className="divide-y divide-line">
          {clientiFiltrati.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                onClick={() => selezionaCliente(cliente)}
                className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {cliente.nome}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    {cliente.telefono}
                    {cliente.citta ? ` · ${cliente.citta}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-bold tracking-wide text-ink-faint uppercase">
                  {cliente.tipo}
                </span>
              </button>
            </li>
          ))}
          {clientiFiltrati.length === 0 && (
            <li className="py-8 text-center text-xs text-ink-faint">Nessun cliente trovato</li>
          )}
        </ul>
      </Modal>
    </div>
  )
}

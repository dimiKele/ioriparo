import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Briefcase,
  Boxes,
  CalendarPlus,
  CheckCircle2,
  Euro,
  FileText,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import { Card, CardFooter, CardHeader } from '@/components/ui/Card'
import { Badge, BadgeStato } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { DeviceIcon } from '@/components/ui/DeviceIcon'
import { Select } from '@/components/ui/Form'
import { StatoDonut } from '@/components/charts/StatoDonut'
import { IncassiChart } from '@/components/charts/IncassiChart'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import {
  andamentoIncassi,
  contaPerStato,
  incassoDelGiorno,
  incassoDelMese,
  prodottiPiuVenduti,
  riparazioniAperte,
  riparazioniConsegnateOggi,
  riparazioniPerStato,
  scadenzeImminenti,
  ultimeRiparazioni,
} from '@/data/metriche'
import {
  formatData,
  formatEuro,
  formatNumero,
  nomeAbbreviato,
  scadenzaRelativa,
} from '@/lib/format'
import { TIPI_SCADENZA } from '@/lib/stati'
import { cn } from '@/lib/cn'

const AZIONI_RAPIDE = [
  { etichetta: 'Nuova riparazione', percorso: '/riparazioni/nuova', icona: Wrench, tono: 'bg-blue-600' },
  { etichetta: 'Nuovo cliente', percorso: '/clienti?nuovo=1', icona: UserPlus, tono: 'bg-emerald-600' },
  { etichetta: 'Nuovo preventivo', percorso: '/preventivi?nuovo=1', icona: FileText, tono: 'bg-violet-600' },
  { etichetta: 'Nuova fattura', percorso: '/fatture?nuovo=1', icona: Receipt, tono: 'bg-amber-500' },
  { etichetta: 'Carico magazzino', percorso: '/magazzino?nuovo=1', icona: Boxes, tono: 'bg-cyan-600' },
  { etichetta: 'Nuovo promemoria', percorso: '/scadenze?nuovo=1', icona: CalendarPlus, tono: 'bg-rose-600' },
]

export function Dashboard() {
  useIntestazione({ titolo: 'Benvenuto, Admin', sottotitolo: 'Dashboard' })

  const { db } = useGestionale()
  const navigate = useNavigate()
  const [periodoIncassi, setPeriodoIncassi] = useState<'mese' | number>('mese')
  const [periodoProdotti, setPeriodoProdotti] = useState(30)

  const conteggi = useMemo(() => contaPerStato(db), [db])
  const vociStato = useMemo(() => riparazioniPerStato(db), [db])
  const serieIncassi = useMemo(
    () => andamentoIncassi(db, periodoIncassi),
    [db, periodoIncassi],
  )
  const prodotti = useMemo(
    () => prodottiPiuVenduti(db, periodoProdotti),
    [db, periodoProdotti],
  )
  const ultime = useMemo(() => ultimeRiparazioni(db, 5), [db])
  const scadenze = useMemo(() => scadenzeImminenti(db, 3), [db])
  const consegnateOggi = useMemo(() => riparazioniConsegnateOggi(db), [db])
  const nomiClienti = useMemo(
    () => new Map(db.clienti.map((cliente) => [cliente.id, cliente.nome])),
    [db.clienti],
  )

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Riepiloghi principali */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          etichetta="Riparazioni aperte"
          valore={riparazioniAperte(db)}
          icona={Briefcase}
          tono="blu"
          link="/riparazioni"
        />
        <StatCard
          etichetta="In lavorazione"
          valore={conteggi.in_lavorazione}
          icona={Wrench}
          tono="ambra"
          link="/riparazioni?stato=in_lavorazione"
        />
        <StatCard
          etichetta="Pronte per il ritiro"
          valore={conteggi.pronto_per_ritiro}
          icona={CheckCircle2}
          tono="verde"
          link="/riparazioni?stato=pronto_per_ritiro"
        />
        <StatCard
          etichetta="Incasso oggi"
          valore={formatEuro(incassoDelGiorno(db))}
          icona={Euro}
          tono="ciano"
          link="/fatture"
          testoLink="Vedi dettagli"
        />
        <StatCard
          etichetta="Incasso mese"
          valore={formatEuro(incassoDelMese(db))}
          icona={TrendingUp}
          tono="viola"
          link="/statistiche"
          testoLink="Vedi dettagli"
        />
        <StatCard
          etichetta="Clienti totali"
          valore={formatNumero(db.clienti.length)}
          icona={Users}
          tono="rosa"
          link="/clienti"
          testoLink="Vedi tutti"
        />
      </div>

      {/* Stato del laboratorio */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            titolo="Lavorazioni aperte"
            sottotitolo={`${consegnateOggi} consegnate oggi`}
          />
          <div className="mt-5">
            <StatoDonut
              voci={vociStato}
              etichettaTotale="Aperte"
              onSelezione={(voce) => navigate(`/riparazioni?stato=${voce.stato}`)}
            />
          </div>
          <CardFooter>
            <Link
              to="/riparazioni"
              className="inline-flex items-center gap-1.5 font-medium text-blue-400 hover:text-blue-300"
            >
              Vedi tutte le riparazioni
              <ArrowRight size={14} />
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader titolo="Ultime riparazioni" />
          <ul className="mt-3 divide-y divide-line">
            {ultime.map((riparazione) => (
              <li key={riparazione.id}>
                <Link
                  to={`/riparazioni/${riparazione.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-2"
                >
                  <DeviceIcon tipo={riparazione.tipoDispositivo} dimensione="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {riparazione.modello} —{' '}
                      {nomeAbbreviato(nomiClienti.get(riparazione.clienteId) ?? '—')}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {riparazione.difettoSegnalato}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <BadgeStato stato={riparazione.stato} breve />
                    <span className="hidden text-[11px] text-ink-faint sm:block">
                      {formatData(riparazione.dataAccettazione)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {ultime.length === 0 && (
              <li className="py-6 text-center text-xs text-ink-faint">
                Nessuna riparazione registrata
              </li>
            )}
          </ul>
          <CardFooter>
            <Link
              to="/riparazioni"
              className="inline-flex items-center gap-1.5 font-medium text-blue-400 hover:text-blue-300"
            >
              Vedi tutte le riparazioni
              <ArrowRight size={14} />
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader titolo="Promemoria / Scadenze" />
          <ul className="mt-3 space-y-3">
            {scadenze.map((scadenza) => {
              const tipo = TIPI_SCADENZA[scadenza.tipo]
              const urgente = scadenza.priorita === 'urgente'
              return (
                <li key={scadenza.id}>
                  <Link
                    to="/scadenze"
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${tipo.colore}22`, color: tipo.colore }}
                    >
                      <CalendarPlus size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-[13px] font-semibold',
                          urgente ? 'text-rose-400' : 'text-blue-400',
                        )}
                      >
                        {scadenza.titolo}
                      </span>
                      {scadenza.descrizione && (
                        <span className="block truncate text-[12px] text-ink-muted">
                          {scadenza.descrizione}
                        </span>
                      )}
                      <span className="block text-[11px] text-ink-faint">
                        Scade il {formatData(scadenza.data)} · {scadenzaRelativa(scadenza.data)}
                      </span>
                    </span>
                    <Badge
                      className={
                        urgente
                          ? 'text-rose-300 bg-rose-500/12 border-rose-500/30'
                          : 'text-amber-300 bg-amber-500/12 border-amber-500/30'
                      }
                    >
                      {urgente ? 'Urgente' : 'Promemoria'}
                    </Badge>
                  </Link>
                </li>
              )
            })}
            {scadenze.length === 0 && (
              <li className="py-6 text-center text-xs text-ink-faint">Nessuna scadenza aperta</li>
            )}
          </ul>
          <CardFooter>
            <Link
              to="/scadenze"
              className="inline-flex items-center gap-1.5 font-medium text-blue-400 hover:text-blue-300"
            >
              Vedi tutte le scadenze
              <ArrowRight size={14} />
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Andamento economico */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            titolo="Andamento incassi"
            azione={
              <Select
                value={periodoIncassi}
                onChange={(e) =>
                  setPeriodoIncassi(e.target.value === 'mese' ? 'mese' : Number(e.target.value))
                }
                aria-label="Periodo incassi"
                className="h-8 w-36 text-xs"
              >
                <option value="mese">Questo mese</option>
                <option value={30}>Ultimi 30 giorni</option>
                <option value={7}>Ultimi 7 giorni</option>
              </Select>
            }
          />
          <div className="mt-4">
            <IncassiChart dati={serieIncassi} />
          </div>
        </Card>

        <Card>
          <CardHeader
            titolo="Prodotti più venduti"
            azione={
              <Select
                value={periodoProdotti}
                onChange={(e) => setPeriodoProdotti(Number(e.target.value))}
                aria-label="Periodo prodotti"
                className="h-8 w-36 text-xs"
              >
                <option value={7}>Ultimi 7 giorni</option>
                <option value={30}>Ultimi 30 giorni</option>
                <option value={90}>Ultimi 90 giorni</option>
              </Select>
            }
          />
          <ol className="mt-3 divide-y divide-line">
            {prodotti.map((prodotto, indice) => (
              <li key={prodotto.nome} className="flex items-center gap-3 py-2.5">
                <span className="w-4 shrink-0 text-center text-xs font-semibold text-ink-faint">
                  {indice + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {prodotto.nome}
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{prodotto.pezzi} pezzi</span>
              </li>
            ))}
            {prodotti.length === 0 && (
              <li className="py-6 text-center text-xs text-ink-faint">
                Nessuna vendita nel periodo
              </li>
            )}
          </ol>
          <CardFooter>
            <Link
              to="/magazzino"
              className="inline-flex items-center gap-1.5 font-medium text-blue-400 hover:text-blue-300"
            >
              Vedi tutti i prodotti
              <ArrowRight size={14} />
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Scorciatoie */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {AZIONI_RAPIDE.map(({ etichetta, percorso, icona: Icona, tono }) => (
          <Link
            key={etichetta}
            to={percorso}
            className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-soft hover:bg-surface-2"
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg text-white',
                tono,
              )}
            >
              <Icona size={19} />
            </span>
            <span className="text-[13px] leading-tight font-semibold text-ink">{etichetta}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

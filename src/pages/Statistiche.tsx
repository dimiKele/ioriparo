import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { IncassiChart } from '@/components/charts/IncassiChart'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import {
  andamentoIncassi,
  contaPerStato,
  incassiDelPeriodo,
  prodottiPiuVenduti,
  ricaviPerCategoria,
  riparazioniPerMese,
  totaleDaIncassare,
  valoreMagazzino,
} from '@/data/metriche'
import { formatEuro, formatEuroCompatto } from '@/lib/format'
import { ORDINE_STATI, STATI_RIPARAZIONE, TIPI_DISPOSITIVO } from '@/lib/stati'

const COLORI_TORTA = ['#2563eb', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#f43f5e', '#94a3b8']

const STILE_TOOLTIP = {
  background: '#17202f',
  border: '1px solid #263349',
  borderRadius: 10,
  fontSize: 12,
  color: '#e8edf5',
}

export function Statistiche() {
  useIntestazione({
    titolo: 'Statistiche',
    sottotitolo: 'Andamento del laboratorio e composizione dei ricavi',
  })

  const { db } = useGestionale()
  const [periodo, setPeriodo] = useState(30)

  const conteggi = useMemo(() => contaPerStato(db), [db])
  const perMese = useMemo(() => riparazioniPerMese(db, 6), [db])
  const categorie = useMemo(() => ricaviPerCategoria(db, periodo), [db, periodo])
  const prodotti = useMemo(() => prodottiPiuVenduti(db, periodo, 8), [db, periodo])
  // Anche il grafico segue il periodo scelto: prima era fisso a 30 giorni.
  const serieIncassi = useMemo(() => andamentoIncassi(db, periodo), [db, periodo])
  const incassi = useMemo(() => incassiDelPeriodo(db, periodo), [db, periodo])
  const daIncassare = useMemo(() => totaleDaIncassare(db), [db])
  const magazzino = useMemo(() => valoreMagazzino(db), [db])

  const perTipo = useMemo(() => {
    const mappa = new Map<string, number>()
    for (const riparazione of db.riparazioni) {
      const label = TIPI_DISPOSITIVO[riparazione.tipoDispositivo]
      mappa.set(label, (mappa.get(label) ?? 0) + 1)
    }
    return [...mappa.entries()]
      .map(([nome, valore]) => ({ nome, valore }))
      .sort((a, b) => b.valore - a.valore)
  }, [db.riparazioni])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select
          value={periodo}
          onChange={(e) => setPeriodo(Number(e.target.value))}
          aria-label="Periodo di analisi"
          className="w-48"
        >
          <option value={7}>Ultimi 7 giorni</option>
          <option value={30}>Ultimi 30 giorni</option>
          <option value={90}>Ultimi 90 giorni</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Incassato nel periodo
          </p>
          <p className="mt-1 text-xl font-bold text-ink">{formatEuro(incassi.incassato)}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{incassi.documenti} documenti</p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Scontrino medio
          </p>
          <p className="mt-1 text-xl font-bold text-ink">{formatEuro(incassi.scontrinoMedio)}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">nel periodo selezionato</p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Da incassare
          </p>
          <p className="mt-1 text-xl font-bold text-amber-400">{formatEuro(daIncassare)}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">su tutto lo storico</p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Valore magazzino
          </p>
          <p className="mt-1 text-xl font-bold text-ink">{formatEuro(magazzino)}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">a prezzo di acquisto</p>
        </Card>
      </div>

      <Card>
        <CardHeader titolo={`Incassi degli ultimi ${periodo} giorni`} />
        <div className="mt-4">
          <IncassiChart dati={serieIncassi} altezza={280} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader titolo="Riparazioni e incassi per mese" />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perMese} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#1e2937" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="etichetta"
                  tick={{ fill: '#6b7a92', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1e2937' }}
                />
                <YAxis
                  yAxisId="sinistra"
                  tick={{ fill: '#6b7a92', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <YAxis
                  yAxisId="destra"
                  orientation="right"
                  tick={{ fill: '#6b7a92', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(valore: number) => formatEuroCompatto(valore)}
                />
                <Tooltip
                  cursor={{ fill: '#ffffff08' }}
                  contentStyle={STILE_TOOLTIP}
                  formatter={(valore, nome) =>
                    nome === 'incasso'
                      ? [formatEuro(Number(valore ?? 0)), 'Incasso']
                      : [String(valore ?? 0), 'Riparazioni']
                  }
                />
                <Bar
                  yAxisId="sinistra"
                  dataKey="riparazioni"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="destra"
                  dataKey="incasso"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader titolo="Ricavi per categoria" sottotitolo={`Ultimi ${periodo} giorni`} />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categorie}
                  dataKey="ricavo"
                  nameKey="categoria"
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {categorie.map((_voce, indice) => (
                    <Cell key={indice} fill={COLORI_TORTA[indice % COLORI_TORTA.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={STILE_TOOLTIP}
                  formatter={(valore, nome) => [formatEuro(Number(valore ?? 0)), String(nome)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-2 space-y-1.5">
            {categorie.slice(0, 6).map((voce, indice) => (
              <li key={voce.categoria} className="flex items-center gap-2 text-[13px]">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: COLORI_TORTA[indice % COLORI_TORTA.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-muted">{voce.categoria}</span>
                <span className="font-semibold text-ink">{formatEuro(voce.ricavo)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader titolo="Riparazioni per stato" />
          <ul className="mt-4 space-y-3">
            {ORDINE_STATI.map((stato) => {
              const totale = db.riparazioni.length || 1
              const percentuale = (conteggi[stato] / totale) * 100
              return (
                <li key={stato}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-ink-muted">{STATI_RIPARAZIONE[stato].label}</span>
                    <span className="font-semibold text-ink">{conteggi[stato]}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentuale}%`,
                        backgroundColor: STATI_RIPARAZIONE[stato].colore,
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader titolo="Dispositivi per tipologia" />
          <ul className="mt-4 space-y-3">
            {perTipo.map((voce, indice) => {
              const totale = db.riparazioni.length || 1
              return (
                <li key={voce.nome}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-ink-muted">{voce.nome}</span>
                    <span className="font-semibold text-ink">{voce.valore}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(voce.valore / totale) * 100}%`,
                        backgroundColor: COLORI_TORTA[indice % COLORI_TORTA.length],
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader titolo="Più venduti" sottotitolo={`Ultimi ${periodo} giorni`} />
          <ol className="mt-3 divide-y divide-line">
            {prodotti.map((prodotto, indice) => (
              <li key={prodotto.nome} className="flex items-center gap-3 py-2.5">
                <span className="w-4 shrink-0 text-center text-xs font-semibold text-ink-faint">
                  {indice + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {prodotto.nome}
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{prodotto.pezzi} pz</span>
                <span className="shrink-0 text-xs font-semibold text-ink">
                  {formatEuro(prodotto.ricavo)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

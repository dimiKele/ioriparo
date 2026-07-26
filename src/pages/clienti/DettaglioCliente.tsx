import { useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, MessageCircle, Plus, Receipt, Wrench } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { BadgeStato } from '@/components/ui/Badge'
import { Button, LinkButton } from '@/components/ui/Button'
import { DeviceIcon } from '@/components/ui/DeviceIcon'
import { Tabella, TabellaHead, Td, Th, Tr, StatoVuoto } from '@/components/ui/Tabella'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import { totaleFattura, totalePreventivo, totaleRiparazione } from '@/lib/calcoli'
import { formatData, formatEuro, iniziali, linkWhatsApp } from '@/lib/format'
import {
  STATI_FATTURA,
  STATI_PREVENTIVO,
  statoFatturaEffettivo,
  statoPreventivoEffettivo,
} from '@/lib/stati'
import { Badge } from '@/components/ui/Badge'

export function DettaglioCliente() {
  const { id = '' } = useParams()
  const { db } = useGestionale()
  const navigate = useNavigate()

  const cliente = db.clienti.find((c) => c.id === id)

  useIntestazione({
    titolo: cliente?.nome ?? 'Cliente non trovato',
    briciole: [
      { label: 'Home', to: '/' },
      { label: 'Clienti', to: '/clienti' },
      { label: cliente?.nome ?? '—' },
    ],
  })

  const riparazioni = useMemo(
    () =>
      db.riparazioni
        .filter((r) => r.clienteId === id)
        .sort((a, b) => b.dataAccettazione.localeCompare(a.dataAccettazione)),
    [db.riparazioni, id],
  )

  const fatture = useMemo(
    () => db.fatture.filter((f) => f.clienteId === id).sort((a, b) => b.data.localeCompare(a.data)),
    [db.fatture, id],
  )

  const preventivi = useMemo(
    () =>
      db.preventivi.filter((p) => p.clienteId === id).sort((a, b) => b.data.localeCompare(a.data)),
    [db.preventivi, id],
  )

  if (!cliente) return <Navigate to="/clienti" replace />

  const speso = fatture
    .filter((f) => f.stato === 'pagata')
    .reduce((somma, f) => somma + totaleFattura(f), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => navigate('/clienti')}>
          <ArrowLeft size={15} />
          Torna all'anagrafica
        </Button>
        <LinkButton to="/riparazioni/nuova" variante="primario">
          <Plus size={16} />
          Nuova accettazione
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-14 items-center justify-center rounded-full bg-surface-3 text-lg font-bold text-ink-muted">
              {iniziali(cliente.nome)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-ink">{cliente.nome}</h2>
              <p className="text-xs text-ink-faint capitalize">
                {cliente.tipo} · cliente dal {formatData(cliente.creatoIl)}
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-faint">Telefono</dt>
              <dd className="text-ink">{cliente.telefono}</dd>
            </div>
            {cliente.email && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Email</dt>
                <dd className="truncate text-ink">{cliente.email}</dd>
              </div>
            )}
            {cliente.indirizzo && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Indirizzo</dt>
                <dd className="text-right text-ink">
                  {cliente.indirizzo}
                  <br />
                  {cliente.cap} {cliente.citta}
                </dd>
              </div>
            )}
            {cliente.partitaIva && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Partita IVA</dt>
                <dd className="text-ink">{cliente.partitaIva}</dd>
              </div>
            )}
            {cliente.codiceFiscale && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Codice fiscale</dt>
                <dd className="text-ink">{cliente.codiceFiscale}</dd>
              </div>
            )}
          </dl>

          {cliente.note && (
            <p className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-muted">
              {cliente.note}
            </p>
          )}

          {linkWhatsApp(cliente.telefono) && (
            <a
              href={linkWhatsApp(cliente.telefono)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/12 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <MessageCircle size={16} />
              Scrivi su WhatsApp
            </a>
          )}
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="text-center">
              <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                Riparazioni
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{riparazioni.length}</p>
            </Card>
            <Card className="text-center">
              <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                Fatture
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{fatture.length}</p>
            </Card>
            <Card className="text-center">
              <p className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                Fatture incassate
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatEuro(speso)}</p>
              <p className="mt-0.5 text-[10px] text-ink-faint">esclusi incassi senza fattura</p>
            </Card>
          </div>

          <Card padding={false}>
            <div className="p-5 pb-3">
              <CardHeader titolo="Storico riparazioni" />
            </div>
            {riparazioni.length === 0 ? (
              <StatoVuoto
                titolo="Nessuna riparazione"
                descrizione="Questo cliente non ha ancora dispositivi in assistenza."
                azione={
                  <LinkButton to="/riparazioni/nuova" variante="primario" dimensione="sm">
                    <Wrench size={14} />
                    Registra accettazione
                  </LinkButton>
                }
              />
            ) : (
              <Tabella larghezzaMinima="sm:min-w-[640px]">
                <TabellaHead>
                  <Th>ID</Th>
                  <Th>Dispositivo</Th>
                  <Th>Stato</Th>
                  <Th>Accettazione</Th>
                  <Th allineamento="right">Totale</Th>
                </TabellaHead>
                <tbody>
                  {riparazioni.map((riparazione) => (
                    <Tr
                      key={riparazione.id}
                      onClick={() => navigate(`/riparazioni/${riparazione.id}`)}
                    >
                      <Td etichetta="ID" className="whitespace-nowrap">
                        {riparazione.codice}
                      </Td>
                      <Td etichetta="Dispositivo">
                        <span className="flex items-center gap-2.5">
                          <DeviceIcon tipo={riparazione.tipoDispositivo} dimensione="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] text-ink">
                              {riparazione.marca} {riparazione.modello}
                            </span>
                            <span className="block truncate text-[11px] text-ink-faint">
                              {riparazione.difettoSegnalato}
                            </span>
                          </span>
                        </span>
                      </Td>
                      <Td etichetta="Stato">
                        <BadgeStato stato={riparazione.stato} breve />
                      </Td>
                      <Td etichetta="Accettazione" className="whitespace-nowrap">
                        {formatData(riparazione.dataAccettazione)}
                      </Td>
                      <Td etichetta="Totale" allineamento="right" className="font-semibold text-ink">
                        {formatEuro(totaleRiparazione(riparazione))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabella>
            )}
          </Card>

          <Card padding={false}>
            <div className="p-5 pb-3">
              <CardHeader
                titolo="Fatture"
                azione={
                  <Link to="/fatture" className="text-xs font-medium text-blue-400 hover:text-blue-300">
                    Vedi tutte
                  </Link>
                }
              />
            </div>
            {fatture.length === 0 ? (
              <StatoVuoto titolo="Nessuna fattura emessa" />
            ) : (
              <Tabella larghezzaMinima="sm:min-w-[520px]">
                <TabellaHead>
                  <Th>Numero</Th>
                  <Th>Data</Th>
                  <Th>Stato</Th>
                  <Th allineamento="right">Importo</Th>
                </TabellaHead>
                <tbody>
                  {fatture.slice(0, 8).map((fattura) => (
                    <Tr key={fattura.id} onClick={() => navigate(`/fatture/${fattura.id}`)}>
                      <Td etichetta="Numero" className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <Receipt size={14} className="text-ink-faint" />
                          {fattura.numero}
                        </span>
                      </Td>
                      <Td etichetta="Data" className="whitespace-nowrap">
                        {formatData(fattura.data)}
                      </Td>
                      <Td etichetta="Stato">
                        <Badge className={STATI_FATTURA[statoFatturaEffettivo(fattura)].badge}>
                          {STATI_FATTURA[statoFatturaEffettivo(fattura)].label}
                        </Badge>
                      </Td>
                      <Td etichetta="Importo" allineamento="right" className="font-semibold text-ink">
                        {formatEuro(totaleFattura(fattura))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabella>
            )}
            {fatture.length > 8 && (
              <p className="px-5 pb-4 text-[11px] text-ink-faint">
                Mostrate le 8 più recenti su {fatture.length}.
              </p>
            )}
          </Card>

          <Card padding={false}>
            <div className="p-5 pb-3">
              <CardHeader
                titolo="Preventivi"
                azione={
                  <Link
                    to="/preventivi"
                    className="text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    Vedi tutti
                  </Link>
                }
              />
            </div>
            {preventivi.length === 0 ? (
              <StatoVuoto titolo="Nessun preventivo per questo cliente" />
            ) : (
              <Tabella larghezzaMinima="sm:min-w-[520px]">
                <TabellaHead>
                  <Th>Numero</Th>
                  <Th>Data</Th>
                  <Th>Stato</Th>
                  <Th allineamento="right">Importo</Th>
                </TabellaHead>
                <tbody>
                  {preventivi.slice(0, 8).map((preventivo) => (
                    <Tr
                      key={preventivo.id}
                      onClick={() => navigate(`/preventivi/${preventivo.id}`)}
                    >
                      <Td etichetta="Numero" className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <FileText size={14} className="text-ink-faint" />
                          {preventivo.numero}
                        </span>
                      </Td>
                      <Td etichetta="Data" className="whitespace-nowrap">
                        {formatData(preventivo.data)}
                      </Td>
                      <Td etichetta="Stato">
                        <Badge
                          className={STATI_PREVENTIVO[statoPreventivoEffettivo(preventivo)].badge}
                        >
                          {STATI_PREVENTIVO[statoPreventivoEffettivo(preventivo)].label}
                        </Badge>
                      </Td>
                      <Td etichetta="Importo" allineamento="right" className="font-semibold text-ink">
                        {formatEuro(totalePreventivo(preventivo))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabella>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

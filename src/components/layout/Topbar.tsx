import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ChevronRight, Menu, Search, User } from 'lucide-react'
import { useGestionale } from '@/data/store'
import { articoliSottoScorta, scadenzeImminenti } from '@/data/metriche'
import { useIntestazioneCorrente } from './intestazione'
import { DeviceIcon } from '@/components/ui/DeviceIcon'
import { cn } from '@/lib/cn'
import { giorniAllaData, scadenzaRelativa } from '@/lib/format'
import { cercaOvunque, perGruppo } from '@/lib/ricercaGlobale'

/** Icona WhatsApp (non presente in lucide). */
function IconaWhatsApp({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.34 4.95L2 22l5.22-1.37a9.9 9.9 0 0 0 4.82 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2zm0 18.13a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.35 8.19 8.19 0 1 1 8.2 8.2z" />
    </svg>
  )
}

export function Topbar({ onApriMenu }: { onApriMenu: () => void }) {
  const intestazione = useIntestazioneCorrente()
  const { db } = useGestionale()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [risultatiAperti, setRisultatiAperti] = useState(false)
  const [ricercaMobileAperta, setRicercaMobileAperta] = useState(false)
  const [notificheAperte, setNotificheAperte] = useState(false)
  const [utenteAperto, setUtenteAperto] = useState(false)
  const contenitoreRicerca = useRef<HTMLDivElement>(null)

  // Chiude i menu a tendina quando si clicca fuori. I `setState` sono
  // condizionati perché questo gestore scatta a ogni click dell'applicazione.
  useEffect(() => {
    const onClick = (evento: MouseEvent) => {
      if (!contenitoreRicerca.current?.contains(evento.target as Node)) {
        setRisultatiAperti((aperto) => (aperto ? false : aperto))
        setRicercaMobileAperta((aperta) => (aperta ? false : aperta))
      }
      setNotificheAperte((aperto) => (aperto ? false : aperto))
      setUtenteAperto((aperto) => (aperto ? false : aperto))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const gruppiRisultati = useMemo(() => perGruppo(cercaOvunque(db, query)), [db, query])

  const notifiche = useMemo(() => {
    const scadenze = scadenzeImminenti(db, 5)
      .filter((s) => giorniAllaData(s.data) <= 7)
      .map((s) => ({
        id: s.id,
        titolo: s.titolo,
        dettaglio: `${s.descrizione ?? ''} · ${scadenzaRelativa(s.data)}`.trim(),
        percorso: '/scadenze',
        urgente: s.priorita === 'urgente' || giorniAllaData(s.data) <= 2,
      }))

    const scorte = articoliSottoScorta(db)
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        titolo: 'Scorta minima raggiunta',
        dettaglio: `${a.nome} · ${a.quantita} pz disponibili`,
        percorso: '/magazzino',
        urgente: a.quantita === 0,
      }))

    const pronte = db.riparazioni.filter((r) => r.stato === 'pronto_per_ritiro').length
    const ritiri =
      pronte > 0
        ? [
            {
              id: 'ritiri',
              titolo: 'Dispositivi pronti per il ritiro',
              dettaglio: `${pronte} da consegnare ai clienti`,
              percorso: '/riparazioni?stato=pronto_per_ritiro',
              urgente: false,
            },
          ]
        : []

    return [...scadenze, ...scorte, ...ritiri]
  }, [db])

  function apriRicerca(percorso: string) {
    setQuery('')
    setRisultatiAperti(false)
    setRicercaMobileAperta(false)
    navigate(percorso)
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-base/95 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onApriMenu}
        aria-label="Apri menu"
        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] leading-tight font-bold text-ink">
          {intestazione.titolo}
        </h1>
        {intestazione.briciole ? (
          // Su schermo stretto le briciole restano su una riga sola e vengono
          // tagliate: andando a capo scavalcherebbero le icone della barra.
          <nav
            aria-label="Percorso"
            className="flex items-center gap-1 overflow-hidden text-[11px] whitespace-nowrap text-ink-faint"
          >
            {intestazione.briciole.map((voce, indice) => (
              <span key={`${voce.label}-${indice}`} className="flex shrink-0 items-center gap-1">
                {indice > 0 && <ChevronRight size={11} />}
                {voce.to ? (
                  <Link to={voce.to} className="transition-colors hover:text-ink-muted">
                    {voce.label}
                  </Link>
                ) : (
                  <span>{voce.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          intestazione.sottotitolo && (
            <p className="truncate text-[11px] text-ink-faint">{intestazione.sottotitolo}</p>
          )
        )}
      </div>

      {/* Ricerca globale */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setRicercaMobileAperta((aperta) => !aperta)
          setRisultatiAperti(true)
        }}
        aria-label="Cerca nell’archivio"
        aria-expanded={ricercaMobileAperta}
        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink sm:hidden"
      >
        <Search size={19} />
      </button>

      {/* Su schermo stretto la ricerca si apre come pannello sotto la barra. */}
      <div
        ref={contenitoreRicerca}
        className={cn(
          'relative sm:block sm:w-56 md:w-72 lg:w-96',
          'max-sm:absolute max-sm:inset-x-3 max-sm:top-[3.75rem] max-sm:z-30',
          ricercaMobileAperta ? 'block' : 'hidden',
        )}
      >
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setRisultatiAperti(true)
          }}
          onFocus={() => setRisultatiAperti(true)}
          placeholder="Cerca cliente, dispositivo, IMEI, seriale…"
          aria-label="Ricerca globale"
          className="h-10 w-full rounded-lg border border-line-soft bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
        />

        {risultatiAperti && query.trim().length >= 2 && (
          <div
            role="listbox"
            aria-label="Risultati della ricerca"
            className="absolute top-12 right-0 left-0 z-30 max-h-96 overflow-y-auto rounded-card border border-line-soft bg-surface p-2 shadow-2xl"
          >
            {gruppiRisultati.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-ink-faint">
                Nessun risultato per «{query}»
              </p>
            )}

            {gruppiRisultati.map(([gruppo, voci]) => (
              <div key={gruppo}>
                <p className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-ink-faint uppercase">
                  {gruppo}
                </p>
                {voci.map((voce) => (
                  <button
                    key={`${gruppo}-${voce.id}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => apriRicerca(voce.percorso)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    {voce.tipoDispositivo ? (
                      <DeviceIcon tipo={voce.tipoDispositivo} dimensione="sm" />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-surface-2 text-ink-muted">
                        <User size={16} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{voce.titolo}</span>
                      <span className="block truncate text-[11px] text-ink-faint">
                        {voce.dettaglio}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifiche */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setNotificheAperte((aperto) => !aperto)
            setUtenteAperto(false)
          }}
          aria-label={`Notifiche (${notifiche.length})`}
          className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Bell size={19} />
          {notifiche.length > 0 && (
            <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
              {notifiche.length > 9 ? '9+' : notifiche.length}
            </span>
          )}
        </button>

        {notificheAperte && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-12 right-0 w-80 rounded-card border border-line-soft bg-surface shadow-2xl"
          >
            <p className="border-b border-line px-4 py-3 text-xs font-bold tracking-wide text-ink uppercase">
              Notifiche
            </p>
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {notifiche.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-ink-faint">
                  Nessuna notifica
                </li>
              )}
              {notifiche.map((notifica) => (
                <li key={notifica.id}>
                  <Link
                    to={notifica.percorso}
                    onClick={() => setNotificheAperte(false)}
                    className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 rounded-full',
                          notifica.urgente ? 'bg-rose-500' : 'bg-blue-500',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">
                          {notifica.titolo}
                        </span>
                        <span className="block text-[11px] text-ink-faint">
                          {notifica.dettaglio}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <a
        href="https://wa.me/393773819787"
        target="_blank"
        rel="noreferrer"
        aria-label="Scrivi su WhatsApp"
        className="rounded-lg p-2 text-emerald-400 transition-colors hover:bg-surface-2 hover:text-emerald-300"
      >
        <IconaWhatsApp size={20} />
      </a>

      {/* Utente */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setUtenteAperto((aperto) => !aperto)
            setNotificheAperte(false)
          }}
          className="flex items-center gap-2.5 rounded-lg py-1.5 pr-2 pl-1.5 transition-colors hover:bg-surface-2"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-ink-muted">
            <User size={18} />
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-[13px] leading-tight font-semibold text-ink">Admin</span>
            <span className="block text-[10px] text-ink-faint">Amministratore</span>
          </span>
          <ChevronDown size={15} className="hidden text-ink-faint sm:block" />
        </button>

        {utenteAperto && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-12 right-0 w-52 rounded-card border border-line-soft bg-surface p-1.5 shadow-2xl"
          >
            <Link
              to="/impostazioni"
              onClick={() => setUtenteAperto(false)}
              className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Impostazioni
            </Link>
            <Link
              to="/backup"
              onClick={() => setUtenteAperto(false)}
              className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Backup / Esportazioni
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

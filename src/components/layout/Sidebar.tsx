import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  CalendarClock,
  DatabaseBackup,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Settings,
  Smartphone,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { Logo } from './Logo'
import { cn } from '@/lib/cn'
import { useGestionale } from '@/data/store'
import { useMediaQuery } from '@/lib/useMediaQuery'

interface VoceMenu {
  etichetta: string
  percorso: string
  icona: LucideIcon
}

export const VOCI_MENU: VoceMenu[] = [
  { etichetta: 'Dashboard', percorso: '/', icona: LayoutDashboard },
  { etichetta: 'Clienti', percorso: '/clienti', icona: Users },
  { etichetta: 'Dispositivi / Riparazioni', percorso: '/riparazioni', icona: Smartphone },
  { etichetta: 'Preventivi', percorso: '/preventivi', icona: FileText },
  { etichetta: 'Fatture', percorso: '/fatture', icona: Receipt },
  { etichetta: 'Magazzino', percorso: '/magazzino', icona: Boxes },
  { etichetta: 'Ordini Fornitori', percorso: '/ordini', icona: Truck },
  { etichetta: 'Scadenze e Promemoria', percorso: '/scadenze', icona: CalendarClock },
  { etichetta: 'Impianti & Installazioni', percorso: '/impianti', icona: Wrench },
  { etichetta: 'Statistiche', percorso: '/statistiche', icona: BarChart3 },
  { etichetta: 'Impostazioni', percorso: '/impostazioni', icona: Settings },
  { etichetta: 'Backup / Esportazioni', percorso: '/backup', icona: DatabaseBackup },
]

export function Sidebar({ aperta, onChiudi }: { aperta: boolean; onChiudi: () => void }) {
  const { db } = useGestionale()
  const { azienda } = db
  const schermoLargo = useMediaQuery('(min-width: 1024px)')
  // Su schermo stretto il menu chiuso è solo traslato fuori vista: senza
  // `inert` resterebbe raggiungibile con il tasto Tab e con lo screen reader.
  const nascosto = !aperta && !schermoLargo

  // Chiusura con ESC quando il menu è aperto sopra il contenuto.
  useEffect(() => {
    if (!aperta) return
    const onTasto = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onChiudi()
    }
    document.addEventListener('keydown', onTasto)
    return () => document.removeEventListener('keydown', onTasto)
  }, [aperta, onChiudi])

  return (
    <>
      {/* Sfondo scuro sotto il menu a scomparsa su mobile */}
      {aperta && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onChiudi}
          aria-hidden
        />
      )}

      <aside
        inert={nascosto ? true : undefined}
        aria-hidden={nascosto ? true : undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          aperta ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <Logo />
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi menu"
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto p-3" aria-label="Menu principale">
          <ul className="space-y-0.5">
            {VOCI_MENU.map(({ etichetta, percorso, icona: Icona }) => (
              <li key={percorso}>
                <NavLink
                  to={percorso}
                  end={percorso === '/'}
                  onClick={onChiudi}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] transition-colors',
                      isActive
                        ? 'bg-brand font-semibold text-white'
                        : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  <Icona size={18} strokeWidth={1.9} className="shrink-0" />
                  <span className="truncate">{etichetta}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-line p-4">
          <Logo compatto className="mb-3" />
          <p className="text-[13px] font-bold text-ink">{azienda.nome}</p>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-tight text-ink-faint">
            <li>
              {azienda.indirizzo}
              <br />
              {azienda.citta}
            </li>
            <li>
              <a href={`tel:${azienda.telefono.replace(/\s/g, '')}`} className="hover:text-ink-muted">
                {azienda.telefono}
              </a>
            </li>
            <li>
              <a href={`mailto:${azienda.email}`} className="break-all hover:text-ink-muted">
                {azienda.email}
              </a>
            </li>
          </ul>
        </div>
      </aside>
    </>
  )
}

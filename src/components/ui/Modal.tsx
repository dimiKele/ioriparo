import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useModale } from '@/lib/useModale'

/** Finestra modale con chiusura da ESC e da click sullo sfondo. */
export function Modal({
  aperta,
  titolo,
  sottotitolo,
  onChiudi,
  children,
  piede,
  larghezza = 'md',
}: {
  aperta: boolean
  titolo: string
  sottotitolo?: string
  onChiudi: () => void
  children: ReactNode
  piede?: ReactNode
  larghezza?: 'sm' | 'md' | 'lg'
}) {
  const contenitore = useModale(aperta, onChiudi)

  if (!aperta) return null

  const larghezze = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onChiudi}
        aria-hidden
      />
      <div
        ref={contenitore}
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        className={cn(
          'relative z-10 my-8 w-full rounded-card border border-line-soft bg-surface shadow-2xl',
          larghezze[larghezza],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{titolo}</h2>
            {sottotitolo && <p className="mt-0.5 text-xs text-ink-faint">{sottotitolo}</p>}
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        {piede && (
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{piede}</footer>
        )}
      </div>
    </div>
  )
}

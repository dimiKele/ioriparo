import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Database, RotateCcw, Trash2 } from 'lucide-react'

const CHIAVE_STORAGE = 'ioriparo:db:v1'

/**
 * Ultima rete di protezione: senza di essa un singolo dato incoerente
 * produce una pagina bianca da cui l'utente non può recuperare l'archivio.
 * Le azioni offerte lavorano direttamente su `localStorage`, perché in questo
 * stato non si può contare sul funzionamento dello store.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { errore: Error | null }> {
  state = { errore: null as Error | null }

  static getDerivedStateFromError(errore: Error) {
    return { errore }
  }

  componentDidCatch(errore: Error, info: ErrorInfo) {
    console.error('Errore non gestito:', errore, info.componentStack)
  }

  /** Scarica l'archivio grezzo così com'è, prima di qualsiasi tentativo di riparazione. */
  private scaricaArchivio = () => {
    try {
      const grezzo = window.localStorage.getItem(CHIAVE_STORAGE) ?? '{}'
      const url = URL.createObjectURL(new Blob([grezzo], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'ioriparo-archivio-recuperato.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.alert('Non è stato possibile leggere l’archivio dal browser.')
    }
  }

  private ripristinaDemo = () => {
    const conferma = window.confirm(
      'Vuoi cancellare l’archivio salvato in questo browser e ripartire dai dati dimostrativi? L’operazione non è reversibile: esporta prima una copia.',
    )
    if (!conferma) return
    try {
      window.localStorage.removeItem(CHIAVE_STORAGE)
    } catch {
      // Nulla da fare: si ricarica comunque.
    }
    window.location.reload()
  }

  render() {
    if (!this.state.errore) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-4">
        <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6">
          <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/12 text-amber-400">
            <AlertTriangle size={20} />
          </span>

          <h1 className="mt-4 text-lg font-semibold text-ink">Si è verificato un errore</h1>
          <p className="mt-2 text-sm text-ink-muted">
            L’applicazione ha incontrato un problema e non può continuare. I dati salvati nel
            browser non sono stati toccati: esporta una copia prima di tentare un ripristino.
          </p>

          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11px] break-words text-ink-faint">
            {this.state.errore.message || 'Errore sconosciuto'}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.scaricaArchivio}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white"
            >
              <Database size={15} />
              Esporta archivio
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 text-[13px] font-semibold text-ink"
            >
              <RotateCcw size={15} />
              Ricarica
            </button>
            <button
              type="button"
              onClick={this.ripristinaDemo}
              className="inline-flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 text-[13px] font-semibold text-rose-400"
            >
              <Trash2 size={15} />
              Azzera archivio
            </button>
          </div>
        </div>
      </div>
    )
  }
}

import { Link } from 'react-router-dom'
import { AlertTriangle, Info, X } from 'lucide-react'
import { useGestionale } from '@/data/store'

/**
 * Striscia di avviso sopra il contenuto: segnala il mancato salvataggio
 * (spazio esaurito) e le correzioni applicate all'archivio all'avvio.
 * Sono entrambe condizioni che, se taciute, fanno perdere dati all'utente.
 */
export function AvvisiArchivio() {
  const { erroreArchivio, avvisiArchivio, ignoraAvvisiArchivio } = useGestionale()

  if (!erroreArchivio && avvisiArchivio.length === 0) return null

  return (
    <div className="mb-4 space-y-3">
      {erroreArchivio && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-rose-300">Modifiche non salvate</p>
            <p className="mt-1 text-[13px] text-ink-muted">{erroreArchivio}</p>
            <Link
              to="/backup"
              className="mt-2 inline-block text-[13px] font-semibold text-rose-300 underline underline-offset-2"
            >
              Vai a Backup ed esporta una copia
            </Link>
          </div>
        </div>
      )}

      {avvisiArchivio.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-amber-300">
              L’archivio è stato corretto all’apertura
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-muted">
              {avvisiArchivio.map((avviso) => (
                <li key={avviso}>{avviso}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={ignoraAvvisiArchivio}
            aria-label="Nascondi l’avviso"
            className="shrink-0 self-start text-ink-faint transition-colors hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

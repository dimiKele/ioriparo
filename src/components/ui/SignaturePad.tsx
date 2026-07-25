import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/** Inchiostro e carta del riquadro: gli stessi colori finiscono nel PNG stampato. */
const COLORE_CARTA = '#ffffff'
const COLORE_INCHIOSTRO = '#101828'

/**
 * Riquadro per la firma del cliente all'accettazione.
 *
 * Disegna su canvas (mouse o touch) ed esporta un PNG in data URL. Il riquadro
 * è volutamente bianco anche nel tema scuro: il PNG viene riprodotto tale e
 * quale sul documento stampato, dove un tratto chiaro sarebbe invisibile.
 */
export function SignaturePad({
  valore,
  onChange,
  altezza = 150,
}: {
  valore?: string
  onChange: (dataUrl: string | undefined) => void
  altezza?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const disegnando = useRef(false)
  /** Diventa vero solo dopo un tratto reale: un tocco singolo non è una firma. */
  const traccia = useRef(false)
  // Evita che il riquadro venga ricostruito a ogni tratto (`valore` cambia a ogni `onChange`).
  const valoreRef = useRef(valore)
  valoreRef.current = valore
  const [vuota, setVuota] = useState(!valore)

  /** Prepara contesto, sfondo e stile del tratto dopo ogni ridimensionamento. */
  const preparaContesto = useCallback(
    (canvas: HTMLCanvasElement, larghezza: number) => {
      const rapporto = window.devicePixelRatio || 1
      canvas.width = larghezza * rapporto
      canvas.height = altezza * rapporto
      canvas.style.width = `${larghezza}px`
      canvas.style.height = `${altezza}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.scale(rapporto, rapporto)
      ctx.fillStyle = COLORE_CARTA
      ctx.fillRect(0, 0, larghezza, altezza)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = COLORE_INCHIOSTRO
      return ctx
    },
    [altezza],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const adatta = () => {
      const larghezza = canvas.parentElement?.clientWidth ?? 300
      const ctx = preparaContesto(canvas, larghezza)
      if (!ctx) return

      // Ridisegna la firma già acquisita dopo un ridimensionamento.
      const firma = valoreRef.current
      if (firma) {
        const immagine = new Image()
        immagine.onload = () => ctx.drawImage(immagine, 0, 0, larghezza, altezza)
        immagine.src = firma
      }
    }

    adatta()
    window.addEventListener('resize', adatta)
    return () => window.removeEventListener('resize', adatta)
  }, [altezza, preparaContesto])

  // Ripulisce il riquadro quando la firma viene azzerata dall'esterno.
  useEffect(() => {
    if (valore) return
    const canvas = canvasRef.current
    if (!canvas) return
    preparaContesto(canvas, canvas.parentElement?.clientWidth ?? 300)
    traccia.current = false
    setVuota(true)
  }, [valore, preparaContesto])

  function posizione(evento: React.PointerEvent<HTMLCanvasElement>) {
    const rettangolo = evento.currentTarget.getBoundingClientRect()
    return { x: evento.clientX - rettangolo.left, y: evento.clientY - rettangolo.top }
  }

  function inizia(evento: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    evento.currentTarget.setPointerCapture(evento.pointerId)
    disegnando.current = true
    const { x, y } = posizione(evento)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function muovi(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (!disegnando.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = posizione(evento)
    ctx.lineTo(x, y)
    ctx.stroke()
    traccia.current = true
    if (vuota) setVuota(false)
  }

  function termina() {
    if (!disegnando.current) return
    disegnando.current = false
    // Senza tratti il canvas conterrebbe solo il fondo bianco: non è una firma.
    if (!traccia.current) return
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL('image/png'))
  }

  function pulisci() {
    const canvas = canvasRef.current
    if (!canvas) return
    preparaContesto(canvas, canvas.parentElement?.clientWidth ?? 300)
    traccia.current = false
    setVuota(true)
    onChange(undefined)
  }

  return (
    <div className="relative rounded-lg border border-line-soft bg-white">
      <canvas
        ref={canvasRef}
        onPointerDown={inizia}
        onPointerMove={muovi}
        onPointerUp={termina}
        onPointerCancel={termina}
        onPointerLeave={termina}
        className="block w-full touch-none rounded-lg"
        style={{ height: altezza }}
        aria-label="Riquadro per la firma del cliente"
      />

      {vuota && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
          Firma qui con il dito o con il mouse
        </p>
      )}

      <button
        type="button"
        onClick={pulisci}
        className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-500 transition-colors hover:text-slate-900"
      >
        <Eraser size={12} />
        Pulisci
      </button>
    </div>
  )
}

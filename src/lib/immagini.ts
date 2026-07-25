/**
 * Riduzione delle immagini acquisite in accettazione.
 *
 * Le foto vengono conservate come data URL dentro l'archivio: senza una
 * ricompressione una singola foto da fotocamera (3-5 MB, ~7 MB in base64)
 * basta a saturare lo spazio disponibile nel browser.
 */

/** Lato lungo massimo in pixel: sufficiente a documentare graffi e ammaccature. */
export const LATO_MASSIMO = 1600
export const QUALITA_JPEG = 0.75

export const TIPI_IMMAGINE_AMMESSI = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/** Limite di sicurezza sul file di partenza, prima ancora di decodificarlo. */
export const DIMENSIONE_MASSIMA_FILE = 25 * 1024 * 1024

export class ErroreImmagine extends Error {}

function caricaImmagine(file: File): Promise<HTMLImageElement> {
  return new Promise((risolvi, rifiuta) => {
    const url = URL.createObjectURL(file)
    const immagine = new Image()
    immagine.onload = () => {
      URL.revokeObjectURL(url)
      risolvi(immagine)
    }
    immagine.onerror = () => {
      URL.revokeObjectURL(url)
      rifiuta(new ErroreImmagine(`Impossibile leggere «${file.name}»: formato non supportato.`))
    }
    immagine.src = url
  })
}

/**
 * Ridimensiona e ricomprime in JPEG, restituendo un data URL.
 * Le immagini già più piccole del limite vengono comunque ricompresse:
 * un PNG da fotocamera pesa molto più del JPEG equivalente.
 */
export async function comprimiImmagine(file: File): Promise<string> {
  if (file.size > DIMENSIONE_MASSIMA_FILE) {
    throw new ErroreImmagine(
      `«${file.name}» supera i ${Math.round(DIMENSIONE_MASSIMA_FILE / 1024 / 1024)} MB.`,
    )
  }
  if (!file.type.startsWith('image/')) {
    throw new ErroreImmagine(`«${file.name}» non è un'immagine.`)
  }

  const immagine = await caricaImmagine(file)
  const scala = Math.min(1, LATO_MASSIMO / Math.max(immagine.width, immagine.height))
  const larghezza = Math.max(1, Math.round(immagine.width * scala))
  const altezza = Math.max(1, Math.round(immagine.height * scala))

  const canvas = document.createElement('canvas')
  canvas.width = larghezza
  canvas.height = altezza
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ErroreImmagine('Il browser non consente di elaborare le immagini.')

  // Sfondo bianco: il JPEG non ha trasparenza e un PNG trasparente diventerebbe nero.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, larghezza, altezza)
  ctx.drawImage(immagine, 0, 0, larghezza, altezza)

  return canvas.toDataURL('image/jpeg', QUALITA_JPEG)
}

/** Peso approssimativo in byte di un data URL base64. */
export function pesoDataUrl(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

export function formatPeso(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`
  return `${(byte / 1024 / 1024).toFixed(1)} MB`
}

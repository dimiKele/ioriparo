import { useEffect, useState } from 'react'

/** Segue una media query CSS dal lato JavaScript. */
export function useMediaQuery(query: string): boolean {
  const [corrisponde, setCorrisponde] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const lista = window.matchMedia(query)
    const aggiorna = () => setCorrisponde(lista.matches)
    aggiorna()
    lista.addEventListener('change', aggiorna)
    return () => lista.removeEventListener('change', aggiorna)
  }, [query])

  return corrisponde
}

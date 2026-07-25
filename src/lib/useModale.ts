import { useEffect, useRef } from 'react'

/**
 * Comportamenti comuni a tutte le finestre sovrapposte.
 *
 * Le modali possono impilarsi (dettaglio → anteprima di stampa): senza una
 * pila condivisa un solo ESC le chiuderebbe tutte, e la prima a chiudersi
 * sbloccherebbe lo scorrimento della pagina anche sotto quelle rimaste aperte.
 */
const pila: symbol[] = []

const SELETTORE_FOCUSABILI =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useModale(aperta: boolean, onChiudi: () => void) {
  const contenitore = useRef<HTMLDivElement>(null)
  // La funzione di chiusura è quasi sempre una lambda inline: tenerla in un
  // ref evita di registrare e rimuovere i listener a ogni render.
  const chiudi = useRef(onChiudi)
  chiudi.current = onChiudi

  useEffect(() => {
    if (!aperta) return

    const chiave = Symbol('modale')
    pila.push(chiave)
    document.body.style.overflow = 'hidden'
    const attivoPrima = document.activeElement as HTMLElement | null

    const inCima = () => pila[pila.length - 1] === chiave

    const onTasto = (evento: KeyboardEvent) => {
      if (!inCima()) return

      if (evento.key === 'Escape') {
        evento.stopPropagation()
        chiudi.current()
        return
      }

      // Trappola del focus: senza, si esce dalla modale con Tab e si finisce a
      // navigare la pagina sottostante senza accorgersene.
      if (evento.key !== 'Tab') return
      const nodo = contenitore.current
      if (!nodo) return
      const focusabili = [...nodo.querySelectorAll<HTMLElement>(SELETTORE_FOCUSABILI)].filter(
        (elemento) => elemento.offsetParent !== null,
      )
      if (focusabili.length === 0) return

      const primo = focusabili[0]
      const ultimo = focusabili[focusabili.length - 1]
      const attivo = document.activeElement

      if (evento.shiftKey && (attivo === primo || !nodo.contains(attivo))) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && attivo === ultimo) {
        evento.preventDefault()
        primo.focus()
      }
    }

    document.addEventListener('keydown', onTasto)

    // Porta il focus dentro la finestra appena si apre.
    const primoCampo = contenitore.current?.querySelector<HTMLElement>(SELETTORE_FOCUSABILI)
    primoCampo?.focus()

    return () => {
      document.removeEventListener('keydown', onTasto)
      const indice = pila.indexOf(chiave)
      if (indice >= 0) pila.splice(indice, 1)
      if (pila.length === 0) document.body.style.overflow = ''
      attivoPrima?.focus?.()
    }
  }, [aperta])

  return contenitore
}

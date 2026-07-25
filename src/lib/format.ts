/** Formattatori localizzati in italiano usati in tutta l'interfaccia. */

const decimali = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const interi = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })

const numero = new Intl.NumberFormat('it-IT')

/** Simbolo anteposto, come sui documenti del gestionale: `€ 620,00`. */
export function formatEuro(valore: number): string {
  return `€ ${decimali.format(valore)}`
}

/** Senza decimali, per assi dei grafici e spazi stretti: `€ 12.450`. */
export function formatEuroCompatto(valore: number): string {
  return `€ ${interi.format(valore)}`
}

/**
 * Sceglie il formato in base alla lunghezza: decimali fino a 999,99 e importo
 * arrotondato oltre, così i riquadri statistica non tagliano il testo.
 */
export function formatEuroAuto(valore: number): string {
  return Math.abs(valore) >= 1000 ? formatEuroCompatto(valore) : formatEuro(valore)
}

export function formatNumero(valore: number): string {
  return numero.format(valore)
}

/** `2024-05-18` → `18/05/2024`. */
export function formatData(iso?: string): string {
  if (!iso) return '--'
  const [anno, mese, giorno] = iso.split('-')
  if (!anno || !mese || !giorno) return iso
  return `${giorno}/${mese}/${anno}`
}

/** `2024-05-18` → `18 mag 2024`. */
export function formatDataEstesa(iso?: string): string {
  if (!iso) return '--'
  const data = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Istante ISO completo → `26/07/2026, 14:32`. */
export function formatDataOra(iso?: string): string {
  if (!iso) return '--'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso
  return data.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function oggiISO(): string {
  const ora = new Date()
  const offset = ora.getTimezoneOffset() * 60_000
  return new Date(ora.getTime() - offset).toISOString().slice(0, 10)
}

/** Giorni che mancano a una data (negativo se già passata). */
export function giorniAllaData(iso: string): number {
  const target = new Date(`${iso}T00:00:00`).getTime()
  const oggi = new Date(`${oggiISO()}T00:00:00`).getTime()
  return Math.round((target - oggi) / 86_400_000)
}

/** Etichetta relativa: «tra 3 giorni», «scaduta da 2 giorni», «oggi». */
export function scadenzaRelativa(iso: string): string {
  const giorni = giorniAllaData(iso)
  if (giorni === 0) return 'Scade oggi'
  if (giorni === 1) return 'Scade domani'
  if (giorni === -1) return 'Scaduta ieri'
  if (giorni > 0) return `Scade tra ${giorni} giorni`
  return `Scaduta da ${Math.abs(giorni)} giorni`
}

/**
 * Link a WhatsApp con prefisso internazionale corretto.
 *
 * Il campo telefono è libero: anteporre `39` senza controlli rompe i numeri
 * già scritti come `+39 …` o `0039 …`. Si considera internazionale solo ciò
 * che l'utente ha esplicitamente marcato come tale.
 */
export function linkWhatsApp(telefono: string | undefined): string | undefined {
  if (!telefono) return undefined
  const pulito = telefono.trim()
  const cifre = pulito.replace(/\D/g, '')
  if (cifre.length < 6) return undefined

  if (pulito.startsWith('+')) return `https://wa.me/${cifre}`
  if (cifre.startsWith('00')) return `https://wa.me/${cifre.slice(2)}`
  return `https://wa.me/39${cifre}`
}

/** Iniziali per gli avatar, es. «Studio Tecnico Bianchi» → «SB». */
export function iniziali(nome: string): string {
  const parole = nome.trim().split(/\s+/).filter(Boolean)
  if (parole.length === 0) return '?'
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase()
  return (parole[0][0] + parole[parole.length - 1][0]).toUpperCase()
}

/** Abbrevia il cognome come nelle liste: «Giuseppe Nardelli» → «Giuseppe N.». */
export function nomeAbbreviato(nome: string): string {
  const parole = nome.trim().split(/\s+/)
  if (parole.length < 2) return nome
  return `${parole[0]} ${parole[1][0]}.`
}

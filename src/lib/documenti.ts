/**
 * Numerazione e composizione dei documenti commerciali.
 *
 * I numeri seguono un modello configurabile in Impostazioni con due
 * segnaposto: `{n}` per il progressivo e `{anno}` per l'anno di emissione
 * (per esempio `{n}/{anno}` → `0007/2026`).
 */

import type { Fattura, Preventivo, RigaIntervento, Riparazione } from '@/types'

export const FORMATO_FATTURA_PREDEFINITO = '{n}/{anno}'
export const FORMATO_PREVENTIVO_PREDEFINITO = 'P{aa}-{n}'
/** Gli ordini a fornitore non sono documenti fiscali: la serie è fissa. */
export const FORMATO_ORDINE = 'O{aa}-{n}'

const CIFRE_PROGRESSIVO = 4

/** `{anno}` è l'anno per esteso, `{aa}` le sole ultime due cifre. */
export function componiNumero(formato: string, progressivo: number, anno: number): string {
  return formato
    .replaceAll('{n}', String(progressivo).padStart(CIFRE_PROGRESSIVO, '0'))
    .replaceAll('{anno}', String(anno))
    .replaceAll('{aa}', String(anno).slice(-2))
}

function escapeRegex(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Primo progressivo libero per l'anno indicato.
 * Considera solo i numeri che rispettano il modello: quelli di altre annate o
 * di formati precedenti non devono far saltare la serie in corso.
 */
export function prossimoProgressivo(numeri: string[], formato: string, anno: number): number {
  const modello = new RegExp(
    `^${escapeRegex(formato)
      .replace('\\{n\\}', '(\\d+)')
      .replaceAll('\\{anno\\}', String(anno))
      .replaceAll('\\{aa\\}', String(anno).slice(-2))}$`,
  )

  let massimo = 0
  for (const numero of numeri) {
    const trovato = modello.exec(numero.trim())
    if (!trovato) continue
    const progressivo = Number.parseInt(trovato[1] ?? '0', 10)
    if (Number.isFinite(progressivo)) massimo = Math.max(massimo, progressivo)
  }
  return massimo + 1
}

/** Il modello è utilizzabile solo se contiene il segnaposto del progressivo. */
export function formatoValido(formato: string): boolean {
  return formato.includes('{n}')
}

let progressivoRiga = 0
function idRiga(): string {
  progressivoRiga += 1
  return `rig-${Date.now().toString(36)}${progressivoRiga.toString(36)}`
}

export function rigaVuota(): RigaIntervento {
  return { id: idRiga(), descrizione: '', quantita: 1, prezzoUnitario: 0 }
}

export function clonaRighe(righe: RigaIntervento[]): RigaIntervento[] {
  return righe.map((riga) => ({ ...riga, id: idRiga() }))
}

export const DESCRIZIONE_ACCONTO = 'Acconto già versato all’accettazione'

/**
 * Righe di un documento generato da una riparazione.
 * L'acconto compare come detrazione: il cliente vede il valore pieno
 * dell'intervento e quanto ha già pagato.
 */
export function righeDaRiparazione(
  riparazione: Riparazione,
  includiAcconto: boolean,
): RigaIntervento[] {
  const righe = clonaRighe(riparazione.interventi)
  if (includiAcconto && riparazione.acconto && riparazione.acconto > 0) {
    righe.push({
      id: idRiga(),
      descrizione: DESCRIZIONE_ACCONTO,
      quantita: 1,
      prezzoUnitario: -riparazione.acconto,
    })
  }
  return righe
}

/** Data ISO spostata di `giorni` rispetto a una data ISO di partenza. */
export function dataPiuGiorni(iso: string, giorni: number): string {
  const data = new Date(`${iso}T00:00:00`)
  data.setDate(data.getDate() + giorni)
  const mese = String(data.getMonth() + 1).padStart(2, '0')
  const giorno = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mese}-${giorno}`
}

/** Un documento è modificabile finché non è stato accettato/incassato. */
export function preventivoModificabile(preventivo: Preventivo): boolean {
  return preventivo.stato !== 'accettato' && preventivo.stato !== 'rifiutato'
}

export function fatturaModificabile(fattura: Fattura): boolean {
  return fattura.stato !== 'pagata' && fattura.stato !== 'annullata'
}

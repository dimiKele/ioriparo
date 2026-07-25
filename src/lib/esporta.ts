/** Esportazione di dati in CSV e JSON tramite download nel browser. */

import { oggiISO } from './format'

function scarica(contenuto: BlobPart, nomeFile: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }))
  const link = document.createElement('a')
  link.href = url
  link.download = nomeFile
  document.body.appendChild(link)
  link.click()
  link.remove()
  // La revoca immediata interrompe il download su alcuni browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Caratteri che nei fogli di calcolo trasformano una cella in formula. */
const AVVIO_FORMULA = /^[=+\-@\t\r]/

function cella(valore: unknown): string {
  const testo = valore === null || valore === undefined ? '' : String(valore)
  // Il testo delle anagrafiche è libero: senza questo apice un valore come
  // `=HYPERLINK(...)` verrebbe eseguito all'apertura del file in Excel.
  const sicuro = AVVIO_FORMULA.test(testo) ? `'${testo}` : testo
  return `"${sicuro.replace(/"/g, '""')}"`
}

/**
 * Numero con virgola decimale: in locale italiano Excel interpreta `199.00`
 * come testo (o come data), rendendo inutilizzabili le colonne importo.
 */
export function numeroCsv(valore: number | undefined, decimali = 2): string | undefined {
  if (valore === undefined || !Number.isFinite(valore)) return undefined
  return valore.toFixed(decimali).replace('.', ',')
}

/**
 * Genera un CSV con separatore `;` (atteso da Excel in locale italiano)
 * e BOM UTF-8 per la corretta resa degli accenti.
 */
export function esportaCsv(
  nomeFile: string,
  intestazioni: string[],
  righe: Array<Array<string | number | undefined>>,
) {
  const contenuto = [intestazioni, ...righe].map((riga) => riga.map(cella).join(';')).join('\r\n')
  scarica(`﻿${contenuto}`, nomeFile, 'text/csv;charset=utf-8')
}

export function esportaJson(nomeFile: string, dati: unknown) {
  scarica(JSON.stringify(dati, null, 2), nomeFile, 'application/json')
}

/** Nome file con data odierna locale, es. `riparazioni-2024-05-18.csv`. */
export function nomeFileConData(prefisso: string, estensione: string): string {
  return `${prefisso}-${oggiISO()}.${estensione}`
}

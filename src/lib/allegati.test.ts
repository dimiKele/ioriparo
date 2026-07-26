import { describe, expect, it } from 'vitest'
import { aDataUrl, daDataUrl, impronta } from './allegati'

const JPEG_MINIMO =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

describe('impronta', () => {
  it('è stabile per lo stesso contenuto', () => {
    expect(impronta(JPEG_MINIMO)).toBe(impronta(JPEG_MINIMO))
  })

  it('cambia se l’immagine cambia', () => {
    // È il perno del meccanismo: senza distinzione, un'immagine sostituita non
    // verrebbe mai ricaricata, e una identica verrebbe caricata a ogni giro.
    expect(impronta(JPEG_MINIMO)).not.toBe(impronta(`${JPEG_MINIMO}A`))
  })

  it('distingue contenuti della stessa lunghezza', () => {
    expect(impronta('data:image/jpeg;base64,AAAB')).not.toBe(impronta('data:image/jpeg;base64,AAAC'))
  })
})

describe('conversione dei data URL', () => {
  it('estrae byte e tipo MIME', () => {
    const immagine = daDataUrl(JPEG_MINIMO)
    expect(immagine).not.toBeNull()
    expect(immagine?.tipoMime).toBe('image/jpeg')
    expect(immagine?.byte.length).toBeGreaterThan(0)
    // Un JPEG comincia sempre con questi due byte.
    expect(immagine?.byte[0]).toBe(0xff)
    expect(immagine?.byte[1]).toBe(0xd8)
  })

  it('rifiuta ciò che non è un data URL base64', () => {
    expect(daDataUrl('https://esempio.it/foto.jpg')).toBeNull()
    expect(daDataUrl('data:image/svg+xml,<svg/>')).toBeNull()
    expect(daDataUrl('')).toBeNull()
  })

  it('il giro completo restituisce l’immagine di partenza', () => {
    const immagine = daDataUrl(JPEG_MINIMO)
    expect(aDataUrl(immagine!.byte, immagine!.tipoMime)).toBe(JPEG_MINIMO)
  })

  it('regge immagini più grandi del blocco di conversione', () => {
    // `String.fromCharCode` con troppi argomenti fa saltare lo stack: la
    // conversione procede a blocchi e questo test lo verifica.
    const byte = new Uint8Array(50_000).map((_, i) => i % 256)
    const dataUrl = aDataUrl(byte, 'image/jpeg')
    expect(daDataUrl(dataUrl)?.byte.length).toBe(50_000)
  })
})

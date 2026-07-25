/**
 * Foglio di stile dei documenti stampabili (scheda di accettazione, preventivo,
 * fattura). È una stringa perché serve in due contesti: nel documento generato
 * al volo per la stampa e nel file HTML scaricabile quando la stampa diretta
 * non è disponibile. Volutamente indipendente da Tailwind e dal tema scuro.
 */
export const CSS_STAMPA = `
  @page { size: A4; margin: 14mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: #fff;
    color: #14181f;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc { max-width: 190mm; margin: 0 auto; padding: 8mm 0; }

  .doc-testata {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 2px solid #14181f;
    padding-bottom: 10px;
  }

  .doc-marchio { display: flex; align-items: center; gap: 10px; }
  .doc-marchio svg { width: 34px; height: 34px; }
  .doc-marchio-nome { font-size: 16pt; font-weight: 800; letter-spacing: -0.3px; }
  .doc-marchio-claim {
    font-size: 6.5pt;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: #5d6675;
  }

  .doc-azienda { text-align: right; font-size: 8.5pt; color: #4b5563; }
  .doc-azienda strong { color: #14181f; }

  .doc-titolo { margin: 16px 0 2px; font-size: 15pt; font-weight: 700; }
  .doc-sottotitolo { font-size: 9pt; color: #5d6675; }

  .doc-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 28px;
    margin-top: 10px;
    padding: 8px 12px;
    background: #f3f5f8;
    border: 1px solid #dde2ea;
    border-radius: 6px;
    font-size: 9.5pt;
  }
  .doc-meta div { min-width: 90px; }
  .doc-meta dt {
    font-size: 6.5pt;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6b7280;
  }
  .doc-meta dd { margin: 1px 0 0; font-weight: 600; }

  .doc-griglia {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
  }

  .doc-sezione {
    border: 1px solid #dde2ea;
    border-radius: 6px;
    padding: 10px 12px;
    break-inside: avoid;
  }
  .doc-sezione h2 {
    margin: 0 0 6px;
    font-size: 7pt;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #6b7280;
  }
  .doc-sezione p { margin: 0; }

  .doc-campi { display: grid; gap: 3px; font-size: 10pt; }
  .doc-campo { display: flex; justify-content: space-between; gap: 12px; }
  .doc-campo span:first-child { color: #6b7280; }
  .doc-campo span:last-child { font-weight: 600; text-align: right; }

  .doc-elenco { margin: 0; padding-left: 16px; font-size: 10pt; }

  .doc-testo {
    margin-top: 14px;
    border: 1px solid #dde2ea;
    border-radius: 6px;
    padding: 10px 12px;
    break-inside: avoid;
  }

  table.doc-tabella {
    width: 100%;
    margin-top: 14px;
    border-collapse: collapse;
    font-size: 10pt;
  }
  table.doc-tabella th {
    text-align: left;
    padding: 6px 8px;
    background: #14181f;
    color: #fff;
    font-size: 7pt;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  table.doc-tabella td { padding: 6px 8px; border-bottom: 1px solid #e5e9f0; }
  table.doc-tabella .num { text-align: right; font-variant-numeric: tabular-nums; }
  table.doc-tabella .cen { text-align: center; }

  .doc-totali {
    margin-top: 10px;
    margin-left: auto;
    width: 62mm;
    font-size: 10pt;
  }
  .doc-totali div { display: flex; justify-content: space-between; padding: 3px 0; }
  .doc-totali .num { font-variant-numeric: tabular-nums; }
  .doc-totali .totale {
    margin-top: 4px;
    border-top: 2px solid #14181f;
    padding-top: 5px;
    font-size: 12pt;
    font-weight: 700;
  }

  .doc-firme {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 20px;
    break-inside: avoid;
  }
  .doc-foto {
    margin-top: 16px;
    break-inside: avoid;
  }
  .doc-foto h2 {
    margin: 0 0 6px;
    font-size: 8pt;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6b7280;
  }
  .doc-foto-griglia {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .doc-foto-griglia img {
    width: 32mm;
    height: 42mm;
    object-fit: cover;
    border: 1px solid #dde2ea;
    border-radius: 4px;
  }
  .doc-firma-riquadro {
    height: 26mm;
    border: 1px solid #dde2ea;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }
  .doc-firma-riquadro img { max-height: 100%; max-width: 100%; }
  .doc-firma-etichetta {
    margin-top: 4px;
    font-size: 7pt;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6b7280;
  }

  .doc-condizioni {
    margin-top: 16px;
    font-size: 7.5pt;
    line-height: 1.5;
    color: #4b5563;
    break-inside: avoid;
  }
  .doc-condizioni h2 {
    margin: 0 0 4px;
    font-size: 7pt;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #6b7280;
  }
  .doc-condizioni ol { margin: 0; padding-left: 14px; }

  .doc-piede {
    margin-top: 18px;
    border-top: 1px solid #dde2ea;
    padding-top: 6px;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #6b7280;
  }

  .doc-tagliando {
    margin-top: 14px;
    border-top: 1px dashed #9aa3b2;
    padding-top: 10px;
    break-inside: avoid;
  }

  .doc-pastiglia {
    display: inline-block;
    padding: 2px 7px;
    border: 1px solid #14181f;
    border-radius: 999px;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  /* Barra mostrata solo nel file scaricato, esclusa dalla stampa */
  .doc-barra {
    max-width: 190mm;
    margin: 12px auto 0;
    padding: 10px 14px;
    border: 1px solid #dde2ea;
    border-radius: 6px;
    background: #f3f5f8;
    font-size: 9.5pt;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .doc-barra button {
    border: 0;
    border-radius: 6px;
    background: #2563eb;
    color: #fff;
    padding: 7px 14px;
    font-size: 9.5pt;
    font-weight: 600;
    cursor: pointer;
  }

  @media print {
    .doc-barra { display: none; }
  }
`

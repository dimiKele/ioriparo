# IO RIPARO — Analisi del progetto e piano di lavoro

> Analisi effettuata il 25/07/2026 sul commit `3c80b0a`. Build (`tsc -b && vite build`) e lint
> (`oxlint`) passano senza errori; tutti i problemi elencati sono di natura funzionale, verificati
> leggendo il codice riga per riga.
>
> **Aggiornamento 26/07/2026 — le Fasi 0, 1, 2, 3 e 4 del piano sono state realizzate.**
> Le sezioni 3 e 4 restano come fotografia dello stato di partenza; l'elenco puntuale degli
> interventi è nella sezione 7 in fondo.

## 1. Stato del progetto in sintesi

L'app è un gestionale front-end **Vite + React 19 + TypeScript + Tailwind 4** senza backend:
tutti i dati vivono in `localStorage` (chiave `ioriparo:db:v1`) e all'avvio viene caricato un
dataset dimostrativo con date relative a oggi.

**Il quadro generale:** l'interfaccia è ampia e curata (14 pagine, stampa documenti, grafici,
export CSV), ma il livello di completezza è molto disomogeneo. Alcune aree hanno CRUD completo
(clienti, magazzino, scadenze, riparazioni), mentre **preventivi, fatture, ordini fornitori e
impianti sono di fatto pagine di sola consultazione**: si possono solo cambiare di stato, perché
lo store (`src/data/store.tsx`) non espone alcuna funzione di creazione o eliminazione per queste
collezioni. I documenti che si vedono esistono solo perché generati dal seed demo.

**Il flusso di lavoro centrale è interrotto:** accettazione → riparazione → consegna funziona,
ma da lì non si può generare né un preventivo né una fattura. Gli incassi in dashboard derivano
esclusivamente dalle fatture demo, scollegate dal lavoro reale dell'utente.

### Cronologia (4 commit)

| Commit | Contenuto |
| --- | --- |
| `0cb29e9` | App completa in un unico commit iniziale (tutte le pagine, store, seed, UI) |
| `28fe6f7` | Routing con fragment opzionale (`VITE_ROUTER=hash`) per hosting statico |
| `5587cdc` | Modulo di stampa: documenti dedicati per scheda, preventivo e fattura |
| `3c80b0a` | Fix stampa: attesa del commit del documento + acconto in stampa |

---

## 2. Cosa è stato fatto e funziona

### Riparazioni (l'area più completa)
- Elenco con chip per stato (persistito in URL), ricerca full-text anche su nome/telefono
  cliente, filtri per tipo/date/tecnico, ordinamento, paginazione, export CSV delle righe filtrate.
- Accettazione: selezione cliente esistente con ricerca, creazione cliente al volo, marche
  dipendenti dal tipo dispositivo, foto (max 8), firma su canvas HiDPI o da file, validazione
  con errori inline, codice progressivo automatico.
- Dettaglio: cambio stato con data consegna automatica, interventi/ricambi da magazzino,
  scorporo IVA, acconto e saldo, WhatsApp precompilato, stampa scheda con fallback download.
- Eliminazioni sempre con modale di conferma.

### Clienti
- CRUD completo con modale, filtro privato/azienda, ricerca, paginazione, export CSV.
- Scheda cliente con storico riparazioni e fatture, KPI, link WhatsApp.

### Magazzino
- CRUD completo, filtri (ricerca, categoria, sotto scorta), carico/scarico rapido ±1,
  KPI (valore magazzino, sotto scorta), margini per riga, export CSV, deep-link `?nuovo=1`.

### Scadenze
- Creazione promemoria con tipo/priorità/importo, toggle completata, filtri, badge dinamici.

### Stampa (recente, funzionante nell'impianto)
- Architettura solida: CSS A4 dedicato indipendente dal tema scuro, rendering in iframe
  `srcDoc`, fallback a download HTML se la stampa è bloccata.
- Tre documenti: scheda di accettazione (con condizioni di servizio e tagliando di ritiro),
  preventivo e fattura (componente commerciale condiviso).

### Infrastruttura
- Store con Context + localStorage, merge difensivo al caricamento, seed deterministico
  (PRNG) con date relative a oggi e riferimenti incrociati coerenti.
- Calcoli IVA: la convenzione "prezzi IVA inclusa, scorporo in visualizzazione" è applicata
  **coerentemente ovunque** — verificato che non esiste il classico bug di IVA sommata due volte,
  e con aliquota 22% lo scorporo quadra al centesimo.
- Dashboard e Statistiche con metriche memoizzate, grafici Recharts, empty state parziali.
- Backup JSON completo + 6 export CSV con BOM e `;` per Excel italiano.
- Routing completo, nessun link a rotte inesistenti; ricerca globale in topbar (riparazioni + clienti).

---

## 3. Cosa NON funziona — bug per gravità

### 🔴 Critici (perdita o corruzione dati, documenti inutilizzabili)

| # | Problema | Dove |
| --- | --- | --- |
| C1 | **Firma cliente invisibile in stampa**: il tratto è `#e8edf5` (chiaro, pensato per il tema scuro) su PNG trasparente → bianco su bianco sul documento stampato, proprio quello con valore legale. A video si vede, quindi il difetto è insidioso. | `SignaturePad.tsx:38-40`, `stiliStampa.ts:149-157` |
| C2 | **Import backup senza validazione**: bastano `{"clienti":[],"riparazioni":[]}` per passare il controllo; il DB corrotto viene subito persistito in localStorage e al reload il crash si ripete a ogni avvio (nessun ErrorBoundary in tutta l'app) → app irrecuperabile senza svuotare localStorage a mano. Import distruttivo senza modale di conferma. | `Backup.tsx:31-38`, `store.tsx:90-96,192` |
| C3 | **Foto come data URL saturano localStorage**: nessun resize/compressione, fino a 8 foto (~4-7 MB l'una in base64), tutto il DB in un'unica chiave da ~5 MB. Una sola riparazione con 2 foto può bloccare **tutti** i salvataggi futuri dell'intera app… | `FormRiparazione.tsx:211-215`, `types/index.ts:84-87` |
| C4 | …e il fallimento è **silenzioso**: `catch {}` vuoto sul `setItem` — l'utente continua a lavorare in memoria e perde tutto al refresh senza alcun avviso. | `store.tsx:90-96` |
| C5 | **Modifica del nome cliente scartata in silenzio**: il primo tasto nel campo nome scollega `clienteId`, così il salvataggio salta l'aggiornamento anagrafico e ripristina il vecchio id — nome, telefono, email corretti vengono persi senza errore. In "Nuova" lo stesso meccanismo crea clienti duplicati. | `FormRiparazione.tsx:270-274`, `ModificaRiparazione.tsx:33-44` |
| C6 | **Doppio carico magazzino**: ricevuto → in transito → ricevuto ricarica le stesse quantità (nessun flag di ricezione registrata); l'annullamento di un ordine ricevuto non storna nulla. | `OrdiniFornitori.tsx:66-74,170-178` |
| C7 | **I ricambi usati non scaricano mai il magazzino**: aggiungere un intervento con `articoloId` non tocca la giacenza (il commento nel tipo dice il contrario). Giacenze, sotto scorta e valore magazzino diventano fittizi. | `DettaglioRiparazione.tsx:72-92` |

### 🟠 Alti (dati sbagliati mostrati all'utente)

| # | Problema | Dove |
| --- | --- | --- |
| A1 | **Timezone UTC nelle serie storiche**: `toISOString()` su mezzanotte locale sposta tutto indietro di un giorno → il grafico "ultimi 30 giorni" non include mai l'incasso di oggi e contraddice la StatCard sulla stessa pagina; le finestre "ultimi N giorni" durano in realtà N+2 giorni. Esiste già `oggiISO()` corretto in `format.ts` ma qui non è usato. | `metriche.ts:90-93,125-127,188-190` |
| A2 | **Fatture e preventivi non scadono mai**: nessuna logica confronta `scadenza`/`validoFino` con oggi; lo stato `scaduta`/`scaduto` esiste solo nel seed. KPI "da incassare" e "valore inviati" gonfiati per sempre. | `Fatture.tsx`, `Preventivi.tsx:86-88` |
| A3 | **"Ricavi per categoria" e "più venduti" includono fatture non incassate** (emesse/scadute), mentre tutti gli altri KPI filtrano su `pagata`: i numeri non riconciliano mai tra loro. | `metriche.ts:131-132,193-194` |
| A4 | **Il totale della ciambella non è un totale**: `consegnato` viene sostituito con le sole consegne di oggi, ma il centro è etichettato "Totale"; il click porta a un filtro che mostra numeri diversi. | `metriche.ts:32-37`, `StatoDonut.tsx:63-64` |
| A5 | **CSV con importi `199.00`** (punto decimale) in un file dichiarato per Excel italiano (`;` + BOM): le colonne importo diventano testo o date. | `Backup.tsx:61+`, `Fatture.tsx:107`, ecc. |
| A6 | **Regressione da "consegnato" cancella per sempre la data di consegna** (undefined sovrascrive nello spread). | `DettaglioRiparazione.tsx:64-70` |
| A7 | **Eliminazioni senza integrità referenziale**: eliminare un cliente lascia orfani riparazioni/fatture/preventivi/impianti (fatture stampabili con intestatario `--`, documenti non più trovabili per nome); eliminare un articolo riclassifica retroattivamente i ricavi storici in "Manodopera e servizi". | `store.tsx:149,172`, `metriche.ts:196-199` |
| A8 | **Accettare un preventivo non aggiorna la riparazione collegata**, che resta `preventivo_inviato` per sempre: il tecnico non ha alcun segnale di poter iniziare. | `Preventivi.tsx:228-232` |
| A9 | **`prefissoCodice` libero rompe la numerazione**: un prefisso senza trattino fa ripartire tutti i codici da `0001` (duplicati). | `Impostazioni.tsx:114-117`, `store.tsx:129` |
| A10 | **Stampa senza attesa del caricamento iframe**: click rapido su "Stampa" con foto/firma pesanti → pagina bianca o senza firma. | `AnteprimaStampa.tsx:119-148` |

### 🟡 Medi (comportamenti errati in casi comuni)

- Righe d'ordine con lo stesso articolo si sovrascrivono al carico (snapshot stale: 10+5+3 → 13 invece di 18); righe con articolo eliminato saltate in silenzio — `OrdiniFornitori.tsx:67-71`.
- Quantità e prezzi **negativi** accettati sia nel form magazzino sia negli interventi (`min={0}` HTML non basta, non c'è `<form>`) — `Magazzino.tsx:102-122`, `DettaglioRiparazione.tsx:74`.
- `dataAccettazione` salvabile vuota → la scheda **sparisce da ogni filtro per data** — `FormRiparazione.tsx:388-394`.
- Un tap accidentale sul riquadro firma salva una firma bianca "valida" — `SignaturePad.tsx:60-85`.
- Ordinamento colonna "Cliente" ordina per id opaco (`cli-lx8k…`), non per nome; "Stato" ordina alfabeticamente l'enum ignorando il flusso di lavorazione — `RiparazioniList.tsx:344,355`.
- Form Impostazioni non si risincronizza dopo ripristino demo/import: si possono ri-sovrascrivere i dati appena ripristinati — `Impostazioni.tsx:18`.
- ESC chiude insieme anteprima di stampa e modale sottostante; alla chiusura dell'anteprima lo scroll del body si sblocca sotto la modale ancora aperta — `Modal.tsx:23-34` + `AnteprimaStampa.tsx:103-115`.
- `min-w-0` sulle tabelle è un no-op (`cn()` è un join, non tailwind-merge; vince la min-width maggiore in ordine CSS): le tabelle nelle modali scrollano sempre in orizzontale — `Tabella.tsx:9`.
- Link WhatsApp: prefisso `39` anteposto a numeri già in formato `+39` → link morto; numero topbar hardcodato che ignora Impostazioni — `DettaglioCliente.tsx:120`, `Topbar.tsx:294`.
- Errore form non azzerato dal bottone "Annulla" (riappare su form vuoto) — `ClientiList.tsx:325`, `Magazzino.tsx:397`, `Scadenze.tsx:175`.
- Data default scadenze congelata all'avvio dell'app: dopo mezzanotte i nuovi promemoria nascono "in ritardo" — `Scadenze.tsx:18-25`.
- Seed: fatture con scadenza già passata generate come `emessa` (soglia 32 vs 30 giorni) — `seed.ts:510-511`.
- CSV senza neutralizzazione di `= + - @` a inizio cella (CSV injection all'apertura in Excel) — `esporta.ts:14-17`.
- Titolo interpolato senza escaping nell'HTML di stampa (iframe same-origin non sandboxed) — `AnteprimaStampa.tsx:48`.
- Deploy statico: `vite.config.ts` senza `base` → asset 404 su project-site (es. GitHub Pages); `VITE_ROUTER` non documentato nel README.

### 🔵 Minori / UX (selezione)

- Aggiunta intervento fallisce in silenzio con campi vuoti (nessun messaggio, modale resta aperta) — `DettaglioRiparazione.tsx:76`.
- "Annulla" nel form di accettazione butta via tutto (foto, firma) senza conferma; nessun blocco su chiusura tab; filtri della lista persi al ritorno dal dettaglio.
- Chip di stato con conteggi globali che ignorano ricerca/filtri attivi.
- Acconto > totale mostra "Saldo € 0,00" nascondendo il credito da rimborsare.
- Cambio stato ordine (l'azione che muta le giacenze) è una select nel footer della modale, senza conferma né undo.
- Password di sblocco del dispositivo in chiaro a video e in localStorage.
- Righe di tabella cliccabili non raggiungibili da tastiera; modali senza focus trap; drawer mobile sempre nel tab order; contrasto `ink-faint` sotto AA; ricerca globale invisibile sotto 768px.
- Incoerenze di formato: "Incasso mese" con centesimi in Statistiche ma arrotondato in Dashboard; metodo pagamento mostrato come enum grezzo invece della mappa etichette già esistente.
- Google Fonts bloccante in `index.html` su un'app altrimenti offline-capable.

---

## 4. Cosa manca (funzionalità mai implementate)

### Il gap principale: metà delle entità è read-only

Lo store espone **solo aggiornamento** per: `preventivi`, `fatture`, `ordini`, `impianti`.
Conseguenze concrete:

- **Non si può creare un preventivo o una fattura.** Le azioni rapide in Dashboard "Nuovo
  preventivo"/"Nuova fattura" portano a liste senza alcun form (mentre "Nuovo cliente" e
  "Carico magazzino" funzionano): incoerenza visibile all'utente.
- **Non si può convertire**: preventivo accettato → riparazione/fattura, riparazione
  consegnata → fattura. `riparazioneId` su fatture non è mai popolato, nemmeno dal seed.
  L'acconto non confluisce in nessun documento.
- **Non si può creare/modificare un ordine fornitore** (righe, fornitore, date: tutto
  read-only; l'unico campo editabile è lo stato). Niente ricezione parziale, niente data di
  ricezione effettiva.
- **Non si può creare un impianto**, né modificarne nulla oltre lo stato — nemmeno
  riprogrammare `prossimaManutenzione`, che è il caso d'uso principale della pagina.
- **Le scadenze non si possono modificare** (solo creare/completare/eliminare).
- Nessuna **numerazione progressiva** per preventivi/fatture (esiste solo per le riparazioni),
  e i formati del seed sono divergenti (`P2025-0014` vs `0123/2025`).

### Altre mancanze rilevanti

- Nessuna anagrafica fornitori (testo libero → impossibile aggregare lo speso).
- Nessuno storico movimenti magazzino né timeline dei cambi stato riparazione.
- Nessun ponte sotto scorta → proposta d'ordine; manutenzioni impianti → scadenze; fatture scadute → scadenze/notifiche.
- Preventivi e impianti assenti dalla scheda cliente; ordini e impianti assenti dagli export CSV.
- Nessuna rotta di dettaglio `/preventivi/:id`, `/fatture/:id` (solo modali, non linkabili).
- Nessuna modifica di una riga intervento (solo elimina+ricrea); nessun controllo duplicati cliente; cliente creato dall'accettazione sempre `privato` senza dati fiscali.
- Nessun backup automatico pre-import, nessuna versione di schema nel JSON esportato.
- Foto del dispositivo non incluse nella scheda stampata; icona "scanner IMEI" puramente decorativa.
- Il selettore periodo di Statistiche governa solo 2 widget su 7; scontrino medio calcolato su tutto lo storico.
- Nessun ErrorBoundary; nessun test automatico di alcun tipo.

---

## 5. Piano di lavoro proposto

### Fase 0 — Rete di sicurezza (prerequisito di tutto) ✅
1. **ErrorBoundary** globale con azione di recupero (ripristino demo / export dati).
2. **Validazione completa dell'import backup** (tutte le 8 collezioni + `azienda` + enum degli
   stati), conferma prima dell'import, backup automatico pre-import, campo `versione` nel JSON.
3. **Notifica del fallimento di persistenza** (quota localStorage) invece del `catch {}` vuoto,
   con indicatore di quota.
4. **Foto: resize/compressione su canvas** prima del salvataggio (o migrazione a IndexedDB).
5. Fix **firma**: tratto scuro su sfondo bianco nell'export PNG (C1).

### Fase 1 — Bug critici sui flussi esistenti ✅
6. Fix collegamento cliente in modifica/creazione riparazione (C5).
7. Magazzino: scarico alla aggiunta ricambio + ripristino alla rimozione, controllo
   disponibilità (C7); flag `ricevutoIl` sugli ordini per impedire il doppio carico, con
   aggregazione per articolo (C6); blocco valori negativi nei form.
8. Date: usare `oggiISO()` ovunque nelle metriche (A1); preservare `dataConsegna` (A6);
   validare `dataAccettazione` obbligatoria.
9. Stati derivati: calcolare "scaduta/scaduto" a runtime da `scadenza`/`validoFino` (A2);
   allineare le metriche a `stato === 'pagata'` (A3); fix totale ciambella (A4).
10. CSV: importi con virgola decimale + neutralizzazione formule (A5).
11. Integrità referenziale: blocco o presa in carico esplicita di eliminazioni con riferimenti
    (contatore di entità impattate nella conferma) (A7).

### Fase 2 — Completare il ciclo documentale (il valore vero) ✅
12. `aggiungiPreventivo` / `aggiungiFattura` nello store + numerazione progressiva unificata.
13. Form di creazione/modifica preventivo e fattura (righe editabili almeno in bozza).
14. **Conversioni**: riparazione → preventivo → fattura, con `riparazioneId` popolato,
    acconto riportato in fattura, e aggiornamento dello stato riparazione all'accettazione
    del preventivo (A8).
15. Storno/annullamento fattura e ripristino da "pagata" errata.
16. Rotte di dettaglio `/preventivi/:id` e `/fatture/:id`.

### Fase 3 — Completare le aree read-only ✅
17. CRUD ordini fornitore (creazione, righe editabili, ricezione parziale con data,
    aggiornamento prezzo d'acquisto alla ricezione).
18. CRUD impianti (creazione, modifica completa, riprogrammazione manutenzione) +
    collegamento manutenzioni → scadenze e impianti nella scheda cliente.
19. Modifica scadenze + eliminazione con conferma.
20. Anagrafica fornitori minima.

### Fase 4 — UX e rifiniture ✅
21. Persistenza dei filtri in URL su tutte le liste; ordinamento su tutte le colonne sensate
    (per nome cliente, non per id); reset pagina coerente.
22. Conferma su azioni distruttive mancanti; protezione contro perdita del form di
    accettazione; feedback dopo il salvataggio cliente.
23. Accessibilità: righe attivabili da tastiera, focus trap nelle modali, combobox della
    ricerca, contrasto.
24. Fix modali/stampa: ESC a livelli, scroll body, attesa `onload` iframe, `min-w` tabelle.
25. Ricerca globale estesa (fatture, preventivi, magazzino) e visibile su mobile.
26. Deploy: `base` in vite.config, documentare `VITE_ROUTER`, font self-hosted.

### Fase 5 — Fondamenta a lungo termine (da decidere insieme)
27. Persistenza: IndexedDB (più capiente, foto separate dal DB) o backend vero.
28. Test automatici almeno su calcoli, metriche e store.
29. Timeline/audit degli eventi (cambi stato, movimenti magazzino).
30. Multi-postazione / sincronizzazione (richiede backend).

---

## 6. Decisioni prese (25/07/2026)

- **Destinazione d'uso: negozio reale.** L'ordine del piano resta quello sopra: prima la
  protezione dei dati (Fase 0-1), poi il ciclo documentale (Fase 2).
- **Persistenza: si andrà verso un backend vero** (API + database). Implicazione importante:
  non conviene investire molto su IndexedDB come tappa intermedia; in Fase 0 si fanno solo le
  mitigazioni minime su localStorage (compressione foto, avviso quota, validazione import),
  e la Fase 5 diventa la progettazione del backend. Lo store a Context con operazioni CRUD
  centralizzate è già una buona base per sostituire la persistenza sotto.
- **Fatture: per ora ricevute interne**, non documenti fiscali (FatturaPA rimandata a una
  decisione futura). Quindi in Fase 2 servono numerazione coerente e stampa corretta, senza
  vincoli SDI.
- **Nessuna modifica al codice per ora**: questo documento va rivisto e le priorità confermate
  prima di iniziare gli interventi.


---

## 7. Interventi realizzati (26/07/2026)

### Fase 0 — Rete di sicurezza dati
- **ErrorBoundary globale** (`src/components/ErrorBoundary.tsx`) con esportazione dell'archivio,
  ricarica e azzeramento: un'eccezione non produce più una pagina bianca senza via d'uscita.
- **Validazione dell'archivio** (`src/lib/validaArchivio.ts`), applicata sia all'importazione sia
  al caricamento da `localStorage`: ripara ciò che può, scarta i record irrecuperabili, segnala
  ogni correzione. L'import mostra un riepilogo e scarica automaticamente una copia di sicurezza
  prima di sostituire i dati; i backup ora contengono firma e versione dello schema.
- **Errori di salvataggio segnalati** con una striscia di avviso (`AvvisiArchivio`) invece del
  `catch` silenzioso.
- **Foto ridimensionate e ricompresse** a 1600px / JPEG 75% prima del salvataggio
  (`src/lib/immagini.ts`), con indicatore di peso, gestione degli errori di lettura e limiti.
- **Firma su carta bianca con inchiostro scuro**: il PNG esportato è ora leggibile in stampa;
  un tocco senza tratto non salva più una firma vuota.

### Fase 1 — Bug critici sui flussi
- Il **collegamento con l'anagrafica cliente** non si rompe più correggendo il nome: le modifiche
  aggiornano il cliente e lo scollegamento è un'azione esplicita. In accettazione un cliente con
  stesso nome e telefono viene riusato invece di duplicato.
- **Magazzino collegato alle riparazioni**: aggiungere un ricambio scarica la giacenza,
  rimuoverlo la ripristina, con avviso quando la disponibilità non basta.
- **Ordini idempotenti**: il carico avviene una volta sola ed è stornabile.
- **Date locali** in tutte le metriche (`isoLocale`), finestre «ultimi N giorni» esatte, e
  aggregazioni di ricavi allineate all'incassato.
- **Stati derivati** per fatture e preventivi scaduti; storno e annullamento incasso.
- **CSV** con virgola decimale e neutralizzazione delle formule; export anche per ordini e impianti.
- Validazioni su valori negativi, date obbligatorie, email; conferme e messaggi d'errore mancanti;
  contatori dei filtri coerenti; ordinamenti per nome cliente e per flusso di lavorazione.
- Password di sblocco mascherata; link WhatsApp corretti per numeri già prefissati.

### Fase 2 — Ciclo documentale
- Store esteso con creazione ed eliminazione di **preventivi e fatture**, più la numerazione
  progressiva configurabile in Impostazioni (`{n}`, `{anno}`, `{aa}`).
- **Modulo unico** di creazione e modifica documenti con righe editabili e collegamento a magazzino.
- **Conversioni**: riparazione → preventivo, riparazione → fattura (con l'acconto come riga di
  detrazione), preventivo → fattura. Accettando un preventivo la riparazione collegata passa in
  lavorazione; rifiutandolo torna pronta per la restituzione.
- Rotte dirette `/preventivi/:id` e `/fatture/:id`; preventivi visibili nella scheda cliente.

### Fase 3 — Ordini e impianti
- **CRUD completo degli ordini** con **consegne parziali** riga per riga, storno dei carichi,
  aggiornamento del prezzo d'acquisto alla ricezione e suggerimento dei fornitori già usati.
- **CRUD completo degli impianti**; la data della prossima manutenzione genera e mantiene
  allineato un promemoria tra le scadenze.
- **Modifica delle scadenze** e conferma prima dell'eliminazione.

### Fase 4 — UX, accessibilità e rifiniture
- Righe di tabella attivabili da tastiera; **vista a schede sotto i 640px**; modali con
  gestione dei livelli (ESC chiude solo quella in cima), trappola del focus e ripristino del
  focus precedente.
- **Ricerca globale su tutto l'archivio** (riparazioni, clienti, fatture, preventivi, magazzino,
  ordini, impianti), tollerante ad accenti e formati di telefono, raggiungibile anche da telefono.
- Filtri dell'elenco riparazioni **persistiti nell'URL** con contatore dei filtri attivi.
- **Foto del dispositivo incluse nella scheda stampata**; stampa attesa fino al caricamento del
  documento; titolo del documento con escape; barra di stampa solo nel file scaricato.
- Contrasto del testo secondario portato sopra la soglia AA; deploy con percorsi relativi e
  chunk separati (nessun avviso di bundle oltre 500 kB); README aggiornato.

### Verificato manualmente nel browser
Creazione fattura da riparazione con acconto in detrazione, ricezione parziale di un ordine,
firma leggibile, stati scaduti calcolati, nuovo preventivo con numerazione corretta, nessun
errore in console. La vista a schede su telefono è stata verificata sul CSS compilato
(media query e cascata corrette) ma non visivamente su un dispositivo stretto.

## 8. Fase 5 (26/07/2026)

- **Suite di test**: Vitest con fuso orario fissato, 109 test su calcoli IVA,
  finestre temporali, validazione dell'archivio, numerazione, stati derivati,
  ricerca globale e logica di sincronizzazione.
- **Registro dei movimenti di magazzino** con causale, riferimento e giacenza
  risultante; **cronologia dei passaggi di stato** delle riparazioni.
- **Backend Cloudflare Workers + D1** (`server/`): accesso con password
  condivisa, token di sessione firmati, sincronizzazione per record con
  risoluzione dei conflitti a favore del server e lapidi per le eliminazioni.
  Verificato in locale: accesso, conflitto fra due postazioni, propagazione
  delle eliminazioni e restrizione CORS.
- **Vista a schede su schermo stretto** verificata a 390px su riparazioni,
  clienti e fatture.

## 9. Backend in esercizio e allegati su R2 (26/07/2026)

- **Worker pubblicato** su `ioriparo-api.dimichele-lu.workers.dev`, con database
  D1 `ioriparo-db` e bucket R2 `ioriparo-allegati`. I segreti sono impostati e
  documentati fuori dal repository.
- **Allegati spostati da D1 a R2.** Conservare immagini in un database era la
  scelta sbagliata: 0,75 $ per GB al mese contro 0,015 $, base64 che gonfia i
  byte di un terzo, 2 MB per riga e un tetto di 10 GB che, una volta raggiunto,
  bloccherebbe l'intero archivio e non solo la galleria.
- **Difetti trovati provando contro il server reale**, non a tavolino:
  il primo allineamento falliva sempre (D1 accetta 100 parametri per query e
  l'invio iniziale ne portava molti di più); le modifiche fatte durante una
  sincronizzazione andavano perse; le immagini si ricaricavano a ogni giro; una
  postazione che non aveva ancora scaricato le foto le cancellava dal server;
  modificare una scheda azzerava i riferimenti alle immagini.
- **Interfaccia verificata a 390 pixel** su tutte le pagine, i moduli e
  l'anteprima di stampa: aggiunte le etichette mancanti nelle schede di
  magazzino, ordini, interventi e scheda cliente; sistemati l'ingombro delle
  scadenze e le briciole che finivano sotto le icone.

## 10. Archivio vuoto alla prima apertura (26/07/2026)

Il negozio apriva il gestionale e trovava 24 clienti e tre mesi di fatture che
non erano suoi. Peggio: alla prima sincronizzazione quella finzione finiva sul
server e si propagava alle altre postazioni.

- `creaDatabaseIniziale()` restituisce ora un archivio **vuoto**, con i soli dati
  aziendali. Il dataset dimostrativo vive in `creaDatabaseDimostrativo()` e si
  carica solo da *Impostazioni → Archivio locale*, con conferma esplicita.
- Accanto è comparso **Svuota l'archivio**, per ripulire una postazione: la
  conferma avverte che, se c'è un server collegato, la cancellazione raggiunge
  anche le altre postazioni.
- Gli **stati vuoti distinguono** ora «non hai ancora nulla» da «i filtri non
  trovano niente»: alla prima apertura ogni elenco spiega da dove si comincia
  invece di suggerire di modificare una ricerca mai fatta.
- Verificato: caricamento dei dati di esempio, svuotamento e ritorno agli stati
  vuoti, a 390 pixel oltre che da scrivania.

### Perché i dati di prova erano tornati sul server

Svuotare non sarebbe bastato. La base di confronto della sincronizzazione era
un riferimento in memoria: si azzerava a ogni ricaricamento della pagina, e la
prima passata successiva rispediva al server **l'archivio intero**. Bastava
quindi che una postazione con i dati dimostrativi aprisse l'applicazione perché
tutto tornasse su, cancellazioni comprese.

- Il confronto ora è sull'**impronta del contenuto** di ogni record
  (`firmeArchivio` / `modificheDaFirme`), e la mappa delle impronte vive in
  `localStorage` accanto al cursore: sopravvive alla chiusura della scheda.
- Una postazione che si collega a un server con **sole lapidi** non ne adotta
  più l'archivio vuoto: le cancellazioni le arrivano per la via normale, senza
  buttare via ciò che ha in casa.
- L'archivio sul server è stato ripulito trasformando i 350 record dimostrativi
  in lapidi datate: così la cancellazione raggiunge anche le postazioni che
  avevano ancora la vecchia copia, invece di lasciarle libere di rimandarla.

### Non ancora affrontato
- Anagrafica fornitori strutturata (si è scelto l'elenco suggerito con normalizzazione).
- FatturaPA / XML per lo SDI.
- Test di integrazione sull'interfaccia (la suite copre la logica, non i componenti).
- Pulizia automatica degli allegati orfani: oggi l'endpoint di manutenzione va
  chiamato a mano.

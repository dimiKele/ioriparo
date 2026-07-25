# IO RIPARO — Gestionale Assistenza e Riparazioni

Gestionale per un centro di assistenza e riparazione di dispositivi mobili e computer:
accettazione dispositivi, avanzamento delle riparazioni, anagrafica clienti, preventivi,
fatture, magazzino ricambi, ordini fornitori, scadenze e statistiche.

Applicazione **Vite + React + TypeScript + Tailwind CSS**, interfaccia in italiano con tema scuro.

## Avvio rapido

```bash
npm install
npm run dev        # http://localhost:5173
```

Altri comandi:

```bash
npm run build      # controllo dei tipi + build di produzione in dist/
npm run preview    # anteprima della build
npm run lint       # oxlint
npm test           # suite Vitest
```

## Stack

| Ambito | Scelta |
| --- | --- |
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Stili | Tailwind CSS v4 (plugin `@tailwindcss/vite`, tema in `src/index.css`) |
| Routing | React Router 7 |
| Grafici | Recharts |
| Icone | lucide-react |
| Dati | archivio locale in `localStorage`, nessun backend |

## Pagine

| Percorso | Contenuto |
| --- | --- |
| `/` | Dashboard: riepiloghi, riparazioni per stato, ultime riparazioni, scadenze, andamento incassi, prodotti più venduti, scorciatoie |
| `/riparazioni` | Elenco dispositivi con filtri per stato, tipo, periodo e tecnico, ricerca, ordinamento, paginazione ed esportazione CSV |
| `/riparazioni/nuova` | Modulo di accettazione: dati cliente, dati dispositivo, difetto, condizioni, accessori, foto, firma del cliente |
| `/riparazioni/:id` | Scheda riparazione: stato, interventi e ricambi, totali con IVA, cliente, foto, firma, stampa |
| `/riparazioni/:id/modifica` | Modifica dell'accettazione |
| `/clienti`, `/clienti/:id` | Anagrafica privati e aziende, scheda cliente con storico riparazioni e fatture |
| `/preventivi`, `/preventivi/:id` | Preventivi: creazione, modifica, cambio stato, conversione in fattura |
| `/fatture`, `/fatture/:id` | Fatture: creazione, modifica, incasso, storno |
| `/magazzino` | Ricambi e accessori, carico/scarico rapido, avvisi di sotto scorta, margini |
| `/ordini` | Ordini a fornitore con consegne parziali; la merce ricevuta entra in giacenza |
| `/scadenze` | Pagamenti, contratti e promemoria con priorità |
| `/impianti` | Impianti presso i clienti; la manutenzione programmata genera un promemoria |
| `/statistiche` | Incassi, riparazioni per mese, ricavi per categoria, tipologie di dispositivo |
| `/impostazioni` | Dati aziendali, IVA e numerazione predefinite |
| `/backup` | Backup JSON completo (esporta/importa) ed esportazioni CSV |

## Struttura del progetto

```
src/
  types/          modelli di dominio (Cliente, Riparazione, Fattura, …)
  data/
    seed.ts       dati dimostrativi generati rispetto alla data odierna
    store.tsx     Context con le operazioni CRUD e persistenza su localStorage
    metriche.ts   aggregazioni per dashboard e statistiche
  lib/            formattazione italiana, calcoli IVA, configurazione degli stati,
                  esportazioni CSV/JSON, hook di ordinamento e paginazione
  components/
    layout/       AppLayout, Sidebar, Topbar, contesto dell'intestazione di pagina
    ui/           Card, Badge, Button, campi di form, tabella, modale, firma…
    charts/       ciambella degli stati e andamento incassi
  pages/          una cartella per area funzionale
```

## Dati

L'app non ha backend: all'avvio carica un archivio dimostrativo (24 riparazioni, 24 clienti,
18 articoli di magazzino e circa tre mesi di fatture) e salva ogni modifica in `localStorage`
sotto la chiave `ioriparo:db:v1`.

L'archivio viene **validato** sia al caricamento sia all'importazione di un backup
(`src/lib/validaArchivio.ts`): i record irrecuperabili vengono scartati e le correzioni
applicate sono mostrate in cima alla pagina. Se il salvataggio fallisce — tipicamente per
spazio esaurito — l'applicazione lo segnala invece di far lavorare l'utente su dati volatili.
Le foto acquisite in accettazione sono ridimensionate e ricompresse prima di essere salvate
(`src/lib/immagini.ts`).

Le date del dataset sono calcolate rispetto al giorno corrente, così dashboard, incassi del mese
e scadenze restano sempre significativi. Da *Impostazioni* si possono ripristinare i dati
dimostrativi, da *Backup* esportare e reimportare l'archivio.

## Server del negozio (opzionale)

Senza server il gestionale funziona su un solo dispositivo. Il backend in
`server/` — Cloudflare Workers + D1 — permette a più postazioni di condividere
lo stesso archivio continuando a lavorare quando la rete manca.

```bash
cd server
npm install
npx wrangler d1 migrations apply ioriparo-db --remote   # crea le tabelle
npx wrangler secret put PASSWORD_NEGOZIO                # password condivisa
npx wrangler secret put CHIAVE_FIRMA                    # chiave dei token di sessione
npx wrangler deploy
```

Poi in *Impostazioni → Server del negozio* si indica l'indirizzo del Worker e
si inserisce la password. Va aggiunta l'origine da cui è servito il gestionale
alla variabile `ORIGINI_AMMESSE` in `server/wrangler.jsonc`.

Come funziona la sincronizzazione:

- L'archivio locale resta quello su cui l'applicazione lavora: una caduta di
  rete non impedisce di accettare un dispositivo o consultare una scheda.
- Si sincronizza **un record per volta**, quindi due postazioni che modificano
  schede diverse non si sovrascrivono.
- In caso di conflitto **vince la versione del server**: la modifica arrivata
  per ultima non può cancellare in silenzio quella di un collega, e la
  postazione adotta la versione remota segnalandolo.
- Le eliminazioni lasciano una lapide, altrimenti un record cancellato
  tornerebbe indietro dalla postazione che era offline.
- **Foto e firme non vengono ancora trasferite** e restano sul dispositivo che
  le ha acquisite: un record D1 non può superare 1 MB. La tabella `allegato`
  è già predisposta per il passo successivo.

## Compilazione e pubblicazione

```bash
npm run build                        # asset con percorsi relativi, pubblicabili in sottocartella
VITE_ROUTER=hash npm run build       # navigazione via fragment (#/clienti) per hosting statici
VITE_BASE=/nome-repo/ npm run build  # percorso assoluto, se serve
```

Senza riscrittura degli URL lato server (GitHub Pages, anteprime statiche) va usato
`VITE_ROUTER=hash`, altrimenti un ricaricamento su `/riparazioni/xyz` restituisce 404.

## Convenzioni

- Interfaccia, nomi di dominio e commenti in italiano.
- I prezzi di riparazioni, preventivi e fatture sono **IVA inclusa**: l'imposta viene scorporata
  in fase di visualizzazione (`src/lib/calcoli.ts`).
- Gli stati delle riparazioni e i relativi colori sono definiti una sola volta in
  `src/lib/stati.ts` e riusati da badge, filtri, grafici e stampe.
- Gli stili base dei campi stanno nel layer `components` (`.ui-field` in `index.css`) così le
  utility Tailwind passate via `className` mantengono la precedenza.
- Gli stati «scaduta» di fatture e preventivi sono **derivati dalle date**
  (`statoFatturaEffettivo`, `statoPreventivoEffettivo` in `src/lib/stati.ts`), non memorizzati.
- La numerazione dei documenti segue modelli configurabili in *Impostazioni*: `{n}` è il
  progressivo, `{anno}` l'anno per esteso, `{aa}` le ultime due cifre.
- La stampa non usa la pagina dell'applicazione: i documenti sono composti in un foglio A4
  autonomo e mostrati in un iframe (`src/components/stampa/`).

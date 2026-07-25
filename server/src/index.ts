/**
 * API del gestionale IO RIPARO.
 *
 * Il server è l'archivio di riferimento del negozio; le postazioni ne tengono
 * una copia locale per continuare a lavorare quando la rete manca e si
 * riallineano appena torna. La sincronizzazione è per record: due postazioni
 * che modificano schede diverse non si sovrascrivono a vicenda.
 */

interface Env {
  DB: D1Database
  ORIGINI_AMMESSE: string
  /** Password condivisa del negozio, impostata con `wrangler secret put`. */
  PASSWORD_NEGOZIO?: string
  /** Chiave con cui vengono firmati i token di sessione. */
  CHIAVE_FIRMA?: string
}

/** Durata della sessione: una giornata di lavoro senza dover riaccedere. */
const DURATA_SESSIONE_MS = 12 * 60 * 60 * 1000

/** Collezioni sincronizzate. L'anagrafica aziendale è un record singolo. */
const COLLEZIONI = [
  'clienti',
  'riparazioni',
  'preventivi',
  'fatture',
  'magazzino',
  'ordini',
  'scadenze',
  'impianti',
  'movimenti',
  'azienda',
] as const

type Collezione = (typeof COLLEZIONI)[number]

interface RecordSincronizzato {
  collezione: Collezione
  id: string
  dati: unknown
  eliminato?: boolean
  aggiornatoIl?: number
}

interface AllegatoSincronizzato {
  id: string
  riparazioneId: string
  tipo: 'foto' | 'firma'
  ordine?: number
  /** Presente solo in scrittura: in lettura si scarica a parte. */
  dati?: string
  eliminato?: boolean
  aggiornatoIl?: number
}

// ------------------------------------------------------------------ utilità

const codificatore = new TextEncoder()

function base64url(dati: ArrayBuffer | Uint8Array): string {
  const bytes = dati instanceof Uint8Array ? dati : new Uint8Array(dati)
  let testo = ''
  for (const byte of bytes) testo += String.fromCharCode(byte)
  return btoa(testo).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Confronto a tempo costante: un confronto normale termina al primo carattere
 * diverso e permette di indovinare la password una lettera per volta.
 */
function confrontoSicuro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let differenza = 0
  for (let i = 0; i < a.length; i++) differenza |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return differenza === 0
}

async function chiaveHmac(segreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    codificatore.encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function creaToken(segreto: string, scadenza: number): Promise<string> {
  const carico = base64url(codificatore.encode(JSON.stringify({ scadenza })))
  const firma = await crypto.subtle.sign('HMAC', await chiaveHmac(segreto), codificatore.encode(carico))
  return `${carico}.${base64url(firma)}`
}

async function tokenValido(segreto: string, token: string): Promise<boolean> {
  const [carico, firma] = token.split('.')
  if (!carico || !firma) return false

  const atteso = base64url(
    await crypto.subtle.sign('HMAC', await chiaveHmac(segreto), codificatore.encode(carico)),
  )
  if (!confrontoSicuro(firma, atteso)) return false

  try {
    const { scadenza } = JSON.parse(atob(carico.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof scadenza === 'number' && scadenza > Date.now()
  } catch {
    return false
  }
}

function intestazioniCors(richiesta: Request, env: Env): Record<string, string> {
  const origine = richiesta.headers.get('Origin') ?? ''
  const ammesse = (env.ORIGINI_AMMESSE ?? '')
    .split(',')
    .map((voce) => voce.trim())
    .filter(Boolean)

  // Si riflette solo un'origine esplicitamente autorizzata: `*` insieme alle
  // credenziali vanificherebbe il controllo.
  if (!ammesse.includes(origine)) return {}
  return {
    'Access-Control-Allow-Origin': origine,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function risposta(corpo: unknown, stato: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  })
}

function eCollezione(valore: unknown): valore is Collezione {
  return typeof valore === 'string' && (COLLEZIONI as readonly string[]).includes(valore)
}

// ------------------------------------------------------------------- rotte

async function accesso(richiesta: Request, env: Env, cors: Record<string, string>) {
  if (!env.PASSWORD_NEGOZIO || !env.CHIAVE_FIRMA) {
    return risposta(
      { errore: 'Il server non è ancora configurato: mancano i segreti di accesso.' },
      503,
      cors,
    )
  }

  const corpo = (await richiesta.json().catch(() => null)) as { password?: unknown } | null
  const password = typeof corpo?.password === 'string' ? corpo.password : ''

  if (!confrontoSicuro(password, env.PASSWORD_NEGOZIO)) {
    // Ritardo fisso: rende più lento provare password a raffica senza
    // penalizzare chi sbaglia una volta.
    await new Promise((risolvi) => setTimeout(risolvi, 400))
    return risposta({ errore: 'Password non corretta.' }, 401, cors)
  }

  const scadenza = Date.now() + DURATA_SESSIONE_MS
  return risposta({ token: await creaToken(env.CHIAVE_FIRMA, scadenza), scadenza }, 200, cors)
}

/** Restituisce ciò che è cambiato dopo `da`, allegati esclusi dal contenuto. */
async function leggiCambiamenti(env: Env, da: number) {
  const [record, allegati] = await env.DB.batch([
    env.DB.prepare(
      'SELECT collezione, id, dati, aggiornato_il, eliminato FROM record WHERE aggiornato_il > ? ORDER BY aggiornato_il',
    ).bind(da),
    env.DB.prepare(
      'SELECT id, riparazione_id, tipo, ordine, aggiornato_il, eliminato FROM allegato WHERE aggiornato_il > ? ORDER BY aggiornato_il',
    ).bind(da),
  ])

  return {
    record: (record.results as Array<Record<string, unknown>>).map((riga) => ({
      collezione: riga.collezione as Collezione,
      id: riga.id as string,
      dati: JSON.parse(riga.dati as string),
      aggiornatoIl: riga.aggiornato_il as number,
      eliminato: riga.eliminato === 1,
    })),
    allegati: (allegati.results as Array<Record<string, unknown>>).map((riga) => ({
      id: riga.id as string,
      riparazioneId: riga.riparazione_id as string,
      tipo: riga.tipo as 'foto' | 'firma',
      ordine: riga.ordine as number,
      aggiornatoIl: riga.aggiornato_il as number,
      eliminato: riga.eliminato === 1,
    })),
  }
}

/**
 * Applica le modifiche di una postazione e restituisce tutto ciò che è
 * cambiato sul server dopo il suo ultimo allineamento.
 *
 * In caso di conflitto vince la versione del server: la modifica arrivata per
 * ultima non deve poter cancellare quella di un collega senza che nessuno se
 * ne accorga, quindi il record contestato torna indietro e la postazione lo
 * adotta mostrandolo aggiornato.
 */
async function sincronizza(richiesta: Request, env: Env, cors: Record<string, string>) {
  const corpo = (await richiesta.json().catch(() => null)) as {
    da?: unknown
    origine?: unknown
    record?: unknown
    allegati?: unknown
  } | null

  const da = typeof corpo?.da === 'number' && Number.isFinite(corpo.da) ? corpo.da : 0
  const origine = typeof corpo?.origine === 'string' ? corpo.origine.slice(0, 60) : null
  const inArrivo = Array.isArray(corpo?.record) ? (corpo.record as RecordSincronizzato[]) : []
  const allegatiInArrivo = Array.isArray(corpo?.allegati)
    ? (corpo.allegati as AllegatoSincronizzato[])
    : []

  const adesso = Date.now()
  const rifiutati: Array<{ collezione: string; id: string }> = []
  const istruzioni: D1PreparedStatement[] = []

  if (inArrivo.length > 0) {
    // Si leggono in blocco le versioni attuali dei soli record toccati.
    const chiavi = inArrivo.filter((r) => eCollezione(r.collezione) && typeof r.id === 'string')
    const attuali = new Map<string, number>()

    if (chiavi.length > 0) {
      const segnaposti = chiavi.map(() => '(? , ?)').join(',')
      const parametri = chiavi.flatMap((r) => [r.collezione, r.id])
      const esito = await env.DB.prepare(
        `SELECT collezione, id, aggiornato_il FROM record WHERE (collezione, id) IN (VALUES ${segnaposti})`,
      )
        .bind(...parametri)
        .all()
      for (const riga of esito.results as Array<Record<string, unknown>>) {
        attuali.set(`${riga.collezione} ${riga.id}`, riga.aggiornato_il as number)
      }
    }

    for (const voce of chiavi) {
      const attuale = attuali.get(`${voce.collezione} ${voce.id}`)
      // Il record è stato toccato da qualcun altro dopo l'ultimo allineamento
      // di questa postazione: la sua modifica non viene applicata.
      if (attuale !== undefined && attuale > da) {
        rifiutati.push({ collezione: voce.collezione, id: voce.id })
        continue
      }
      istruzioni.push(
        env.DB.prepare(
          `INSERT INTO record (collezione, id, dati, aggiornato_il, eliminato, origine)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (collezione, id) DO UPDATE SET
             dati = excluded.dati,
             aggiornato_il = excluded.aggiornato_il,
             eliminato = excluded.eliminato,
             origine = excluded.origine`,
        ).bind(
          voce.collezione,
          voce.id,
          JSON.stringify(voce.dati ?? null),
          adesso,
          voce.eliminato ? 1 : 0,
          origine,
        ),
      )
    }
  }

  for (const allegato of allegatiInArrivo) {
    if (typeof allegato.id !== 'string' || typeof allegato.riparazioneId !== 'string') continue
    if (allegato.tipo !== 'foto' && allegato.tipo !== 'firma') continue
    istruzioni.push(
      env.DB.prepare(
        `INSERT INTO allegato (id, riparazione_id, tipo, ordine, dati, aggiornato_il, eliminato)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           ordine = excluded.ordine,
           dati = excluded.dati,
           aggiornato_il = excluded.aggiornato_il,
           eliminato = excluded.eliminato`,
      ).bind(
        allegato.id,
        allegato.riparazioneId,
        allegato.tipo,
        allegato.ordine ?? 0,
        allegato.eliminato ? '' : (allegato.dati ?? ''),
        adesso,
        allegato.eliminato ? 1 : 0,
      ),
    )
  }

  // D1 accetta al massimo 1000 istruzioni per lotto sul piano gratuito.
  const DIMENSIONE_LOTTO = 500
  for (let i = 0; i < istruzioni.length; i += DIMENSIONE_LOTTO) {
    await env.DB.batch(istruzioni.slice(i, i + DIMENSIONE_LOTTO))
  }

  const cambiamenti = await leggiCambiamenti(env, da)
  return risposta({ istante: adesso, rifiutati, ...cambiamenti }, 200, cors)
}

async function scaricaAllegato(env: Env, id: string, cors: Record<string, string>) {
  const riga = await env.DB.prepare('SELECT dati, eliminato FROM allegato WHERE id = ?')
    .bind(id)
    .first<{ dati: string; eliminato: number }>()

  if (!riga || riga.eliminato === 1) return risposta({ errore: 'Allegato non trovato.' }, 404, cors)
  return risposta({ id, dati: riga.dati }, 200, cors)
}

// ------------------------------------------------------------------- fetch

export default {
  async fetch(richiesta: Request, env: Env): Promise<Response> {
    const cors = intestazioniCors(richiesta, env)
    const url = new URL(richiesta.url)

    if (richiesta.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    // Serve a capire da subito se l'indirizzo inserito nelle impostazioni è
    // quello giusto, senza dover prima indovinare la password.
    if (url.pathname === '/api/stato') {
      return risposta(
        { applicazione: 'ioriparo', configurato: Boolean(env.PASSWORD_NEGOZIO && env.CHIAVE_FIRMA) },
        200,
        cors,
      )
    }

    if (url.pathname === '/api/accesso' && richiesta.method === 'POST') {
      return accesso(richiesta, env, cors)
    }

    if (!env.CHIAVE_FIRMA) {
      return risposta({ errore: 'Server non configurato.' }, 503, cors)
    }

    const autorizzazione = richiesta.headers.get('Authorization') ?? ''
    const token = autorizzazione.startsWith('Bearer ') ? autorizzazione.slice(7) : ''
    if (!(await tokenValido(env.CHIAVE_FIRMA, token))) {
      return risposta({ errore: 'Sessione scaduta o assente.' }, 401, cors)
    }

    if (url.pathname === '/api/sincronizza' && richiesta.method === 'POST') {
      return sincronizza(richiesta, env, cors)
    }

    if (url.pathname === '/api/sincronizza' && richiesta.method === 'GET') {
      const da = Number(url.searchParams.get('da') ?? '0')
      const cambiamenti = await leggiCambiamenti(env, Number.isFinite(da) ? da : 0)
      return risposta({ istante: Date.now(), rifiutati: [], ...cambiamenti }, 200, cors)
    }

    const allegato = url.pathname.match(/^\/api\/allegati\/([\w-]+)$/)
    if (allegato && richiesta.method === 'GET') {
      return scaricaAllegato(env, allegato[1], cors)
    }

    return risposta({ errore: 'Risorsa non trovata.' }, 404, cors)
  },
} satisfies ExportedHandler<Env>

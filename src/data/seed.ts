import {
  FORMATO_FATTURA_PREDEFINITO,
  FORMATO_PREVENTIVO_PREDEFINITO,
} from '@/lib/documenti'
import type {
  ArticoloMagazzino,
  Azienda,
  Cliente,
  DatabaseGestionale,
  Fattura,
  Impianto,
  OrdineFornitore,
  Preventivo,
  Riparazione,
  Scadenza,
  StatoRiparazione,
} from '@/types'

/**
 * Dati dimostrativi del gestionale.
 *
 * Le date sono generate rispetto al giorno corrente (e non fissate al 2024)
 * così che dashboard, incassi del mese e scadenze restino sempre significativi.
 * La generazione è deterministica: stesso giorno → stesso dataset.
 */

const MS_GIORNO = 86_400_000

function iso(data: Date): string {
  const offset = data.getTimezoneOffset() * 60_000
  return new Date(data.getTime() - offset).toISOString().slice(0, 10)
}

const OGGI = new Date()

/** Data di `n` giorni fa in formato ISO. */
function giorniFa(n: number): string {
  return iso(new Date(OGGI.getTime() - n * MS_GIORNO))
}

/** Data fra `n` giorni in formato ISO. */
function traGiorni(n: number): string {
  return iso(new Date(OGGI.getTime() + n * MS_GIORNO))
}

/** PRNG deterministico: la demo non deve cambiare a ogni render. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const anno = OGGI.getFullYear().toString().slice(2)

// ---------------------------------------------------------------- Clienti

export const CLIENTI: Cliente[] = [
  {
    id: 'cli-001',
    nome: 'Marco Rossi',
    tipo: 'privato',
    telefono: '333 1234567',
    email: 'marco.rossi@email.com',
    indirizzo: 'Via Roma 45',
    citta: 'Altamura',
    cap: '70022',
    codiceFiscale: 'RSSMRC85M12A662K',
    creatoIl: giorniFa(420),
  },
  {
    id: 'cli-002',
    nome: 'Anna Bianchi',
    tipo: 'privato',
    telefono: '349 9876543',
    email: 'anna.bianchi@email.com',
    indirizzo: 'Corso Federico II 12',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(365),
  },
  {
    id: 'cli-003',
    nome: 'Luca Verdi',
    tipo: 'privato',
    telefono: '388 7654321',
    email: 'luca.verdi@email.com',
    indirizzo: 'Via Bari 88',
    citta: 'Gravina in Puglia',
    cap: '70024',
    creatoIl: giorniFa(310),
  },
  {
    id: 'cli-004',
    nome: 'Giuseppe Nardelli',
    tipo: 'privato',
    telefono: '320 1122334',
    email: 'g.nardelli@email.com',
    indirizzo: 'Via Matera 3',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(280),
  },
  {
    id: 'cli-005',
    nome: 'Sara Conti',
    tipo: 'privato',
    telefono: '347 5566778',
    email: 'sara.conti@email.com',
    indirizzo: 'Piazza Zanardelli 7',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(240),
  },
  {
    id: 'cli-006',
    nome: 'Alessandro Palumbo',
    tipo: 'privato',
    telefono: '334 9988776',
    email: 'ale.palumbo@email.com',
    indirizzo: 'Via Santeramo 210',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(220),
  },
  {
    id: 'cli-007',
    nome: 'Francesca Miglionico',
    tipo: 'privato',
    telefono: '339 1230987',
    email: 'f.miglionico@email.com',
    indirizzo: 'Via Gravina 15',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(190),
  },
  {
    id: 'cli-008',
    nome: 'Studio Tecnico Bianchi',
    tipo: 'azienda',
    telefono: '080 1234567',
    email: 'info@studiobianchi.it',
    indirizzo: 'Via Mura Megalitiche 22',
    citta: 'Altamura',
    cap: '70022',
    partitaIva: '07123450728',
    note: 'Contratto di manutenzione annuale attivo.',
    creatoIl: giorniFa(500),
  },
  {
    id: 'cli-009',
    nome: 'Farmacia Centrale',
    tipo: 'azienda',
    telefono: '080 3141592',
    email: 'amministrazione@farmaciacentrale.it',
    indirizzo: 'Corso Umberto I 5',
    citta: 'Altamura',
    cap: '70022',
    partitaIva: '06998770726',
    creatoIl: giorniFa(450),
  },
  {
    id: 'cli-010',
    nome: 'Panificio Dell’Aquila',
    tipo: 'azienda',
    telefono: '080 3149876',
    email: 'ordini@panificiodellaquila.it',
    indirizzo: 'Via Bari 140',
    citta: 'Altamura',
    cap: '70022',
    partitaIva: '07445120721',
    creatoIl: giorniFa(400),
  },
  {
    id: 'cli-011',
    nome: 'Roberto Lorusso',
    tipo: 'privato',
    telefono: '345 6677889',
    email: 'r.lorusso@email.com',
    citta: 'Santeramo in Colle',
    cap: '70029',
    creatoIl: giorniFa(160),
  },
  {
    id: 'cli-012',
    nome: 'Chiara Dibenedetto',
    tipo: 'privato',
    telefono: '328 4455667',
    email: 'chiara.db@email.com',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(140),
  },
  {
    id: 'cli-013',
    nome: 'Vito Loiudice',
    tipo: 'privato',
    telefono: '392 3344556',
    citta: 'Gravina in Puglia',
    cap: '70024',
    creatoIl: giorniFa(120),
  },
  {
    id: 'cli-014',
    nome: 'Autoricambi Colonna',
    tipo: 'azienda',
    telefono: '080 3167788',
    email: 'info@autoricambicolonna.it',
    indirizzo: 'Z.I. Via Corato 9',
    citta: 'Altamura',
    cap: '70022',
    partitaIva: '07882340723',
    creatoIl: giorniFa(330),
  },
  {
    id: 'cli-015',
    nome: 'Maria Tortoli',
    tipo: 'privato',
    telefono: '340 7788990',
    email: 'maria.tortoli@email.com',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(95),
  },
  {
    id: 'cli-016',
    nome: 'Nicola Genco',
    tipo: 'privato',
    telefono: '331 2233445',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(80),
  },
  {
    id: 'cli-017',
    nome: 'Istituto Comprensivo Padre Pio',
    tipo: 'azienda',
    telefono: '080 3110022',
    email: 'segreteria@icpadrepio.edu.it',
    indirizzo: 'Via Carpentino 40',
    citta: 'Altamura',
    cap: '70022',
    partitaIva: '82014390726',
    note: 'Fatturazione elettronica alla PA, split payment.',
    creatoIl: giorniFa(300),
  },
  {
    id: 'cli-018',
    nome: 'Domenico Cornacchia',
    tipo: 'privato',
    telefono: '346 5544332',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(60),
  },
  {
    id: 'cli-019',
    nome: 'Elena Caputo',
    tipo: 'privato',
    telefono: '327 9988001',
    email: 'elena.caputo@email.com',
    citta: 'Matera',
    cap: '75100',
    creatoIl: giorniFa(45),
  },
  {
    id: 'cli-020',
    nome: 'Bar Centrale Snc',
    tipo: 'azienda',
    telefono: '080 3145566',
    email: 'barcentrale@pec.it',
    indirizzo: 'Piazza Duomo 1',
    citta: 'Altamura',
    cap: '70022',
    partitaIva: '07331120725',
    creatoIl: giorniFa(210),
  },
  {
    id: 'cli-021',
    nome: 'Giovanni Ferrulli',
    tipo: 'privato',
    telefono: '335 1122998',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(30),
  },
  {
    id: 'cli-022',
    nome: 'Rosa Maiullari',
    tipo: 'privato',
    telefono: '349 3344221',
    email: 'rosa.m@email.com',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(18),
  },
  {
    id: 'cli-023',
    nome: 'Officina Meccanica Sarcuni',
    tipo: 'azienda',
    telefono: '080 3178899',
    email: 'officina.sarcuni@email.com',
    citta: 'Santeramo in Colle',
    cap: '70029',
    partitaIva: '07556780729',
    creatoIl: giorniFa(150),
  },
  {
    id: 'cli-024',
    nome: 'Pietro Loglisci',
    tipo: 'privato',
    telefono: '333 4455112',
    citta: 'Altamura',
    cap: '70022',
    creatoIl: giorniFa(9),
  },
]

// -------------------------------------------------------------- Magazzino

export const MAGAZZINO: ArticoloMagazzino[] = [
  { id: 'art-001', codice: 'DSP-IP13', nome: 'Display iPhone 13 (OLED originale)', categoria: 'Display', fornitore: 'Cellularline S.p.A.', quantita: 6, scorta_minima: 4, prezzoAcquisto: 118, prezzoVendita: 199, ubicazione: 'A1-03' },
  { id: 'art-002', codice: 'DSP-IP11', nome: 'Display iPhone 11 (incell)', categoria: 'Display', fornitore: 'Mobile Parts Italia', quantita: 9, scorta_minima: 4, prezzoAcquisto: 42, prezzoVendita: 89, ubicazione: 'A1-04' },
  { id: 'art-003', codice: 'BAT-IP', nome: 'Batteria iPhone (serie 11/12/13)', categoria: 'Batterie', fornitore: 'Mobile Parts Italia', quantita: 14, scorta_minima: 6, prezzoAcquisto: 18, prezzoVendita: 59, ubicazione: 'B2-01' },
  { id: 'art-004', codice: 'BAT-SAM', nome: 'Batteria Samsung Galaxy S/A', categoria: 'Batterie', fornitore: 'Mobile Parts Italia', quantita: 11, scorta_minima: 6, prezzoAcquisto: 16, prezzoVendita: 55, ubicazione: 'B2-02' },
  { id: 'art-005', codice: 'BAT-MBA', nome: 'Batteria MacBook Air M1', categoria: 'Batterie', fornitore: 'Apple Parts Distribution', quantita: 2, scorta_minima: 3, prezzoAcquisto: 96, prezzoVendita: 189, ubicazione: 'B2-06' },
  { id: 'art-006', codice: 'VTR-TMP', nome: 'Vetro temperato universale', categoria: 'Accessori', fornitore: 'Cellularline S.p.A.', quantita: 48, scorta_minima: 20, prezzoAcquisto: 2.5, prezzoVendita: 15, ubicazione: 'C1-01' },
  { id: 'art-007', codice: 'CON-LGT', nome: 'Connettore di ricarica Lightning', categoria: 'Componenti', fornitore: 'Mobile Parts Italia', quantita: 12, scorta_minima: 5, prezzoAcquisto: 9, prezzoVendita: 45, ubicazione: 'B1-05' },
  { id: 'art-008', codice: 'CON-USBC', nome: 'Connettore di ricarica USB-C', categoria: 'Componenti', fornitore: 'Mobile Parts Italia', quantita: 15, scorta_minima: 5, prezzoAcquisto: 8, prezzoVendita: 45, ubicazione: 'B1-06' },
  { id: 'art-009', codice: 'VTR-IPAD', nome: 'Vetro touch iPad Air 4', categoria: 'Display', fornitore: 'Apple Parts Distribution', quantita: 3, scorta_minima: 2, prezzoAcquisto: 64, prezzoVendita: 139, ubicazione: 'A2-02' },
  { id: 'art-010', codice: 'SSD-1TB', nome: 'SSD NVMe 1 TB', categoria: 'Componenti PC', fornitore: 'Esprinet', quantita: 7, scorta_minima: 3, prezzoAcquisto: 58, prezzoVendita: 109, ubicazione: 'D1-01' },
  { id: 'art-011', codice: 'RAM-16', nome: 'RAM DDR4 16 GB', categoria: 'Componenti PC', fornitore: 'Esprinet', quantita: 5, scorta_minima: 4, prezzoAcquisto: 34, prezzoVendita: 69, ubicazione: 'D1-02' },
  { id: 'art-012', codice: 'PST-TRM', nome: 'Pasta termica (siringa 4 g)', categoria: 'Consumabili', fornitore: 'Esprinet', quantita: 22, scorta_minima: 8, prezzoAcquisto: 3, prezzoVendita: 12, ubicazione: 'C2-04' },
  { id: 'art-013', codice: 'ALM-65W', nome: 'Alimentatore universale 65W', categoria: 'Accessori', fornitore: 'Cellularline S.p.A.', quantita: 9, scorta_minima: 4, prezzoAcquisto: 17, prezzoVendita: 39, ubicazione: 'C1-08' },
  { id: 'art-014', codice: 'COV-UNI', nome: 'Cover protettiva (assortite)', categoria: 'Accessori', fornitore: 'Cellularline S.p.A.', quantita: 63, scorta_minima: 25, prezzoAcquisto: 3.2, prezzoVendita: 19, ubicazione: 'C1-02' },
  { id: 'art-015', codice: 'ALT-BUZ', nome: 'Altoparlante / buzzer smartphone', categoria: 'Componenti', fornitore: 'Mobile Parts Italia', quantita: 8, scorta_minima: 4, prezzoAcquisto: 6, prezzoVendita: 35, ubicazione: 'B1-08' },
  { id: 'art-016', codice: 'VNT-PS5', nome: 'Kit ventola PlayStation 5', categoria: 'Console', fornitore: 'Esprinet', quantita: 1, scorta_minima: 2, prezzoAcquisto: 29, prezzoVendita: 79, ubicazione: 'E1-01' },
  { id: 'art-017', codice: 'TST-LAP', nome: 'Tastiera notebook (assortite)', categoria: 'Componenti PC', fornitore: 'Esprinet', quantita: 4, scorta_minima: 3, prezzoAcquisto: 22, prezzoVendita: 65, ubicazione: 'D2-03' },
  { id: 'art-018', codice: 'SRV-LIC', nome: 'Licenza antivirus 1 anno', categoria: 'Software', fornitore: 'Achab', quantita: 10, scorta_minima: 5, prezzoAcquisto: 28, prezzoVendita: 59, ubicazione: '--' },
]

// ------------------------------------------------------------ Riparazioni

interface SemeRiparazione {
  cliente: string
  tipo: Riparazione['tipoDispositivo']
  marca: string
  modello: string
  colore?: string
  capacita?: string
  imei?: string
  difetto: string
  stato: StatoRiparazione
  /** Giorni fa in cui il dispositivo è stato accettato */
  accettato: number
  /** Giorni dall'accettazione previsti per la consegna */
  lavorazione?: number
  tecnico?: string
  interventi?: Array<{ descrizione: string; quantita: number; prezzo: number; articoloId?: string }>
  acconto?: number
}

const SEMI_RIPARAZIONI: SemeRiparazione[] = [
  { cliente: 'cli-001', tipo: 'smartphone', marca: 'Apple', modello: 'iPhone 13', colore: 'Nero', capacita: '128 GB', imei: '352099114587632', difetto: 'Display rotto', stato: 'in_attesa', accettato: 0, lavorazione: 3, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione display OLED', quantita: 1, prezzo: 199, articoloId: 'art-001' }] },
  { cliente: 'cli-002', tipo: 'notebook', marca: 'Apple', modello: 'MacBook Air M1', colore: 'Grigio siderale', capacita: '13" - 256 GB', imei: 'FVFGH21Q6L7L', difetto: 'Sostituzione batteria', stato: 'preventivo_inviato', accettato: 1, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione batteria MacBook Air M1', quantita: 1, prezzo: 189, articoloId: 'art-005' }] },
  { cliente: 'cli-003', tipo: 'smartphone', marca: 'Samsung', modello: 'Galaxy S22', colore: 'Verde', capacita: '256 GB', imei: '354845623156987', difetto: 'Problemi di ricarica', stato: 'in_lavorazione', accettato: 1, lavorazione: 2, tecnico: 'Michele', interventi: [{ descrizione: 'Sostituzione connettore di ricarica USB-C', quantita: 1, prezzo: 45, articoloId: 'art-008' }], acconto: 20 },
  { cliente: 'cli-004', tipo: 'desktop', marca: 'Assemblato', modello: 'PC Assemblato', capacita: 'Windows 10 Pro', imei: 'PC2023-0987', difetto: 'Pulizia e upgrade RAM', stato: 'in_lavorazione', accettato: 2, lavorazione: 3, tecnico: 'Michele', interventi: [{ descrizione: 'RAM DDR4 16 GB', quantita: 1, prezzo: 69, articoloId: 'art-011' }, { descrizione: 'Pulizia interna e pasta termica', quantita: 1, prezzo: 35, articoloId: 'art-012' }] },
  { cliente: 'cli-005', tipo: 'tablet', marca: 'Apple', modello: 'iPad Air 4', colore: 'Grigio siderale', capacita: '64 GB', imei: 'DMPFJ2KQ16M', difetto: 'Sostituzione vetro', stato: 'pronto_per_ritiro', accettato: 2, lavorazione: 1, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione vetro touch', quantita: 1, prezzo: 139, articoloId: 'art-009' }] },
  { cliente: 'cli-006', tipo: 'console', marca: 'Sony', modello: 'PlayStation 5', capacita: 'Standard - 825 GB', imei: 'PS5K11223344', difetto: 'Rumore ventola', stato: 'pronto_per_ritiro', accettato: 3, lavorazione: 1, tecnico: 'Michele', interventi: [{ descrizione: 'Kit ventola PlayStation 5', quantita: 1, prezzo: 79, articoloId: 'art-016' }] },
  { cliente: 'cli-007', tipo: 'smartphone', marca: 'Apple', modello: 'iPhone 11', colore: 'Bianco', capacita: '64 GB', imei: '356789112233445', difetto: 'Batteria scarica subito', stato: 'consegnato', accettato: 4, lavorazione: 4, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione batteria', quantita: 1, prezzo: 59, articoloId: 'art-003' }] },
  { cliente: 'cli-008', tipo: 'notebook', marca: 'HP', modello: 'Notebook 250 G8', capacita: 'Windows 11', imei: '5CD1234AB8', difetto: 'Formattazione PC', stato: 'consegnato', accettato: 5, lavorazione: 5, tecnico: 'Michele', interventi: [{ descrizione: 'Formattazione e reinstallazione sistema', quantita: 1, prezzo: 60 }, { descrizione: 'Licenza antivirus 1 anno', quantita: 1, prezzo: 59, articoloId: 'art-018' }] },
  { cliente: 'cli-009', tipo: 'desktop', marca: 'HP', modello: 'ProDesk 400 G7', capacita: 'Windows 11 Pro', imei: 'PDK400G7-221', difetto: 'Non si accende', stato: 'in_lavorazione', accettato: 3, lavorazione: 4, tecnico: 'Michele', interventi: [{ descrizione: 'Sostituzione alimentatore', quantita: 1, prezzo: 79 }] },
  { cliente: 'cli-010', tipo: 'smartphone', marca: 'Xiaomi', modello: 'Redmi Note 12', colore: 'Blu', capacita: '128 GB', imei: '869123045678901', difetto: 'Vetro fotocamera rotto', stato: 'in_attesa', accettato: 2, lavorazione: 3, tecnico: 'Antonio' },
  { cliente: 'cli-011', tipo: 'smartphone', marca: 'Apple', modello: 'iPhone 12', colore: 'Blu', capacita: '128 GB', imei: '353012345678912', difetto: 'Caduta in acqua, non si accende', stato: 'in_lavorazione', accettato: 4, lavorazione: 5, tecnico: 'Antonio', interventi: [{ descrizione: 'Trattamento ossido e diagnosi scheda madre', quantita: 1, prezzo: 89 }], acconto: 30 },
  { cliente: 'cli-012', tipo: 'notebook', marca: 'Lenovo', modello: 'IdeaPad 3', capacita: 'Windows 11', imei: 'LN-IP3-99881', difetto: 'Tastiera non funzionante', stato: 'preventivo_inviato', accettato: 3, tecnico: 'Michele', interventi: [{ descrizione: 'Sostituzione tastiera notebook', quantita: 1, prezzo: 65, articoloId: 'art-017' }] },
  { cliente: 'cli-013', tipo: 'smartphone', marca: 'Samsung', modello: 'Galaxy A54', colore: 'Nero', capacita: '128 GB', imei: '357812349900112', difetto: 'Display con righe verticali', stato: 'in_attesa', accettato: 3, lavorazione: 4, tecnico: 'Antonio' },
  { cliente: 'cli-014', tipo: 'notebook', marca: 'Dell', modello: 'Latitude 5420', capacita: 'Windows 11 Pro', imei: 'DL5420-77321', difetto: 'Surriscaldamento e spegnimenti', stato: 'in_lavorazione', accettato: 5, lavorazione: 3, tecnico: 'Michele', interventi: [{ descrizione: 'Pulizia dissipatore e pasta termica', quantita: 1, prezzo: 45, articoloId: 'art-012' }] },
  { cliente: 'cli-015', tipo: 'smartphone', marca: 'Apple', modello: 'iPhone 14 Pro', colore: 'Viola', capacita: '256 GB', imei: '355112233445566', difetto: 'Altoparlante in chiamata assente', stato: 'in_lavorazione', accettato: 2, lavorazione: 3, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione altoparlante', quantita: 1, prezzo: 35, articoloId: 'art-015' }] },
  { cliente: 'cli-016', tipo: 'tablet', marca: 'Samsung', modello: 'Galaxy Tab A8', capacita: '64 GB', imei: 'SMX200-44219', difetto: 'Non ricarica', stato: 'in_attesa', accettato: 4, lavorazione: 4, tecnico: 'Michele' },
  { cliente: 'cli-017', tipo: 'desktop', marca: 'Acer', modello: 'Veriton X2665G', capacita: 'Windows 10 Pro', imei: 'VX2665-00912', difetto: 'Sostituzione HDD con SSD', stato: 'in_lavorazione', accettato: 6, lavorazione: 4, tecnico: 'Michele', interventi: [{ descrizione: 'SSD NVMe 1 TB + clonazione dati', quantita: 1, prezzo: 149, articoloId: 'art-010' }] },
  { cliente: 'cli-018', tipo: 'smartphone', marca: 'Huawei', modello: 'P30 Lite', colore: 'Nero', capacita: '128 GB', imei: '866112233445599', difetto: 'Display rotto dopo caduta', stato: 'preventivo_inviato', accettato: 4, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione display', quantita: 1, prezzo: 95 }] },
  { cliente: 'cli-019', tipo: 'smartwatch', marca: 'Apple', modello: 'Watch Series 7', capacita: '45 mm', imei: 'AW7-556677', difetto: 'Vetro crepato', stato: 'in_attesa', accettato: 5, lavorazione: 6, tecnico: 'Antonio' },
  { cliente: 'cli-020', tipo: 'desktop', marca: 'Assemblato', modello: 'Cassa Bar PC', capacita: 'Windows 10', imei: 'BAR-PC-0031', difetto: 'Aggiornamento gestionale cassa', stato: 'pronto_per_ritiro', accettato: 4, lavorazione: 2, tecnico: 'Michele', interventi: [{ descrizione: 'Assistenza software gestionale', quantita: 2, prezzo: 40 }] },
  { cliente: 'cli-021', tipo: 'smartphone', marca: 'OnePlus', modello: 'Nord 3', colore: 'Grigio', capacita: '256 GB', imei: '861223344556677', difetto: 'Ricarica lenta', stato: 'in_attesa', accettato: 6, lavorazione: 5, tecnico: 'Antonio' },
  { cliente: 'cli-022', tipo: 'notebook', marca: 'Asus', modello: 'VivoBook 15', capacita: 'Windows 11', imei: 'AS-VB15-3321', difetto: 'Rimozione malware e lentezza', stato: 'pronto_per_ritiro', accettato: 5, lavorazione: 2, tecnico: 'Michele', interventi: [{ descrizione: 'Bonifica malware e ottimizzazione', quantita: 1, prezzo: 55 }, { descrizione: 'Licenza antivirus 1 anno', quantita: 1, prezzo: 59, articoloId: 'art-018' }] },
  { cliente: 'cli-023', tipo: 'smartphone', marca: 'Motorola', modello: 'Moto G84', colore: 'Blu', capacita: '256 GB', imei: '867334455667788', difetto: 'Connettore di ricarica ossidato', stato: 'in_lavorazione', accettato: 3, lavorazione: 3, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione connettore USB-C', quantita: 1, prezzo: 45, articoloId: 'art-008' }] },
  { cliente: 'cli-024', tipo: 'smartphone', marca: 'Apple', modello: 'iPhone SE 2022', colore: 'Bianco', capacita: '64 GB', imei: '351998877665544', difetto: 'Batteria da sostituire', stato: 'consegnato', accettato: 7, lavorazione: 7, tecnico: 'Antonio', interventi: [{ descrizione: 'Sostituzione batteria', quantita: 1, prezzo: 59, articoloId: 'art-003' }] },
]

export const RIPARAZIONI: Riparazione[] = SEMI_RIPARAZIONI.map((seme, indice) => {
  const progressivo = String(indice + 1).padStart(4, '0')
  const dataAccettazione = giorniFa(seme.accettato)
  const consegnaPrevista =
    seme.lavorazione !== undefined ? giorniFa(seme.accettato - seme.lavorazione) : undefined

  return {
    id: `rip-${progressivo}`,
    codice: `#${anno}-${progressivo}`,
    clienteId: seme.cliente,
    tipoDispositivo: seme.tipo,
    marca: seme.marca,
    modello: seme.modello,
    colore: seme.colore,
    capacita: seme.capacita,
    imei: seme.imei,
    difettoSegnalato: seme.difetto,
    condizioniEsterne: 'buone',
    accessori: {
      scatola: false,
      cover: seme.tipo === 'smartphone',
      caricabatterie: seme.tipo !== 'smartphone',
      cavoUsb: false,
    },
    stato: seme.stato,
    dataAccettazione,
    consegnaPrevista,
    dataConsegna: seme.stato === 'consegnato' ? consegnaPrevista : undefined,
    tecnico: seme.tecnico,
    acconto: seme.acconto,
    interventi: (seme.interventi ?? []).map((riga, i) => ({
      id: `rip-${progressivo}-int-${i + 1}`,
      descrizione: riga.descrizione,
      quantita: riga.quantita,
      prezzoUnitario: riga.prezzo,
      articoloId: riga.articoloId,
    })),
  }
})

// -------------------------------------------------------------- Preventivi

export const PREVENTIVI: Preventivo[] = [
  { id: 'prv-001', numero: `P${anno}-0014`, clienteId: 'cli-002', riparazioneId: 'rip-0002', data: giorniFa(1), validoFino: traGiorni(29), stato: 'inviato', iva: 22, righe: [{ id: 'prv-001-1', descrizione: 'Sostituzione batteria MacBook Air M1', quantita: 1, prezzoUnitario: 189, articoloId: 'art-005' }] },
  { id: 'prv-002', numero: `P${anno}-0013`, clienteId: 'cli-012', riparazioneId: 'rip-0012', data: giorniFa(3), validoFino: traGiorni(27), stato: 'inviato', iva: 22, righe: [{ id: 'prv-002-1', descrizione: 'Sostituzione tastiera notebook', quantita: 1, prezzoUnitario: 65, articoloId: 'art-017' }] },
  { id: 'prv-003', numero: `P${anno}-0012`, clienteId: 'cli-018', riparazioneId: 'rip-0018', data: giorniFa(4), validoFino: traGiorni(26), stato: 'inviato', iva: 22, righe: [{ id: 'prv-003-1', descrizione: 'Sostituzione display Huawei P30 Lite', quantita: 1, prezzoUnitario: 95 }] },
  { id: 'prv-004', numero: `P${anno}-0011`, clienteId: 'cli-017', data: giorniFa(8), validoFino: traGiorni(22), stato: 'accettato', iva: 22, righe: [{ id: 'prv-004-1', descrizione: 'Upgrade SSD 1 TB su 6 postazioni', quantita: 6, prezzoUnitario: 149, articoloId: 'art-010' }] },
  { id: 'prv-005', numero: `P${anno}-0010`, clienteId: 'cli-014', data: giorniFa(12), validoFino: traGiorni(18), stato: 'accettato', iva: 22, righe: [{ id: 'prv-005-1', descrizione: 'Manutenzione programmata parco notebook', quantita: 8, prezzoUnitario: 45 }] },
  { id: 'prv-006', numero: `P${anno}-0009`, clienteId: 'cli-009', data: giorniFa(20), validoFino: traGiorni(10), stato: 'rifiutato', iva: 22, righe: [{ id: 'prv-006-1', descrizione: 'Sostituzione stampante fiscale', quantita: 1, prezzoUnitario: 620 }] },
  { id: 'prv-007', numero: `P${anno}-0008`, clienteId: 'cli-020', data: giorniFa(35), validoFino: giorniFa(5), stato: 'scaduto', iva: 22, righe: [{ id: 'prv-007-1', descrizione: 'Nuovo PC cassa completo', quantita: 1, prezzoUnitario: 890 }] },
  { id: 'prv-008', numero: `P${anno}-0015`, clienteId: 'cli-023', data: giorniFa(0), stato: 'bozza', iva: 22, righe: [{ id: 'prv-008-1', descrizione: 'Sostituzione connettore USB-C', quantita: 1, prezzoUnitario: 45, articoloId: 'art-008' }] },
]

// ---------------------------------------------------------------- Fatture

/** Catalogo di interventi ricorrenti usato per generare lo storico incassi. */
const CATALOGO_INTERVENTI: Array<{ descrizione: string; prezzo: number; articoloId?: string }> = [
  { descrizione: 'Sostituzione batteria iPhone', prezzo: 59, articoloId: 'art-003' },
  { descrizione: 'Sostituzione batteria Samsung', prezzo: 55, articoloId: 'art-004' },
  { descrizione: 'Sostituzione display iPhone', prezzo: 199, articoloId: 'art-001' },
  { descrizione: 'Sostituzione display iPhone 11', prezzo: 89, articoloId: 'art-002' },
  { descrizione: 'Pellicola in vetro temperato', prezzo: 15, articoloId: 'art-006' },
  { descrizione: 'Sostituzione connettore di ricarica', prezzo: 45, articoloId: 'art-007' },
  { descrizione: 'Sostituzione connettore USB-C', prezzo: 45, articoloId: 'art-008' },
  { descrizione: 'Cover protettiva', prezzo: 19, articoloId: 'art-014' },
  { descrizione: 'Formattazione e reinstallazione sistema', prezzo: 60 },
  { descrizione: 'Bonifica malware e ottimizzazione', prezzo: 55 },
  { descrizione: 'Diagnosi e preventivo', prezzo: 20 },
  { descrizione: 'Upgrade SSD NVMe 1 TB', prezzo: 109, articoloId: 'art-010' },
  { descrizione: 'Upgrade RAM 16 GB', prezzo: 69, articoloId: 'art-011' },
  { descrizione: 'Pulizia interna e pasta termica', prezzo: 35, articoloId: 'art-012' },
  { descrizione: 'Alimentatore universale 65W', prezzo: 39, articoloId: 'art-013' },
  { descrizione: 'Licenza antivirus 1 anno', prezzo: 59, articoloId: 'art-018' },
]

/**
 * Storico fatture degli ultimi 75 giorni: alimenta incassi giornalieri,
 * andamento del mese, prodotti più venduti e statistiche.
 */
function generaFatture(): Fattura[] {
  const random = mulberry32(20_240_518)
  const fatture: Fattura[] = []
  let progressivo = 0

  for (let giorno = 75; giorno >= 0; giorno--) {
    const data = new Date(OGGI.getTime() - giorno * MS_GIORNO)
    const giornoSettimana = data.getDay()
    if (giornoSettimana === 0) continue // negozio chiuso la domenica

    // Volume crescente nel tempo, con un calo il sabato.
    const base = 2 + Math.floor((75 - giorno) / 26)
    const quante = Math.max(
      1,
      Math.round(base + random() * 2.4 - (giornoSettimana === 6 ? 1.2 : 0)),
    )

    for (let i = 0; i < quante; i++) {
      progressivo += 1
      const cliente = CLIENTI[Math.floor(random() * CLIENTI.length)]
      const numeroRighe = random() > 0.72 ? 2 : 1
      const righe = Array.from({ length: numeroRighe }, (_, r) => {
        const voce = CATALOGO_INTERVENTI[Math.floor(random() * CATALOGO_INTERVENTI.length)]
        return {
          id: `ft-${progressivo}-${r + 1}`,
          descrizione: voce.descrizione,
          quantita: random() > 0.88 ? 2 : 1,
          prezzoUnitario: voce.prezzo,
          articoloId: voce.articoloId,
        }
      })

      const dataISO = iso(data)
      const pagata = giorno > 2 ? random() > 0.08 : random() > 0.35
      const metodi: Fattura['metodoPagamento'][] = ['contanti', 'carta', 'bonifico', 'satispay']

      fatture.push({
        id: `fat-${String(progressivo).padStart(4, '0')}`,
        numero: `${String(progressivo).padStart(4, '0')}/${OGGI.getFullYear()}`,
        clienteId: cliente.id,
        data: dataISO,
        scadenza: iso(new Date(data.getTime() + 30 * MS_GIORNO)),
        // La soglia coincide con i 30 giorni di scadenza: altrimenti nascono
        // fatture «emesse» con una data di scadenza già passata.
        stato: pagata ? 'pagata' : giorno > 30 ? 'scaduta' : 'emessa',
        righe,
        iva: 22,
        metodoPagamento: pagata ? metodi[Math.floor(random() * metodi.length)] : undefined,
        dataPagamento: pagata ? dataISO : undefined,
      })
    }
  }

  return fatture.reverse() // le più recenti per prime
}

export const FATTURE: Fattura[] = generaFatture()

// -------------------------------------------------------- Ordini fornitori

export const ORDINI: OrdineFornitore[] = [
  { id: 'ord-001', numero: `O${anno}-0021`, fornitore: 'Mobile Parts Italia', data: giorniFa(2), consegnaPrevista: traGiorni(3), stato: 'in_transito', righe: [{ id: 'ord-001-1', articoloId: 'art-003', descrizione: 'Batteria iPhone (serie 11/12/13)', quantita: 10, prezzoUnitario: 18 }, { id: 'ord-001-2', articoloId: 'art-008', descrizione: 'Connettore di ricarica USB-C', quantita: 10, prezzoUnitario: 8 }] },
  { id: 'ord-002', numero: `O${anno}-0020`, fornitore: 'Apple Parts Distribution', data: giorniFa(4), consegnaPrevista: traGiorni(6), stato: 'inviato', righe: [{ id: 'ord-002-1', articoloId: 'art-005', descrizione: 'Batteria MacBook Air M1', quantita: 4, prezzoUnitario: 96 }] },
  { id: 'ord-003', numero: `O${anno}-0019`, fornitore: 'Cellularline S.p.A.', data: giorniFa(9), consegnaPrevista: giorniFa(4), stato: 'ricevuto', righe: [{ id: 'ord-003-1', articoloId: 'art-006', descrizione: 'Vetro temperato universale', quantita: 50, prezzoUnitario: 2.5 }, { id: 'ord-003-2', articoloId: 'art-014', descrizione: 'Cover protettiva (assortite)', quantita: 60, prezzoUnitario: 3.2 }] },
  { id: 'ord-004', numero: `O${anno}-0018`, fornitore: 'Esprinet', data: giorniFa(14), consegnaPrevista: giorniFa(9), stato: 'ricevuto', righe: [{ id: 'ord-004-1', articoloId: 'art-010', descrizione: 'SSD NVMe 1 TB', quantita: 8, prezzoUnitario: 58 }] },
  { id: 'ord-005', numero: `O${anno}-0022`, fornitore: 'Esprinet', data: giorniFa(0), stato: 'bozza', righe: [{ id: 'ord-005-1', articoloId: 'art-016', descrizione: 'Kit ventola PlayStation 5', quantita: 3, prezzoUnitario: 29 }, { id: 'ord-005-2', articoloId: 'art-017', descrizione: 'Tastiera notebook (assortite)', quantita: 5, prezzoUnitario: 22 }] },
  { id: 'ord-006', numero: `O${anno}-0017`, fornitore: 'Mobile Parts Italia', data: giorniFa(28), consegnaPrevista: giorniFa(24), stato: 'annullato', righe: [{ id: 'ord-006-1', articoloId: 'art-002', descrizione: 'Display iPhone 11 (incell)', quantita: 6, prezzoUnitario: 42 }] },
]

// --------------------------------------------------------------- Scadenze

export const SCADENZE: Scadenza[] = [
  { id: 'sca-001', titolo: 'Pagamento fornitore', descrizione: 'Cellularline S.p.A.', tipo: 'pagamento_fornitore', priorita: 'urgente', data: traGiorni(2), importo: 1240, completata: false },
  { id: 'sca-002', titolo: 'Contratto manutenzione', descrizione: 'Studio Tecnico Bianchi', tipo: 'contratto', priorita: 'normale', data: traGiorni(7), importo: 900, completata: false },
  { id: 'sca-003', titolo: 'Rinnovo antivirus server', descrizione: 'Licenze Achab — 10 postazioni', tipo: 'rinnovo', priorita: 'normale', data: traGiorni(12), importo: 280, completata: false },
  { id: 'sca-004', titolo: 'Liquidazione IVA trimestrale', descrizione: 'Versamento F24 tramite commercialista', tipo: 'tassa', priorita: 'urgente', data: traGiorni(4), importo: 2150, completata: false },
  { id: 'sca-005', titolo: 'Richiamo cliente per ritiro', descrizione: 'Alessandro Palumbo — PlayStation 5 pronta', tipo: 'promemoria', priorita: 'bassa', data: traGiorni(1), completata: false },
  { id: 'sca-006', titolo: 'Pagamento fornitore', descrizione: 'Esprinet — fattura 2210', tipo: 'pagamento_fornitore', priorita: 'normale', data: traGiorni(18), importo: 640, completata: false },
  { id: 'sca-007', titolo: 'Manutenzione impianto Farmacia Centrale', descrizione: 'Controllo semestrale rete e NAS', tipo: 'promemoria', priorita: 'normale', data: traGiorni(25), completata: false },
  { id: 'sca-008', titolo: 'Rinnovo dominio e hosting', descrizione: 'ioriparo.it', tipo: 'rinnovo', priorita: 'bassa', data: giorniFa(3), importo: 95, completata: true },
]

// --------------------------------------------------------------- Impianti

export const IMPIANTI: Impianto[] = [
  { id: 'imp-001', nome: 'Rete LAN + NAS', clienteId: 'cli-009', tipologia: 'Rete dati', indirizzo: 'Corso Umberto I 5, Altamura', dataInstallazione: giorniFa(400), prossimaManutenzione: traGiorni(25), stato: 'attivo', note: 'Backup giornaliero su NAS Synology.' },
  { id: 'imp-002', nome: 'Videosorveglianza 8 canali', clienteId: 'cli-014', tipologia: 'Videosorveglianza', indirizzo: 'Z.I. Via Corato 9, Altamura', dataInstallazione: giorniFa(320), prossimaManutenzione: traGiorni(40), stato: 'attivo' },
  { id: 'imp-003', nome: 'Laboratorio informatica (24 PC)', clienteId: 'cli-017', tipologia: 'Postazioni di lavoro', indirizzo: 'Via Carpentino 40, Altamura', dataInstallazione: giorniFa(280), prossimaManutenzione: traGiorni(9), stato: 'in_manutenzione', note: 'Upgrade SSD in corso su 6 postazioni.' },
  { id: 'imp-004', nome: 'Cassa e stampante fiscale', clienteId: 'cli-020', tipologia: 'Registratore di cassa', indirizzo: 'Piazza Duomo 1, Altamura', dataInstallazione: giorniFa(210), prossimaManutenzione: traGiorni(60), stato: 'da_verificare', note: 'Segnalati blocchi in fase di chiusura giornaliera.' },
  { id: 'imp-005', nome: 'Server gestionale', clienteId: 'cli-008', tipologia: 'Server', indirizzo: 'Via Mura Megalitiche 22, Altamura', dataInstallazione: giorniFa(500), prossimaManutenzione: traGiorni(7), stato: 'attivo', note: 'Contratto di manutenzione annuale.' },
  { id: 'imp-006', nome: 'Rete Wi-Fi sala vendita', clienteId: 'cli-010', tipologia: 'Rete wireless', indirizzo: 'Via Bari 140, Altamura', dataInstallazione: giorniFa(150), stato: 'dismesso', note: 'Sostituita da impianto di altro fornitore.' },
]

// ---------------------------------------------------------------- Azienda

export const AZIENDA: Azienda = {
  nome: 'IO RIPARO',
  claim: 'Assistenza e Riparazioni',
  indirizzo: 'Via Roma 123',
  citta: '70022 Altamura (BA)',
  telefono: '377 381 97 87',
  email: 'ioriparo15@gmail.com',
  partitaIva: '08123450726',
  ivaPredefinita: 22,
  giorniValiditaPreventivo: 30,
  prefissoCodice: `#${anno}-`,
  formatoFattura: FORMATO_FATTURA_PREDEFINITO,
  formatoPreventivo: FORMATO_PREVENTIVO_PREDEFINITO,
}

export function creaDatabaseIniziale(): DatabaseGestionale {
  return {
    clienti: CLIENTI,
    riparazioni: RIPARAZIONI,
    preventivi: PREVENTIVI,
    fatture: FATTURE,
    magazzino: MAGAZZINO,
    ordini: ORDINI,
    scadenze: SCADENZE,
    impianti: IMPIANTI,
    azienda: AZIENDA,
  }
}

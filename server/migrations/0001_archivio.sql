-- Archivio del gestionale, sincronizzato fra le postazioni del negozio.
--
-- I record sono conservati come documenti JSON, uno per riga, invece che in
-- tabelle relazionali: i modelli vivono nel frontend ed evolvono con esso, e
-- una riga per record è sufficiente a far convivere due postazioni che
-- modificano cose diverse. Ciò che serve al server è solo sapere che cosa è
-- cambiato e quando.

CREATE TABLE IF NOT EXISTS record (
  collezione TEXT NOT NULL,
  id TEXT NOT NULL,
  -- Documento JSON del record, senza allegati (vedi tabella `allegato`).
  dati TEXT NOT NULL,
  -- Millisecondi epoch dell'ultima scrittura accettata dal server.
  aggiornato_il INTEGER NOT NULL,
  -- Le eliminazioni restano come lapidi: senza, una postazione offline
  -- ricaricherebbe al rientro un record cancellato altrove.
  eliminato INTEGER NOT NULL DEFAULT 0,
  -- Postazione che ha effettuato l'ultima scrittura, utile in diagnosi.
  origine TEXT,
  PRIMARY KEY (collezione, id)
);

-- La sincronizzazione chiede sempre «che cosa è cambiato dopo questo istante».
CREATE INDEX IF NOT EXISTS idx_record_aggiornato ON record (aggiornato_il);

-- Foto e firme stanno a parte: dentro il record supererebbero il limite di
-- 1 MB per riga di D1, e non vanno riscaricate a ogni sincronizzazione.
CREATE TABLE IF NOT EXISTS allegato (
  id TEXT PRIMARY KEY,
  riparazione_id TEXT NOT NULL,
  -- 'foto' oppure 'firma'.
  tipo TEXT NOT NULL,
  -- Posizione nella galleria, per conservare l'ordine di scatto.
  ordine INTEGER NOT NULL DEFAULT 0,
  -- Immagine come data URL già compressa dal client.
  dati TEXT NOT NULL,
  aggiornato_il INTEGER NOT NULL,
  eliminato INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_allegato_riparazione ON allegato (riparazione_id);
CREATE INDEX IF NOT EXISTS idx_allegato_aggiornato ON allegato (aggiornato_il);

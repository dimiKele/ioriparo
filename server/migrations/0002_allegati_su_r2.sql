-- Gli allegati passano su R2: in D1 resta solo l'indice.
--
-- Conservare le immagini in D1 era la scelta sbagliata. Lo spazio costa
-- 0,75 $ per GB al mese contro 0,015 $ di R2, il base64 gonfia i byte di un
-- terzo, ogni riga non può superare i 2 MB e — soprattutto — il database si
-- ferma a 10 GB: riempiendolo di foto si bloccherebbe l'intero archivio, non
-- solo la galleria. Un database serve a indicizzare, non a custodire byte.

DROP TABLE IF EXISTS allegato;

CREATE TABLE allegato (
  id TEXT PRIMARY KEY,
  riparazione_id TEXT NOT NULL,
  -- 'foto' oppure 'firma'.
  tipo TEXT NOT NULL,
  -- Posizione nella galleria, per conservare l'ordine di scatto.
  ordine INTEGER NOT NULL DEFAULT 0,
  -- Chiave dell'oggetto nel bucket R2.
  chiave TEXT NOT NULL,
  -- Tipo MIME, necessario a servire l'immagine con l'intestazione corretta.
  tipo_mime TEXT NOT NULL DEFAULT 'image/jpeg',
  byte INTEGER NOT NULL DEFAULT 0,
  aggiornato_il INTEGER NOT NULL,
  eliminato INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_allegato_riparazione ON allegato (riparazione_id);
CREATE INDEX idx_allegato_aggiornato ON allegato (aggiornato_il);

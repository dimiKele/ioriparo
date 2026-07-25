import { Campo, PiedeDocumento, Sezione, TestataDocumento } from './parti'
import { imponibile, saldoRiparazione, scorporoIva, totaleRiparazione } from '@/lib/calcoli'
import { formatData, formatEuro } from '@/lib/format'
import { STATI_RIPARAZIONE, TIPI_DISPOSITIVO } from '@/lib/stati'
import type { Azienda, Cliente, Riparazione } from '@/types'

const CONDIZIONI_SERVIZIO = [
  'Il preventivo di massima indicato non è vincolante: eventuali variazioni saranno comunicate e approvate dal cliente prima di procedere.',
  'I dati presenti sul dispositivo non sono oggetto del servizio: il cliente dichiara di aver effettuato una copia di sicurezza.',
  'La riparazione è garantita 12 mesi sul componente sostituito, esclusi danni da caduta, liquidi o manomissione.',
  'I dispositivi non ritirati entro 90 giorni dalla comunicazione di fine lavori si intendono abbandonati ai sensi dell’art. 923 c.c.',
  'Il ritiro avviene dietro presentazione del presente tagliando e di un documento di identità.',
]

/** Scheda di accettazione con firma del cliente e tagliando di ritiro. */
export function DocumentoScheda({
  azienda,
  cliente,
  riparazione,
}: {
  azienda: Azienda
  cliente?: Cliente
  riparazione: Riparazione
}) {
  const totale = totaleRiparazione(riparazione)
  const iva = azienda.ivaPredefinita

  const accessori = [
    riparazione.accessori.scatola && 'Scatola',
    riparazione.accessori.cover && 'Cover',
    riparazione.accessori.caricabatterie && 'Caricabatterie',
    riparazione.accessori.cavoUsb && 'Cavo USB',
    riparazione.accessori.altro,
  ].filter(Boolean) as string[]

  return (
    <article className="doc">
      <TestataDocumento azienda={azienda} />

      <h1 className="doc-titolo">Scheda di accettazione</h1>
      <p className="doc-sottotitolo">
        Documento di presa in carico del dispositivo — copia per il cliente
      </p>

      <dl className="doc-meta">
        <div>
          <dt>Numero</dt>
          <dd>{riparazione.codice}</dd>
        </div>
        <div>
          <dt>Accettazione</dt>
          <dd>{formatData(riparazione.dataAccettazione)}</dd>
        </div>
        <div>
          <dt>Consegna prevista</dt>
          <dd>{formatData(riparazione.consegnaPrevista)}</dd>
        </div>
        <div>
          <dt>Stato</dt>
          <dd>{STATI_RIPARAZIONE[riparazione.stato].label}</dd>
        </div>
        <div>
          <dt>Tecnico</dt>
          <dd>{riparazione.tecnico ?? '--'}</dd>
        </div>
      </dl>

      <div className="doc-griglia">
        <Sezione titolo="Dati cliente">
          <div className="doc-campi">
            <Campo etichetta="Nome" valore={cliente?.nome} />
            <Campo etichetta="Telefono" valore={cliente?.telefono} />
            <Campo etichetta="Email" valore={cliente?.email} />
            <Campo
              etichetta="Indirizzo"
              valore={
                cliente?.indirizzo
                  ? `${cliente.indirizzo}, ${cliente.cap ?? ''} ${cliente.citta ?? ''}`.trim()
                  : cliente?.citta
              }
            />
            {cliente?.partitaIva && <Campo etichetta="P. IVA" valore={cliente.partitaIva} />}
          </div>
        </Sezione>

        <Sezione titolo="Dati dispositivo">
          <div className="doc-campi">
            <Campo etichetta="Tipo" valore={TIPI_DISPOSITIVO[riparazione.tipoDispositivo]} />
            <Campo etichetta="Marca e modello" valore={`${riparazione.marca} ${riparazione.modello}`} />
            <Campo
              etichetta="Colore / capacità"
              valore={[riparazione.colore, riparazione.capacita].filter(Boolean).join(' · ') || undefined}
            />
            <Campo etichetta="IMEI / Seriale" valore={riparazione.imei} />
            <Campo
              etichetta="Condizioni esterne"
              valore={
                riparazione.condizioniEsterne
                  ? riparazione.condizioniEsterne.charAt(0).toUpperCase() +
                    riparazione.condizioniEsterne.slice(1)
                  : undefined
              }
            />
          </div>
        </Sezione>
      </div>

      <div className="doc-testo">
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: '7pt',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: '#6b7280',
          }}
        >
          Difetto segnalato dal cliente
        </h2>
        <p style={{ margin: 0 }}>{riparazione.difettoSegnalato}</p>
        {riparazione.noteCondizioni && (
          <p style={{ margin: '6px 0 0', fontSize: '9pt', color: '#4b5563' }}>
            Note sulle condizioni: {riparazione.noteCondizioni}
          </p>
        )}
      </div>

      <div className="doc-griglia">
        <Sezione titolo="Accessori consegnati">
          {accessori.length > 0 ? (
            <ul className="doc-elenco">
              {accessori.map((accessorio) => (
                <li key={accessorio}>{accessorio}</li>
              ))}
            </ul>
          ) : (
            <p>Nessun accessorio consegnato.</p>
          )}
          {riparazione.accessori.note && (
            <p style={{ marginTop: 6, fontSize: '9pt', color: '#4b5563' }}>
              {riparazione.accessori.note}
            </p>
          )}
        </Sezione>

        <Sezione titolo="Preventivo di massima">
          {riparazione.interventi.length > 0 ? (
            <div className="doc-campi">
              {riparazione.interventi.map((riga) => (
                <div className="doc-campo" key={riga.id}>
                  <span>
                    {riga.descrizione}
                    {riga.quantita > 1 ? ` ×${riga.quantita}` : ''}
                  </span>
                  <span>{formatEuro(riga.quantita * riga.prezzoUnitario)}</span>
                </div>
              ))}
              <div className="doc-campo" style={{ borderTop: '1px solid #e5e9f0', paddingTop: 4 }}>
                <span>Imponibile</span>
                <span>{formatEuro(imponibile(totale, iva))}</span>
              </div>
              <div className="doc-campo">
                <span>IVA {iva}%</span>
                <span>{formatEuro(scorporoIva(totale, iva))}</span>
              </div>
              <div className="doc-campo" style={{ fontSize: '11pt' }}>
                <span>
                  <strong>Totale</strong>
                </span>
                <span>{formatEuro(totale)}</span>
              </div>
              {riparazione.acconto ? (
                <>
                  <div className="doc-campo">
                    <span>Acconto versato</span>
                    <span>− {formatEuro(riparazione.acconto)}</span>
                  </div>
                  <div className="doc-campo">
                    <span>
                      <strong>Saldo al ritiro</strong>
                    </span>
                    <span>{formatEuro(saldoRiparazione(riparazione))}</span>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <>
              <p>
                Da definire dopo la diagnosi. Il cliente sarà contattato prima di procedere con
                l’intervento.
              </p>
              {riparazione.acconto ? (
                <div className="doc-campi" style={{ marginTop: 8 }}>
                  <div className="doc-campo">
                    <span>Acconto versato</span>
                    <span>{formatEuro(riparazione.acconto)}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Sezione>
      </div>

      {riparazione.foto && riparazione.foto.length > 0 && (
        // Le foto sono la prova dello stato del dispositivo alla consegna:
        // sul documento firmato dal cliente valgono più che a schermo.
        <div className="doc-foto">
          <h2>Stato del dispositivo alla consegna</h2>
          <div className="doc-foto-griglia">
            {riparazione.foto.map((foto, indice) => (
              <img key={indice} src={foto} alt={`Foto del dispositivo ${indice + 1}`} />
            ))}
          </div>
        </div>
      )}

      <div className="doc-firme">
        <div>
          <div className="doc-firma-riquadro">
            {riparazione.firmaCliente ? (
              <img src={riparazione.firmaCliente} alt="Firma del cliente" />
            ) : null}
          </div>
          <div className="doc-firma-etichetta">
            Firma del cliente per accettazione delle condizioni
          </div>
        </div>
        <div>
          <div className="doc-firma-riquadro" />
          <div className="doc-firma-etichetta">Timbro e firma dell’accettante</div>
        </div>
      </div>

      <div className="doc-condizioni">
        <h2>Condizioni di servizio</h2>
        <ol>
          {CONDIZIONI_SERVIZIO.map((condizione) => (
            <li key={condizione}>{condizione}</li>
          ))}
        </ol>
      </div>

      <div className="doc-tagliando">
        <span className="doc-pastiglia">Tagliando di ritiro</span>
        <div className="doc-griglia" style={{ marginTop: 8 }}>
          <div className="doc-campi">
            <Campo etichetta="Numero scheda" valore={riparazione.codice} />
            <Campo etichetta="Cliente" valore={cliente?.nome} />
            <Campo etichetta="Dispositivo" valore={`${riparazione.marca} ${riparazione.modello}`} />
          </div>
          <div className="doc-campi">
            <Campo etichetta="Consegna prevista" valore={formatData(riparazione.consegnaPrevista)} />
            <Campo
              etichetta="Da saldare al ritiro"
              valore={
                totale > 0
                  ? formatEuro(saldoRiparazione(riparazione))
                  : riparazione.acconto
                    ? `Da definire — acconto ${formatEuro(riparazione.acconto)}`
                    : 'Da definire'
              }
            />
            <Campo etichetta="Contatti" valore={azienda.telefono} />
          </div>
        </div>
      </div>

      <PiedeDocumento azienda={azienda} />
    </article>
  )
}

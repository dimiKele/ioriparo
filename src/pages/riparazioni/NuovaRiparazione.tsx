import { useNavigate } from 'react-router-dom'
import { FormRiparazione, datiVuoti, type DatiForm } from './FormRiparazione'
import { useIntestazione } from '@/components/layout/intestazione'
import { useGestionale } from '@/data/store'
import type { Riparazione } from '@/types'

/** Costruisce il record di riparazione a partire dai dati del modulo. */
export function riparazioneDaForm(dati: DatiForm, clienteId: string): Omit<Riparazione, 'id' | 'codice'> {
  const acconto = Number.parseFloat(dati.acconto.replace(',', '.'))

  return {
    clienteId,
    tipoDispositivo: dati.tipoDispositivo,
    marca: dati.marca.trim(),
    modello: dati.modello.trim(),
    colore: dati.colore.trim() || undefined,
    capacita: dati.capacita.trim() || undefined,
    imei: dati.imei.trim() || undefined,
    passwordBlocco: dati.passwordBlocco.trim() || undefined,
    difettoSegnalato: dati.difettoSegnalato.trim(),
    condizioniEsterne: dati.condizioniEsterne,
    noteCondizioni: dati.noteCondizioni.trim() || undefined,
    accessori: dati.accessori,
    stato: dati.stato,
    dataAccettazione: dati.dataAccettazione,
    consegnaPrevista: dati.consegnaPrevista || undefined,
    dataConsegna: dati.stato === 'consegnato' ? dati.dataAccettazione : undefined,
    tecnico: dati.tecnico.trim() || undefined,
    interventi: [],
    acconto: Number.isFinite(acconto) && acconto > 0 ? acconto : undefined,
    foto: dati.foto.length ? dati.foto : undefined,
    firmaCliente: dati.firmaCliente,
    noteInterne: dati.noteInterne.trim() || undefined,
  }
}

export function NuovaRiparazione() {
  useIntestazione({
    titolo: 'Nuova Accettazione',
    briciole: [
      { label: 'Home', to: '/' },
      { label: 'Dispositivi', to: '/riparazioni' },
      { label: 'Nuova Accettazione' },
    ],
  })

  const { db, aggiungiCliente, aggiornaCliente, aggiungiRiparazione } = useGestionale()
  const navigate = useNavigate()

  function salva(dati: DatiForm, stampa: boolean) {
    const anagrafica = {
      nome: dati.nomeCliente.trim(),
      telefono: dati.telefono.trim(),
      email: dati.email.trim() || undefined,
      indirizzo: dati.indirizzo.trim() || undefined,
      citta: dati.citta.trim() || undefined,
      cap: dati.cap.trim() || undefined,
    }

    let clienteId = dati.clienteId

    if (clienteId) {
      // Le correzioni fatte nel modulo aggiornano il cliente collegato.
      aggiornaCliente(clienteId, anagrafica)
    } else {
      // Stesso nome e stesso telefono: è la stessa persona che torna, non un
      // nuovo cliente. Evita di moltiplicare le anagrafiche a ogni riparazione.
      const cifre = (valore: string) => valore.replace(/\D/g, '')
      const esistente = db.clienti.find(
        (c) =>
          c.nome.trim().toLowerCase() === anagrafica.nome.toLowerCase() &&
          cifre(c.telefono) === cifre(anagrafica.telefono),
      )
      if (esistente) {
        clienteId = esistente.id
        aggiornaCliente(esistente.id, anagrafica)
      } else {
        clienteId = aggiungiCliente({ ...anagrafica, tipo: 'privato' }).id
      }
    }

    const riparazione = aggiungiRiparazione(riparazioneDaForm(dati, clienteId))
    navigate(`/riparazioni/${riparazione.id}${stampa ? '?stampa=1' : ''}`)
  }

  return <FormRiparazione iniziali={datiVuoti()} onSalva={salva} />
}

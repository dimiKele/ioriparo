import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GestionaleProvider } from '@/data/store'
import { SincronizzazioneProvider } from '@/data/sincronizzazione'
import { PortaDiAccesso } from '@/data/accesso'
import { Dashboard } from '@/pages/Dashboard'
import { ClientiList } from '@/pages/clienti/ClientiList'
import { DettaglioCliente } from '@/pages/clienti/DettaglioCliente'
import { RiparazioniList } from '@/pages/riparazioni/RiparazioniList'
import { NuovaRiparazione } from '@/pages/riparazioni/NuovaRiparazione'
import { ModificaRiparazione } from '@/pages/riparazioni/ModificaRiparazione'
import { DettaglioRiparazione } from '@/pages/riparazioni/DettaglioRiparazione'
import { Preventivi } from '@/pages/Preventivi'
import { Fatture } from '@/pages/Fatture'
import { Magazzino } from '@/pages/Magazzino'
import { OrdiniFornitori } from '@/pages/OrdiniFornitori'
import { Scadenze } from '@/pages/Scadenze'
import { Impianti } from '@/pages/Impianti'
import { Statistiche } from '@/pages/Statistiche'
import { Impostazioni } from '@/pages/Impostazioni'
import { Backup } from '@/pages/Backup'
import { NonTrovata } from '@/pages/NonTrovata'

/**
 * Su hosting statico senza riscrittura degli URL (anteprime, GitHub Pages)
 * si compila con `VITE_ROUTER=hash` e la navigazione passa dal fragment.
 */
const creaRouter =
  import.meta.env.VITE_ROUTER === 'hash' ? createHashRouter : createBrowserRouter

const router = creaRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },

      { path: 'clienti', element: <ClientiList /> },
      { path: 'clienti/:id', element: <DettaglioCliente /> },

      { path: 'riparazioni', element: <RiparazioniList /> },
      { path: 'riparazioni/nuova', element: <NuovaRiparazione /> },
      { path: 'riparazioni/:id', element: <DettaglioRiparazione /> },
      { path: 'riparazioni/:id/modifica', element: <ModificaRiparazione /> },

      { path: 'preventivi', element: <Preventivi /> },
      { path: 'preventivi/:id', element: <Preventivi /> },
      { path: 'fatture', element: <Fatture /> },
      { path: 'fatture/:id', element: <Fatture /> },
      { path: 'magazzino', element: <Magazzino /> },
      { path: 'ordini', element: <OrdiniFornitori /> },
      { path: 'scadenze', element: <Scadenze /> },
      { path: 'impianti', element: <Impianti /> },
      { path: 'statistiche', element: <Statistiche /> },
      { path: 'impostazioni', element: <Impostazioni /> },
      { path: 'backup', element: <Backup /> },

      { path: '*', element: <NonTrovata /> },
    ],
  },
])

export function App() {
  return (
    <ErrorBoundary>
      <GestionaleProvider>
        <SincronizzazioneProvider>
          <PortaDiAccesso>
            <RouterProvider router={router} />
          </PortaDiAccesso>
        </SincronizzazioneProvider>
      </GestionaleProvider>
    </ErrorBoundary>
  )
}

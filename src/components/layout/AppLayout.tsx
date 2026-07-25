import { useState } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { AvvisiArchivio } from './AvvisiArchivio'
import { IntestazioneProvider } from './intestazione'

export function AppLayout() {
  const [menuAperto, setMenuAperto] = useState(false)

  return (
    <IntestazioneProvider>
      <div className="min-h-screen bg-base">
        <Sidebar aperta={menuAperto} onChiudi={() => setMenuAperto(false)} />

        <div className="lg:pl-64">
          <Topbar onApriMenu={() => setMenuAperto(true)} />
          <main className="p-4 lg:p-6">
            <AvvisiArchivio />
            <Outlet />
          </main>
        </div>

        <ScrollRestoration />
      </div>
    </IntestazioneProvider>
  )
}

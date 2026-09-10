import React, { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import SatellitePage from './pages/SatellitePage'
import TrackPage from './pages/TrackPage'
import IntensityPage from './pages/IntensityPage'
import DamagePage from './pages/DamagePage'
import PathPage from './pages/PathPage'
import './App.css'

const PAGES = {
  dashboard: Dashboard,
  satellite: SatellitePage,
  track:     TrackPage,
  intensity: IntensityPage,
  damage:    DamagePage,
  path:      PathPage,
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const Page = PAGES[page] || Dashboard

  return (
    <div className="app-shell">
      <Sidebar active={page} onNav={setPage} />
      <main className="app-content">
        <Page onNav={setPage} />
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#e6edf3',
            border: '1px solid #30363d',
          },
        }}
      />
    </div>
  )
}

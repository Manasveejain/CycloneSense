import React, { useEffect, useState } from 'react'
import './Sidebar.css'
import api from '../api/client'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',           icon: '🌐' },
  { id: 'satellite', label: 'Satellite Imagery',   icon: '🛰️' },
  { id: 'track',     label: 'Track Prediction',    icon: '📡' },
  { id: 'intensity', label: 'Intensity Estimation',icon: '🌀' },
  { id: 'damage',    label: 'Damage Estimation',   icon: '⚠️' },
  { id: 'path',      label: 'Path / IMD Data',     icon: '🗺️' },
]

export default function Sidebar({ active, onNav }) {
  const [apiOnline, setApiOnline] = useState(null)

  useEffect(() => {
    api.get('/health')
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))

    const interval = setInterval(() => {
      api.get('/health')
        .then(() => setApiOnline(true))
        .catch(() => setApiOnline(false))
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🌪️</span>
        <div>
          <div className="brand-title">CycloSense</div>
          <div className="brand-sub">AI Prediction System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'nav-item--active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="api-status">
          <span
            className="status-dot"
            style={{
              background: apiOnline === null ? '#eab308' : apiOnline ? '#22c55e' : '#ef4444',
              boxShadow:  `0 0 6px ${apiOnline === null ? '#eab308' : apiOnline ? '#22c55e' : '#ef4444'}`,
            }}
          />
          <span>
            {apiOnline === null ? 'Connecting…' : apiOnline ? 'API Online' : 'API Offline'}
          </span>
        </div>
        <div style={{ fontSize: '.65rem', color: 'var(--muted)', padding: '4px 10px' }}>
          localhost:8000
        </div>
      </div>
    </aside>
  )
}

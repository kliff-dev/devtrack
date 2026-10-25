import { useEffect, useLayoutEffect, useState } from 'react'
import { Brand } from './components/Brand.tsx'
import { Icon } from './components/Icon.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { useHashRoute } from './hooks/useHashRoute.ts'
import { useDevTrack } from './store/DevTrackContext.ts'
import type { View } from './types.ts'
import { ActivityView } from './views/ActivityView.tsx'
import { DashboardView } from './views/DashboardView.tsx'
import { ProjectsView } from './views/ProjectsView.tsx'
import { SettingsView } from './views/SettingsView.tsx'
import './App.css'

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  activity: 'Activity',
  settings: 'Settings',
}

function CurrentView({ view }: { view: View }) {
  switch (view) {
    case 'projects':
      return <ProjectsView />
    case 'activity':
      return <ActivityView />
    case 'settings':
      return <SettingsView />
    default:
      return <DashboardView />
  }
}

function App() {
  const view = useHashRoute()
  const { settings } = useDevTrack()
  const [navOpen, setNavOpen] = useState(false)

  // Before paint, so a saved accent never flashes the default color.
  useLayoutEffect(() => {
    document.documentElement.dataset.accent = settings.accent
  }, [settings.accent])

  useEffect(() => {
    document.title = `${VIEW_TITLES[view]} · DevTrack`
    window.scrollTo({ top: 0 })
  }, [view])

  useEffect(() => {
    if (!navOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [navOpen])

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          // Plain #main would be read as a route, so move focus by hand.
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>

      <Sidebar currentView={view} open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="app__scrim" onClick={() => setNavOpen(false)} />}

      <div className="app__main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Open navigation"
            aria-controls="sidebar"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>
          <Brand />
        </header>

        <main id="main" className="app__content" tabIndex={-1}>
          <CurrentView key={view} view={view} />
        </main>
      </div>
    </div>
  )
}

export default App

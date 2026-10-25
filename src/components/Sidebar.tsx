import { viewHref } from '../hooks/useHashRoute.ts'
import { formatDuration } from '../lib/format.ts'
import { dailyCodingTotals, sumMinutes } from '../lib/stats.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { View } from '../types.ts'
import { Brand } from './Brand.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { ProgressBar } from './ProgressBar.tsx'
import './Sidebar.css'

const NAV_ITEMS: { view: View; label: string; icon: IconName }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { view: 'projects', label: 'Projects', icon: 'folder' },
  { view: 'activity', label: 'Activity', icon: 'activity' },
  { view: 'settings', label: 'Settings', icon: 'settings' },
]

interface SidebarProps {
  currentView: View
  /** Drawer state on small screens; ignored on desktop where the sidebar is always visible. */
  open: boolean
  onClose: () => void
}

export function Sidebar({ currentView, open, onClose }: SidebarProps) {
  const { projects, activity, settings, now } = useDevTrack()

  const weekMinutes = sumMinutes(dailyCodingTotals(activity, 7, now))
  const goalMinutes = settings.weeklyGoalHours * 60
  const counts: Partial<Record<View, number>> = { projects: projects.length }
  const name = settings.displayName.trim()

  return (
    <aside id="sidebar" className={open ? 'sidebar is-open' : 'sidebar'}>
      <div className="sidebar__top">
        <Brand />
        <button
          type="button"
          className="icon-btn sidebar__close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.view}
            href={viewHref(item.view)}
            className="sidebar__link"
            aria-current={item.view === currentView ? 'page' : undefined}
            onClick={onClose}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
            {counts[item.view] !== undefined && (
              <span className="sidebar__count">{counts[item.view]}</span>
            )}
          </a>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar__goal">
          <div className="sidebar__goal-header">
            <Icon name="target" size={14} />
            Weekly goal
          </div>
          <p className="sidebar__goal-value">
            <strong>{formatDuration(weekMinutes)}</strong> of {settings.weeklyGoalHours}h
          </p>
          <ProgressBar
            value={goalMinutes ? (weekMinutes / goalMinutes) * 100 : 0}
            label="Weekly coding goal"
          />
        </div>

        <a href={viewHref('settings')} className="sidebar__profile" onClick={onClose}>
          <span className="sidebar__avatar" aria-hidden="true">
            {(name[0] ?? '?').toUpperCase()}
          </span>
          <span className="sidebar__profile-text">
            <span className="sidebar__profile-name">{name || 'Set your name'}</span>
            <span className="sidebar__profile-hint">Saved in this browser</span>
          </span>
        </a>
      </div>
    </aside>
  )
}

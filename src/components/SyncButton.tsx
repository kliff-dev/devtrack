import { formatRelative } from '../lib/format.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import { Icon } from './Icon.tsx'
import './SyncButton.css'

interface SyncButtonProps {
  /** Show the last sync time (or error) next to the button. */
  showStatus?: boolean
}

/** Runs the collector through the dev server. Renders nothing in a production build. */
export function SyncButton({ showStatus = false }: SyncButtonProps) {
  const { sync, canSyncNow, syncNow, now } = useDevTrack()
  if (!canSyncNow) return null

  const syncing = sync.status === 'syncing'
  const failed = sync.status === 'error'
  const lastSynced = sync.payload
    ? `Last synced ${formatRelative(sync.payload.syncedAt, now)}`
    : 'Not synced yet'

  return (
    <span className="sync-control">
      {showStatus && (
        <span className="sync-control__status" data-error={failed || undefined}>
          {failed ? (sync.error ?? 'Sync failed') : lastSynced}
        </span>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => void syncNow()}
        disabled={syncing}
        title={failed ? (sync.error ?? 'Sync failed') : lastSynced}
      >
        <Icon name={failed && !syncing ? 'alert' : 'refresh'} className={syncing ? 'icon icon--spin' : 'icon'} />
        {syncing ? 'Syncing…' : failed ? 'Retry sync' : 'Sync now'}
      </button>
    </span>
  )
}

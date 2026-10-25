import { useId, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { Icon } from '../components/Icon.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { Panel } from '../components/Panel.tsx'
import { SyncButton } from '../components/SyncButton.tsx'
import { ACCENT_OPTIONS, SOURCE_LABELS, SYNCED_SOURCES } from '../constants.ts'
import { downloadJson } from '../lib/exportData.ts'
import { formatRelative } from '../lib/format.ts'
import { folderName } from '../lib/paths.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { SyncSourceStatus } from '../types.ts'
import './SettingsView.css'

const MAX_GOAL_HOURS = 168

function describeSource(status: SyncSourceStatus | undefined): string {
  if (!status) return 'Not synced yet'
  if (!status.available) return status.note ?? 'Unavailable'
  const count =
    status.source === 'git'
      ? `${status.commits ?? 0} ${status.commits === 1 ? 'commit' : 'commits'}`
      : `${status.sessions ?? 0} ${status.sessions === 1 ? 'session' : 'sessions'}`
  return status.note ? `${count} · ${status.note}` : count
}

export function SettingsView() {
  const {
    now,
    settings,
    projects,
    activity,
    actions,
    sync,
    canSyncNow,
    ignoredPaths,
    hasSampleData,
    updateSettings,
    unignorePath,
    removeSampleData,
    resetToSampleData,
    clearAllData,
  } = useDevTrack()
  const [goalDraft, setGoalDraft] = useState(String(settings.weeklyGoalHours))
  const [confirming, setConfirming] = useState<'reset' | 'clear' | null>(null)
  const ids = useId()

  const payload = sync.payload
  const syncedCount = activity.filter((entry) => entry.source && entry.source !== 'manual').length
  const keepsSynced = syncedCount > 0 ? ' Synced activity is kept.' : ''
  const skipped = payload?.skippedFolders
    ? ` · ${payload.skippedFolders} deleted or excluded ${payload.skippedFolders === 1 ? 'folder' : 'folders'} skipped`
    : ''
  const syncHint = payload
    ? `Last synced ${formatRelative(payload.syncedAt, now)} · last ${payload.lookbackDays} days · a pause over ${payload.idleGapMinutes} min splits a session${skipped}. Tune these in devtrack.config.json.`
    : 'No sync yet. The first sync writes public/data/sync.json.'

  function changeGoal(text: string) {
    setGoalDraft(text)
    const hours = Number(text)
    if (text && Number.isFinite(hours) && hours >= 1 && hours <= MAX_GOAL_HOURS) {
      updateSettings({ weeklyGoalHours: Math.round(hours) })
    }
  }

  function exportData() {
    downloadJson(
      { app: 'DevTrack', version: 1, exportedAt: new Date().toISOString(), settings, projects, activity, actions },
      'devtrack-export',
    )
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Settings" description="Personalize DevTrack. Changes are saved automatically." />

      <Panel title="Profile">
        <SettingRow
          label="Display name"
          hint="Used in the dashboard greeting and the sidebar."
          htmlFor={`${ids}-name`}
        >
          <input
            id={`${ids}-name`}
            className="input"
            value={settings.displayName}
            maxLength={40}
            placeholder="Your name"
            autoComplete="nickname"
            onChange={(event) => updateSettings({ displayName: event.target.value })}
          />
        </SettingRow>
      </Panel>

      <Panel title="Goals">
        <SettingRow
          label="Weekly coding goal"
          hint="Hours of coding sessions you aim for in any 7-day window."
          htmlFor={`${ids}-goal`}
        >
          <div className="input-with-suffix">
            <input
              id={`${ids}-goal`}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_GOAL_HOURS}
              value={goalDraft}
              onChange={(event) => changeGoal(event.target.value)}
              onBlur={() => setGoalDraft(String(settings.weeklyGoalHours))}
            />
            <span>hours</span>
          </div>
        </SettingRow>
      </Panel>

      <Panel title="Appearance">
        <SettingRow label="Accent color" hint="Highlights, charts and primary buttons.">
          <div className="accent-picker" role="radiogroup" aria-label="Accent color">
            {ACCENT_OPTIONS.map((option) => (
              <label key={option.value} className="accent-option" data-accent={option.value}>
                <input
                  type="radio"
                  name={`${ids}-accent`}
                  className="sr-only"
                  value={option.value}
                  checked={settings.accent === option.value}
                  onChange={() => updateSettings({ accent: option.value })}
                />
                <span className="accent-option__swatch" />
                <span className="accent-option__label">{option.label}</span>
              </label>
            ))}
          </div>
        </SettingRow>
      </Panel>

      <Panel
        title="Activity sources"
        subtitle="Coding sessions and commits are read from this machine and attributed to projects by folder."
      >
        <ul className="source-list">
          {SYNCED_SOURCES.map((source) => {
            const status = payload?.sources.find((item) => item.source === source)
            return (
              <li
                key={source}
                className="source-item"
                data-unavailable={status && !status.available ? true : undefined}
              >
                <span className="source-item__dot" data-source={source} />
                <div className="source-item__text">
                  <p className="source-item__name">{SOURCE_LABELS[source]}</p>
                  <p className="source-item__detail">{describeSource(status)}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <SettingRow label="Sync" hint={syncHint}>
          {canSyncNow ? (
            <SyncButton showStatus />
          ) : (
            <p className="setting-row__note">
              Run <code>npm run sync</code> in the project folder, then reload.
            </p>
          )}
        </SettingRow>

        {ignoredPaths.length > 0 && (
          <SettingRow
            label="Ignored folders"
            hint="Folders whose project you deleted. They stay out of future syncs until restored."
          >
            <ul className="ignored-list">
              {ignoredPaths.map((path) => (
                <li key={path}>
                  <span title={path}>{folderName(path)}</span>
                  <button type="button" className="btn btn--sm" onClick={() => unignorePath(path)}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </SettingRow>
        )}
      </Panel>

      <Panel
        title="Data"
        subtitle={`${projects.length} projects, ${activity.length} activity entries (${syncedCount} synced) and ${actions.length} actions are stored in this browser’s localStorage.`}
      >
        <SettingRow label="Export data" hint="Download a JSON backup of everything in DevTrack.">
          <button type="button" className="btn" onClick={exportData}>
            <Icon name="download" />
            Export JSON
          </button>
        </SettingRow>
        {hasSampleData && (
          <SettingRow
            label="Remove sample data"
            hint="Delete the demo projects, activity and actions from the first launch. Your own data stays."
          >
            <button type="button" className="btn" onClick={removeSampleData}>
              <Icon name="trash" />
              Remove samples
            </button>
          </SettingRow>
        )}
        <SettingRow
          label="Restore sample data"
          hint={`Replace projects, actions and manually added activity with the demo content.${keepsSynced}`}
        >
          <button type="button" className="btn" onClick={() => setConfirming('reset')}>
            <Icon name="refresh" />
            Restore
          </button>
        </SettingRow>
        <SettingRow
          label="Clear all data"
          hint={`Remove every project, action and manually added activity entry. Settings are kept.${keepsSynced}`}
        >
          <button type="button" className="btn btn--danger" onClick={() => setConfirming('clear')}>
            <Icon name="trash" />
            Clear data
          </button>
        </SettingRow>
      </Panel>

      {confirming === 'reset' && (
        <ConfirmDialog
          title="Restore sample data?"
          message={`Your projects, actions and manually added activity will be replaced with the demo content.${keepsSynced}`}
          confirmLabel="Restore sample data"
          onConfirm={resetToSampleData}
          onClose={() => setConfirming(null)}
        />
      )}
      {confirming === 'clear' && (
        <ConfirmDialog
          title="Clear all data?"
          message={`This permanently removes all projects, actions and manually added activity from this browser. Export a backup first if you want to keep them.${keepsSynced}`}
          confirmLabel="Clear everything"
          tone="danger"
          onConfirm={clearAllData}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

interface SettingRowProps {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}

function SettingRow({ label, hint, htmlFor, children }: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row__text">
        {htmlFor ? (
          <label className="setting-row__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <p className="setting-row__label">{label}</p>
        )}
        {hint && <p className="setting-row__hint">{hint}</p>}
      </div>
      <div className="setting-row__control">{children}</div>
    </div>
  )
}

import { createContext, useContext } from 'react'
import type {
  ActivityEntry,
  NextAction,
  Project,
  ProjectDraft,
  Settings,
  SyncPayload,
} from '../types.ts'

export type NewAction = Pick<NextAction, 'title' | 'projectId' | 'priority'>

export interface SyncState {
  /** The most recently applied payload, from the sync file or a "Sync now". */
  payload: SyncPayload | null
  status: 'idle' | 'syncing' | 'error'
  error?: string
}

export interface DevTrackStore {
  /** Shared clock (ms), ticks every minute. */
  now: number
  projects: Project[]
  projectsById: Map<string, Project>
  activity: ActivityEntry[]
  actions: NextAction[]
  settings: Settings
  sync: SyncState
  /** True when the dev server can run the collector on request. */
  canSyncNow: boolean
  /** Folders whose auto-created project was deleted; a sync won't recreate them. */
  ignoredPaths: string[]
  /** True while any of the first-launch demo content is still present. */
  hasSampleData: boolean
  /** Creates a project, or updates the one with `id`. */
  saveProject: (draft: ProjectDraft, id?: string) => void
  /** Removes a project together with its actions and activity. */
  deleteProject: (id: string) => void
  addAction: (action: NewAction) => void
  toggleAction: (id: string) => void
  deleteAction: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  syncNow: () => Promise<void>
  unignorePath: (path: string) => void
  removeSampleData: () => void
  resetToSampleData: () => void
  clearAllData: () => void
}

export const DevTrackContext = createContext<DevTrackStore | null>(null)

export function useDevTrack(): DevTrackStore {
  const store = useContext(DevTrackContext)
  if (!store) throw new Error('useDevTrack must be used inside <DevTrackProvider>')
  return store
}

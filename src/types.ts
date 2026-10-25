export type View = 'dashboard' | 'projects' | 'activity' | 'settings'

export type ProjectStatus = 'active' | 'planning' | 'paused' | 'completed'

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  technologies: string[]
  /** Rough completion estimate from 0 to 100. */
  progress: number
  repoUrl?: string
  /** Folder on this machine; synced activity from it is attributed to the project. */
  localPath?: string
  /**
   * Set when a sync created the project and the user hasn't edited it since. Such a
   * project disappears again if its folder drops out of the sync, unless it has
   * manual entries or actions.
   */
  autoCreated?: boolean
  createdAt: string
  updatedAt: string
}

/** The user-editable part of a project. */
export type ProjectDraft = Pick<
  Project,
  'name' | 'description' | 'status' | 'technologies' | 'progress' | 'repoUrl' | 'localPath'
>

export type ActivityKind = 'session' | 'commit' | 'deploy' | 'review' | 'milestone'

/** Where an activity entry came from. Entries without a source were added by hand. */
export type ActivitySource = 'manual' | 'claude-code' | 'codex' | 'git'

export type SyncedSource = Exclude<ActivitySource, 'manual'>

export interface ActivityEntry {
  id: string
  projectId: string
  kind: ActivityKind
  summary: string
  timestamp: string
  /** Only set for coding sessions. */
  durationMinutes?: number
  source?: ActivitySource
}

export type Priority = 'high' | 'medium' | 'low'

export interface NextAction {
  id: string
  title: string
  projectId?: string
  priority: Priority
  done: boolean
  createdAt: string
}

export type AccentColor = 'indigo' | 'violet' | 'teal' | 'amber' | 'rose'

export interface Settings {
  displayName: string
  weeklyGoalHours: number
  accent: AccentColor
}

// ---------- Sync payload ----------
// Produced by the collector (`npm run sync`, see collector/) from Claude Code, Codex
// and git on this machine. Activity is keyed by folder because the collector doesn't
// know the app's project ids; the app maps folders to projects when it applies a sync.

export interface SyncSourceStatus {
  source: SyncedSource
  available: boolean
  sessions?: number
  commits?: number
  repos?: number
  /** Human-readable detail: what was read, or why the source is unavailable. */
  note?: string
}

export interface SyncProject {
  path: string
  name: string
  description?: string
  technologies: string[]
  repoUrl?: string
  /** False when the folder no longer exists on disk but still has activity in the window. */
  exists: boolean
}

export interface SyncEntry {
  /** Stable across syncs, e.g. `claude:<sessionId>`, `codex:<threadId>:2`, `git:<sha>`. */
  id: string
  projectPath: string
  kind: 'session' | 'commit'
  source: SyncedSource
  summary: string
  timestamp: string
  durationMinutes?: number
}

export interface SyncPayload {
  version: 1
  syncedAt: string
  lookbackDays: number
  idleGapMinutes: number
  sources: SyncSourceStatus[]
  projects: SyncProject[]
  activity: SyncEntry[]
  /** Folders with activity that were left out: deleted from disk, or excluded in the config. */
  skippedFolders?: number
}

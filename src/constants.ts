import type {
  AccentColor,
  ActivityKind,
  ActivitySource,
  Priority,
  ProjectStatus,
  Settings,
  SyncedSource,
} from './types.ts'

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'active',
  'planning',
  'paused',
  'completed',
]

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  planning: 'Planning',
  paused: 'Paused',
  completed: 'Completed',
}

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'session',
  'commit',
  'deploy',
  'review',
  'milestone',
]

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  session: 'Sessions',
  commit: 'Commits',
  deploy: 'Deploys',
  review: 'Reviews',
  milestone: 'Milestones',
}

export const SYNCED_SOURCES: readonly SyncedSource[] = ['claude-code', 'codex', 'git']

export const ACTIVITY_SOURCES: readonly ActivitySource[] = ['manual', ...SYNCED_SOURCES]

export const SOURCE_LABELS: Record<ActivitySource, string> = {
  manual: 'Manual',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  git: 'git',
}

/** Accent values live in index.css under [data-accent]; this is just the list. */
export const ACCENT_OPTIONS: readonly { value: AccentColor; label: string }[] = [
  { value: 'indigo', label: 'Indigo' },
  { value: 'violet', label: 'Violet' },
  { value: 'teal', label: 'Teal' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
]

export const DEFAULT_SETTINGS: Settings = {
  displayName: 'Developer',
  weeklyGoalHours: 20,
  accent: 'indigo',
}

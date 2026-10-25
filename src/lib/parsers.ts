import {
  ACCENT_OPTIONS,
  ACTIVITY_KINDS,
  ACTIVITY_SOURCES,
  DEFAULT_SETTINGS,
  PRIORITIES,
  PROJECT_STATUSES,
  SYNCED_SOURCES,
} from '../constants.ts'
import type {
  ActivityEntry,
  NextAction,
  Project,
  Settings,
  SyncEntry,
  SyncPayload,
  SyncProject,
  SyncSourceStatus,
} from '../types.ts'

// Stored data can be stale, hand-edited or from an older version, so it is
// checked before use. Anything that doesn't match falls back to defaults.

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString)

const isOptional = (value: unknown, check: (value: unknown) => boolean) =>
  value === undefined || check(value)

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  options.includes(value as T)

function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.description) &&
    isOneOf(PROJECT_STATUSES, value.status) &&
    isStringList(value.technologies) &&
    isNumber(value.progress) &&
    isOptional(value.repoUrl, isString) &&
    isOptional(value.localPath, isString) &&
    isOptional(value.autoCreated, isBoolean) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function isActivityEntry(value: unknown): value is ActivityEntry {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.projectId) &&
    isOneOf(ACTIVITY_KINDS, value.kind) &&
    isString(value.summary) &&
    isString(value.timestamp) &&
    isOptional(value.durationMinutes, isNumber) &&
    isOptional(value.source, (source) => isOneOf(ACTIVITY_SOURCES, source))
  )
}

function isNextAction(value: unknown): value is NextAction {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isOptional(value.projectId, isString) &&
    isOneOf(PRIORITIES, value.priority) &&
    isBoolean(value.done) &&
    isString(value.createdAt)
  )
}

function listOf<T>(isItem: (value: unknown) => value is T) {
  return (value: unknown): T[] | undefined =>
    Array.isArray(value) && value.every(isItem) ? value : undefined
}

export const parseProjects = listOf(isProject)
export const parseActivity = listOf(isActivityEntry)
export const parseActions = listOf(isNextAction)
export const parseStringList = (value: unknown): string[] | undefined =>
  isStringList(value) ? value : undefined

/** Settings are merged field by field so one bad value doesn't wipe the rest. */
export function parseSettings(value: unknown): Settings | undefined {
  if (!isRecord(value)) return undefined
  const accents = ACCENT_OPTIONS.map((option) => option.value)
  return {
    displayName: isString(value.displayName)
      ? value.displayName
      : DEFAULT_SETTINGS.displayName,
    weeklyGoalHours:
      isNumber(value.weeklyGoalHours) && value.weeklyGoalHours > 0
        ? value.weeklyGoalHours
        : DEFAULT_SETTINGS.weeklyGoalHours,
    accent: isOneOf(accents, value.accent) ? value.accent : DEFAULT_SETTINGS.accent,
  }
}

// ---------- Sync payload ----------

function isSyncSourceStatus(value: unknown): value is SyncSourceStatus {
  return (
    isRecord(value) &&
    isOneOf(SYNCED_SOURCES, value.source) &&
    isBoolean(value.available) &&
    isOptional(value.sessions, isNumber) &&
    isOptional(value.commits, isNumber) &&
    isOptional(value.repos, isNumber) &&
    isOptional(value.note, isString)
  )
}

function isSyncProject(value: unknown): value is SyncProject {
  return (
    isRecord(value) &&
    isString(value.path) &&
    isString(value.name) &&
    isOptional(value.description, isString) &&
    isStringList(value.technologies) &&
    isOptional(value.repoUrl, isString) &&
    isBoolean(value.exists)
  )
}

function isSyncEntry(value: unknown): value is SyncEntry {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.projectPath) &&
    (value.kind === 'session' || value.kind === 'commit') &&
    isOneOf(SYNCED_SOURCES, value.source) &&
    isString(value.summary) &&
    isString(value.timestamp) &&
    isOptional(value.durationMinutes, isNumber)
  )
}

const parseSyncSources = listOf(isSyncSourceStatus)
const parseSyncProjects = listOf(isSyncProject)
const parseSyncEntries = listOf(isSyncEntry)

export function parseSyncPayload(value: unknown): SyncPayload | undefined {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isString(value.syncedAt) ||
    !isNumber(value.lookbackDays) ||
    !isNumber(value.idleGapMinutes) ||
    !isOptional(value.skippedFolders, isNumber)
  ) {
    return undefined
  }
  const sources = parseSyncSources(value.sources)
  const projects = parseSyncProjects(value.projects)
  const activity = parseSyncEntries(value.activity)
  if (!sources || !projects || !activity) return undefined
  return {
    version: 1,
    syncedAt: value.syncedAt,
    lookbackDays: value.lookbackDays,
    idleGapMinutes: value.idleGapMinutes,
    sources,
    projects,
    activity,
    skippedFolders: value.skippedFolders as number | undefined,
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

import type { ActivityEntry, NextAction, Project, SyncPayload } from '../types.ts'
import { createId } from './id.ts'
import { parseSyncPayload } from './parsers.ts'
import { pathKey } from './paths.ts'

const SYNC_FILE = '/data/sync.json'
const SYNC_ENDPOINT = '/api/sync'
/** A folder with no activity for this long starts out as a paused project. */
const STALE_AFTER_DAYS = 30

/** The payload written by `npm run sync`, or null when there has been no sync yet. */
export async function fetchSyncFile(): Promise<SyncPayload | null> {
  try {
    // Ask for JSON explicitly so the dev server's SPA fallback never answers with index.html.
    const response = await fetch(SYNC_FILE, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return null
    return parseSyncPayload(await response.json()) ?? null
  } catch {
    return null
  }
}

/** Asks the dev server to run the collector now. Only available under `npm run dev`. */
export async function requestSync(): Promise<SyncPayload> {
  const response = await fetch(SYNC_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' } })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Sync failed (${response.status})`
    throw new Error(message)
  }
  const payload = parseSyncPayload(body)
  if (!payload) throw new Error('The collector returned data in an unexpected shape')
  return payload
}

export interface MergeInput {
  projects: Project[]
  activity: ActivityEntry[]
  /** Used to decide whether an auto-created project is still in use. */
  actions?: NextAction[]
  /** Folders whose auto-created project was deleted; they are not recreated. */
  ignoredPaths: string[]
  payload: SyncPayload
  now: number
  makeId?: () => string
}

export interface MergeResult {
  projects: Project[]
  activity: ActivityEntry[]
  createdProjects: Project[]
  removedProjects: Project[]
}

/**
 * Applies a sync payload to the current data. Synced entries are matched to projects
 * by folder (`localPath`); unknown folders become new projects unless ignored. The
 * payload is authoritative for synced entries, so re-syncing updates them in place,
 * while entries added by hand are always kept. Projects a sync created and nobody
 * touched since are removed again once their folder leaves the sync.
 */
export function mergeSync(input: MergeInput): MergeResult {
  const { payload, now, makeId = createId, actions = [] } = input
  const nowIso = new Date(now).toISOString()
  const ignored = new Set(input.ignoredPaths.map(pathKey))
  const manual = input.activity.filter((entry) => !entry.source || entry.source === 'manual')

  const syncedFolders = new Set(payload.projects.map((folder) => pathKey(folder.path)))
  const inUse = (project: Project) =>
    manual.some((entry) => entry.projectId === project.id) ||
    actions.some((action) => action.projectId === project.id)
  const removedProjects = input.projects.filter(
    (project) =>
      project.autoCreated &&
      project.localPath &&
      !syncedFolders.has(pathKey(project.localPath)) &&
      !inUse(project),
  )
  const removedIds = new Set(removedProjects.map((project) => project.id))
  const kept = input.projects.filter((project) => !removedIds.has(project.id))

  const byPath = new Map<string, Project>()
  for (const project of kept) {
    if (project.localPath && !byPath.has(pathKey(project.localPath))) {
      byPath.set(pathKey(project.localPath), project)
    }
  }

  const createdProjects: Project[] = []
  for (const folder of payload.projects) {
    const key = pathKey(folder.path)
    if (byPath.has(key) || ignored.has(key)) continue
    const project: Project = {
      id: makeId(),
      name: folder.name,
      description: folder.description ?? '',
      status: 'active',
      technologies: folder.technologies,
      progress: 0,
      repoUrl: folder.repoUrl,
      localPath: folder.path,
      autoCreated: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    byPath.set(key, project)
    createdProjects.push(project)
  }

  const latestByProject = new Map<string, string>()
  const imported: ActivityEntry[] = []
  for (const entry of payload.activity) {
    const project = byPath.get(pathKey(entry.projectPath))
    if (!project) continue
    imported.push({
      id: entry.id,
      projectId: project.id,
      kind: entry.kind,
      summary: entry.summary,
      timestamp: entry.timestamp,
      durationMinutes: entry.durationMinutes,
      source: entry.source,
    })
    const latest = latestByProject.get(project.id)
    if (!latest || entry.timestamp > latest) latestByProject.set(project.id, entry.timestamp)
  }

  const staleBefore = new Date(now - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const touch = (project: Project, isNew: boolean): Project => {
    const latest = latestByProject.get(project.id)
    if (!latest) return project
    const updatedAt = latest > project.updatedAt || isNew ? latest : project.updatedAt
    const status = isNew && latest < staleBefore ? 'paused' : project.status
    return { ...project, updatedAt, status }
  }

  return {
    projects: [
      ...kept.map((project) => touch(project, false)),
      ...createdProjects.map((project) => touch(project, true)),
    ],
    activity: [...manual, ...imported.filter((entry) => !removedIds.has(entry.projectId))],
    createdProjects,
    removedProjects,
  }
}

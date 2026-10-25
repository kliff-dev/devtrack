import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../constants.ts'
import {
  SAMPLE_PROJECT_IDS,
  createSampleData,
  isSampleActionId,
  isSampleActivityId,
} from '../data/sampleData.ts'
import { useLocalStorage } from '../hooks/useLocalStorage.ts'
import { useNow } from '../hooks/useNow.ts'
import { createId } from '../lib/id.ts'
import {
  parseActions,
  parseActivity,
  parseProjects,
  parseSettings,
  parseStringList,
} from '../lib/parsers.ts'
import { pathKey } from '../lib/paths.ts'
import { mergeSync, requestSync } from '../lib/sync.ts'
import type { ActivityEntry, Project, SyncPayload } from '../types.ts'
import { DevTrackContext, type DevTrackStore, type SyncState } from './DevTrackContext.ts'

interface DevTrackProviderProps {
  /** The sync file loaded before first render, so real data is never mixed with the demo content. */
  initialSync: SyncPayload | null
  children: ReactNode
}

interface Base {
  projects: Project[]
  activity: ActivityEntry[]
}

export function DevTrackProvider({ initialSync, children }: DevTrackProviderProps) {
  const seedSamples = !initialSync || initialSync.activity.length === 0
  const [projects, setProjects] = useLocalStorage(
    'projects',
    () => (seedSamples ? createSampleData().projects : []),
    parseProjects,
  )
  const [activity, setActivity] = useLocalStorage(
    'activity',
    () => (seedSamples ? createSampleData().activity : []),
    parseActivity,
  )
  const [actions, setActions] = useLocalStorage(
    'actions',
    () => (seedSamples ? createSampleData().actions : []),
    parseActions,
  )
  const [settings, setSettings] = useLocalStorage(
    'settings',
    () => DEFAULT_SETTINGS,
    parseSettings,
  )
  const [ignoredPaths, setIgnoredPaths] = useLocalStorage<string[]>(
    'ignoredPaths',
    () => [],
    parseStringList,
  )
  const [sync, setSync] = useState<SyncState>({ payload: initialSync, status: 'idle' })
  const now = useNow()

  // Merging needs projects, activity and the ignore list together; a ref keeps the
  // latest values available to callbacks without re-creating them on every change.
  // It is refreshed after every render, before any handler or later effect can run.
  const latest = useRef({ projects, activity, ignoredPaths })
  useEffect(() => {
    latest.current = { projects, activity, ignoredPaths }
  })

  const applySync = useCallback(
    (payload: SyncPayload, base?: Base) => {
      const result = mergeSync({
        projects: base?.projects ?? latest.current.projects,
        activity: base?.activity ?? latest.current.activity,
        ignoredPaths: latest.current.ignoredPaths,
        payload,
        now: Date.now(),
      })
      setProjects(result.projects)
      setActivity(result.activity)
    },
    [setProjects, setActivity],
  )

  const appliedInitial = useRef<SyncPayload | null>(null)
  useEffect(() => {
    if (!initialSync || appliedInitial.current === initialSync) return
    appliedInitial.current = initialSync
    applySync(initialSync)
  }, [initialSync, applySync])

  const syncNow = useCallback(async () => {
    setSync((state) => ({ ...state, status: 'syncing', error: undefined }))
    try {
      const payload = await requestSync()
      applySync(payload)
      setSync({ payload, status: 'idle' })
    } catch (error) {
      setSync((state) => ({
        ...state,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }, [applySync])

  const store = useMemo<DevTrackStore>(
    () => ({
      now,
      projects,
      projectsById: new Map(projects.map((project) => [project.id, project])),
      activity,
      actions,
      settings,
      sync,
      canSyncNow: import.meta.env.DEV,
      ignoredPaths,
      hasSampleData:
        projects.some((project) => SAMPLE_PROJECT_IDS.has(project.id)) ||
        activity.some((entry) => isSampleActivityId(entry.id)) ||
        actions.some((action) => isSampleActionId(action.id)),

      saveProject(draft, id) {
        const timestamp = new Date().toISOString()
        const previous = id ? projects.find((project) => project.id === id) : undefined
        const nextProjects = id
          ? projects.map((project) =>
              project.id === id ? { ...project, ...draft, updatedAt: timestamp } : project,
            )
          : [{ ...draft, id: createId(), createdAt: timestamp, updatedAt: timestamp }, ...projects]
        setProjects(nextProjects)
        if (draft.localPath) {
          const key = pathKey(draft.localPath)
          setIgnoredPaths((list) => list.filter((item) => pathKey(item) !== key))
        }
        // Linking a folder claims its synced activity straight away, not on the next sync.
        if (sync.payload && (draft.localPath ?? '') !== (previous?.localPath ?? '')) {
          applySync(sync.payload, { projects: nextProjects, activity })
        }
      },

      deleteProject(id) {
        const project = projects.find((item) => item.id === id)
        // A folder-linked project would come straight back on the next sync.
        if (project?.localPath) {
          const path = project.localPath
          setIgnoredPaths((list) =>
            list.some((item) => pathKey(item) === pathKey(path)) ? list : [...list, path],
          )
        }
        setProjects((list) => list.filter((item) => item.id !== id))
        setActivity((list) => list.filter((entry) => entry.projectId !== id))
        setActions((list) => list.filter((action) => action.projectId !== id))
      },

      addAction(action) {
        const created = {
          ...action,
          id: createId(),
          done: false,
          createdAt: new Date().toISOString(),
        }
        setActions((list) => [created, ...list])
      },

      toggleAction(id) {
        setActions((list) =>
          list.map((action) => (action.id === id ? { ...action, done: !action.done } : action)),
        )
      },

      deleteAction(id) {
        setActions((list) => list.filter((action) => action.id !== id))
      },

      updateSettings(patch) {
        setSettings((current) => ({ ...current, ...patch }))
      },

      syncNow,

      unignorePath(path) {
        setIgnoredPaths((list) => list.filter((item) => pathKey(item) !== pathKey(path)))
      },

      removeSampleData() {
        setProjects((list) => list.filter((project) => !SAMPLE_PROJECT_IDS.has(project.id)))
        setActivity((list) =>
          list.filter(
            (entry) => !isSampleActivityId(entry.id) && !SAMPLE_PROJECT_IDS.has(entry.projectId),
          ),
        )
        setActions((list) =>
          list.filter(
            (action) =>
              !isSampleActionId(action.id) &&
              !(action.projectId && SAMPLE_PROJECT_IDS.has(action.projectId)),
          ),
        )
      },

      // Synced activity mirrors files on this machine, so resets keep it and only
      // replace what was added by hand.
      resetToSampleData() {
        const sample = createSampleData()
        setActions(sample.actions)
        if (sync.payload) applySync(sync.payload, { projects: sample.projects, activity: sample.activity })
        else {
          setProjects(sample.projects)
          setActivity(sample.activity)
        }
      },

      clearAllData() {
        setActions([])
        if (sync.payload) applySync(sync.payload, { projects: [], activity: [] })
        else {
          setProjects([])
          setActivity([])
        }
      },
    }),
    [
      now,
      projects,
      activity,
      actions,
      settings,
      sync,
      ignoredPaths,
      applySync,
      syncNow,
      setProjects,
      setActivity,
      setActions,
      setSettings,
      setIgnoredPaths,
    ],
  )

  return <DevTrackContext value={store}>{children}</DevTrackContext>
}

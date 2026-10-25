import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSyncPayload } from '../src/lib/parsers.ts'
import { mergeSync } from '../src/lib/sync.ts'
import type { ActivityEntry, Project, SyncPayload } from '../src/types.ts'

const NOW = Date.parse('2026-10-25T12:00:00Z')
const FOLDER = 'C:\\Users\\dev\\Projects\\app'

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'App',
  description: '',
  status: 'active',
  technologies: [],
  progress: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
})

const payload = (overrides: Partial<SyncPayload> = {}): SyncPayload => ({
  version: 1,
  syncedAt: new Date(NOW).toISOString(),
  lookbackDays: 90,
  idleGapMinutes: 30,
  sources: [{ source: 'claude-code', available: true, sessions: 1 }],
  projects: [{ path: FOLDER, name: 'app', technologies: ['React'], exists: true }],
  activity: [
    {
      id: 'claude:s1',
      projectPath: 'c:/users/dev/projects/app/', // same folder, different spelling
      kind: 'session',
      source: 'claude-code',
      summary: 'Build',
      timestamp: '2026-10-24T10:00:00.000Z',
      durationMinutes: 60,
    },
  ],
  ...overrides,
})

let counter = 0
const makeId = () => `id-${++counter}`

test('mergeSync creates projects for new folders and attributes entries by folder', () => {
  const result = mergeSync({ projects: [], activity: [], ignoredPaths: [], payload: payload(), now: NOW, makeId })
  assert.equal(result.createdProjects.length, 1)
  const [created] = result.projects
  assert.equal(created.localPath, FOLDER)
  assert.equal(created.status, 'active')
  assert.deepEqual(created.technologies, ['React'])
  assert.equal(created.updatedAt, '2026-10-24T10:00:00.000Z', 'updatedAt follows the latest entry')
  assert.equal(result.activity.length, 1)
  assert.equal(result.activity[0].projectId, created.id)
  assert.equal(result.activity[0].source, 'claude-code')
})

test('mergeSync matches existing projects by localPath regardless of case and slashes', () => {
  const existing = project({ localPath: 'c:/users/DEV/projects/app' })
  const result = mergeSync({ projects: [existing], activity: [], ignoredPaths: [], payload: payload(), now: NOW, makeId })
  assert.equal(result.createdProjects.length, 0)
  assert.equal(result.activity[0].projectId, 'p1')
  assert.equal(result.projects[0].updatedAt, '2026-10-24T10:00:00.000Z')
  assert.equal(result.projects[0].progress, 10, 'user-edited fields are untouched')
  assert.equal(result.projects[0].status, 'active')
})

test('mergeSync keeps manual entries and replaces synced ones', () => {
  const manual: ActivityEntry = { id: 'm1', projectId: 'p1', kind: 'deploy', summary: 'Shipped', timestamp: '2026-10-20T00:00:00.000Z' }
  const stale: ActivityEntry = { id: 'claude:old', projectId: 'p1', kind: 'session', summary: 'Old', timestamp: '2026-09-01T00:00:00.000Z', durationMinutes: 5, source: 'claude-code' }
  const result = mergeSync({
    projects: [project({ localPath: FOLDER })],
    activity: [manual, stale],
    ignoredPaths: [],
    payload: payload(),
    now: NOW,
    makeId,
  })
  assert.deepEqual(result.activity.map((entry) => entry.id), ['m1', 'claude:s1'])
})

test('mergeSync skips ignored folders and drops their entries', () => {
  const result = mergeSync({ projects: [], activity: [], ignoredPaths: ['C:/Users/dev/Projects/app'], payload: payload(), now: NOW, makeId })
  assert.equal(result.projects.length, 0)
  assert.equal(result.activity.length, 0)
})

test('mergeSync still attributes an ignored folder to a project that links it by hand', () => {
  const linked = project({ localPath: FOLDER })
  const result = mergeSync({ projects: [linked], activity: [], ignoredPaths: [FOLDER], payload: payload(), now: NOW, makeId })
  assert.equal(result.createdProjects.length, 0)
  assert.equal(result.activity[0].projectId, 'p1')
})

test('mergeSync starts quiet folders as paused', () => {
  const quiet = payload({
    activity: [{ id: 'git:abc', projectPath: FOLDER, kind: 'commit', source: 'git', summary: 'old', timestamp: '2026-08-01T00:00:00.000Z' }],
  })
  const result = mergeSync({ projects: [], activity: [], ignoredPaths: [], payload: quiet, now: NOW, makeId })
  assert.equal(result.projects[0].status, 'paused')
  assert.equal(result.projects[0].updatedAt, '2026-08-01T00:00:00.000Z')
})

test('parseSyncPayload accepts the real shape and rejects malformed data', () => {
  assert.ok(parseSyncPayload(JSON.parse(JSON.stringify(payload()))))
  assert.equal(parseSyncPayload(null), undefined)
  assert.equal(parseSyncPayload({ version: 2 }), undefined)
  assert.equal(parseSyncPayload({ ...payload(), activity: [{ id: 1 }] }), undefined)
  assert.equal(parseSyncPayload({ ...payload(), sources: [{ source: 'email', available: true }] }), undefined)
})

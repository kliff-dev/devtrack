import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SyncEntry } from '../src/types.ts'
import { displayPath, pathKey } from './paths.ts'
import {
  cleanPrompt,
  durationMinutes,
  splitSessions,
  type SessionSegment,
  type TimelineEvent,
} from './sessions.ts'
import { errorMessage, unavailable, type SourceResult } from './types.ts'

// The Codex app (and the CLI/IDE extension sharing ~/.codex) indexes every thread in
// SQLite. Reading it is far cheaper than parsing rollout JSONL files, which can run to
// gigabytes. The numeric suffix in the file names is a schema version, so the newest
// file of each kind is used. Both databases are opened read-only; Codex may be running.
//   state_N.sqlite          threads(id, cwd, title, name, first_user_message, source, …)
//   thread_history_N.sqlite thread_items(thread_id, created_at_ms, completed_at_ms, item_type, item_json)
//                           thread_turns(thread_id, started_at, completed_at)   ← seconds

interface ThreadRow {
  id: string
  cwd: string | null
  title: string | null
  name: string | null
  first_user_message: string | null
  git_origin_url: string | null
  source: string | null
  thread_source: string | null
}

interface ItemRow {
  thread_id: string
  created_at_ms: number | null
  completed_at_ms: number | null
  item_type: string | null
  item_json: string | null
}

interface TurnRow {
  thread_id: string
  started_at: number | null
  completed_at: number | null
}

interface CodexOptions {
  codexDir: string
  since: Date
  idleGapMs: number
}

function newestFile(dir: string, pattern: RegExp): string | undefined {
  let best: { version: number; name: string } | undefined
  for (const name of readdirSync(dir)) {
    const match = pattern.exec(name)
    if (!match) continue
    const version = Number(match[1])
    if (!best || version > best.version) best = { version, name }
  }
  return best ? join(dir, best.name) : undefined
}

/** Finds the first string under a `text` key, however the message is nested. */
function firstTextField(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value === null || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstTextField(item, depth + 1)
      if (found) return found
    }
    return undefined
  }
  const record = value as Record<string, unknown>
  if (typeof record.text === 'string' && record.text.trim()) return record.text
  for (const nested of Object.values(record)) {
    const found = firstTextField(nested, depth + 1)
    if (found) return found
  }
  return undefined
}

function userPrompt(itemJson: string | null): string | undefined {
  if (!itemJson) return undefined
  try {
    const text = firstTextField(JSON.parse(itemJson))
    return text ? cleanPrompt(text) : undefined
  } catch {
    return undefined
  }
}

function isUserThread(thread: ThreadRow, spawnedIds: Set<string>): boolean {
  if (!thread.cwd || spawnedIds.has(thread.id)) return false
  if (thread.thread_source === 'subagent' || thread.thread_source === 'guardian_review') return false
  // Spawned agents record their parent as a JSON object in `source`; user threads say "vscode" etc.
  return !(thread.source ?? '').trimStart().startsWith('{')
}

function toEntries(thread: ThreadRow, segments: SessionSegment[]): SyncEntry[] {
  // The app's own thread name is best; the stored title/first message are truncated copies
  // of the first prompt, so the segment's full prompt is preferred over them.
  const name = thread.name?.trim() || undefined
  const fallback =
    name ??
    cleanPrompt(thread.title ?? '') ??
    cleanPrompt(thread.first_user_message ?? '') ??
    'Codex session'
  return segments.map((segment, index) => ({
    id: index === 0 ? `codex:${thread.id}` : `codex:${thread.id}:${index + 1}`,
    projectPath: displayPath(thread.cwd!),
    kind: 'session',
    source: 'codex',
    summary:
      index === 0
        ? (name ?? segment.prompt ?? fallback)
        : (segment.prompt ?? `${fallback} (continued)`),
    timestamp: new Date(segment.start).toISOString(),
    durationMinutes: durationMinutes(segment),
  }))
}

export function collectCodex(options: CodexOptions): SourceResult {
  if (!existsSync(options.codexDir)) {
    return unavailable('codex', `No Codex folder at ${options.codexDir}`)
  }
  const statePath = newestFile(options.codexDir, /^state_(\d+)\.sqlite$/)
  const historyPath = newestFile(options.codexDir, /^thread_history_(\d+)\.sqlite$/)
  if (!statePath || !historyPath) {
    return unavailable('codex', `No thread database in ${options.codexDir} (needs a Codex version that stores threads in SQLite)`)
  }

  let state: DatabaseSync | undefined
  let history: DatabaseSync | undefined
  try {
    state = new DatabaseSync(statePath, { readOnly: true })
    history = new DatabaseSync(historyPath, { readOnly: true })

    const threads = state
      .prepare('SELECT id, cwd, title, name, first_user_message, git_origin_url, source, thread_source FROM threads')
      .all() as unknown as ThreadRow[]
    const spawnedIds = new Set(
      (state.prepare('SELECT child_thread_id FROM thread_spawn_edges').all() as unknown as { child_thread_id: string }[])
        .map((row) => row.child_thread_id),
    )
    const userThreads = threads.filter((thread) => isUserThread(thread, spawnedIds))

    const sinceMs = options.since.getTime()
    const items = history
      .prepare(
        `SELECT thread_id, created_at_ms, completed_at_ms, item_type,
                CASE WHEN item_type = 'userMessage' THEN item_json END AS item_json
         FROM thread_items WHERE created_at_ms >= ? OR completed_at_ms >= ?`,
      )
      .all(sinceMs, sinceMs) as unknown as ItemRow[]
    const turns = history
      .prepare('SELECT thread_id, started_at, completed_at FROM thread_turns WHERE started_at >= ? OR completed_at >= ?')
      .all(sinceMs / 1000, sinceMs / 1000) as unknown as TurnRow[]

    const eventsByThread = new Map<string, TimelineEvent[]>()
    const push = (threadId: string, event: TimelineEvent) => {
      const list = eventsByThread.get(threadId) ?? []
      list.push(event)
      eventsByThread.set(threadId, list)
    }
    for (const item of items) {
      if (item.created_at_ms) {
        push(item.thread_id, {
          time: item.created_at_ms,
          prompt: item.item_type === 'userMessage' ? userPrompt(item.item_json) : undefined,
        })
      }
      if (item.completed_at_ms) push(item.thread_id, { time: item.completed_at_ms })
    }
    for (const turn of turns) {
      if (turn.started_at) push(turn.thread_id, { time: turn.started_at * 1000 })
      if (turn.completed_at) push(turn.thread_id, { time: turn.completed_at * 1000 })
    }

    const entries: SyncEntry[] = []
    const repoUrls = new Map<string, string>()
    let activeThreads = 0
    for (const thread of userThreads) {
      const events = eventsByThread.get(thread.id)
      if (!events) continue
      const segments = splitSessions(events, options.idleGapMs)
      if (segments.length === 0) continue
      activeThreads += 1
      entries.push(...toEntries(thread, segments))
      if (thread.git_origin_url && thread.cwd) repoUrls.set(pathKey(thread.cwd), thread.git_origin_url)
    }

    return {
      status: {
        source: 'codex',
        available: true,
        sessions: entries.length,
        note: `${activeThreads} of ${userThreads.length} threads active in the lookback window`,
      },
      entries,
      repoUrls,
    }
  } catch (error) {
    return unavailable('codex', `Could not read the Codex database: ${errorMessage(error)}`)
  } finally {
    state?.close()
    history?.close()
  }
}

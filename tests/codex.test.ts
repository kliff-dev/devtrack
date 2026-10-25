import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { collectCodex } from '../collector/codex.ts'
import { displayPath, pathKey } from '../collector/paths.ts'

const T0 = Date.parse('2026-10-20T10:00:00Z')
const SINCE = new Date('2026-10-01T00:00:00Z')
const IDLE = 30 * 60_000
const CWD = '\\\\?\\C:\\Users\\dev\\Projects\\app'
const ms = (minutes: number) => T0 + minutes * 60_000
const userMessage = (text: string) =>
  JSON.stringify({ type: 'userMessage', content: [{ type: 'text', text }] })

/** A minimal copy of the Codex app's schema with one real thread, one named thread, and two spawned ones. */
function createCodexDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'devtrack-codex-'))

  const state = new DatabaseSync(join(dir, 'state_5.sqlite'))
  state.exec(`
    CREATE TABLE threads (id TEXT, cwd TEXT, title TEXT, name TEXT, first_user_message TEXT, git_origin_url TEXT, source TEXT, thread_source TEXT);
    CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT, status TEXT);
  `)
  const thread = state.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  // Title and first message are the truncated IDE preamble, as the app stores them.
  thread.run('t1', CWD, '# Context from my IDE setup:\n## Active file: a.ts', null, '# Context from my IDE setup:', 'git@github.com:dev/app.git', 'vscode', 'user')
  thread.run('t2', CWD, 'fix login', 'Fix login', 'fix login', null, 'vscode', null)
  thread.run('child', CWD, 'sub', null, null, null, '{"subagent":{"thread_spawn":{"parent_thread_id":"t2"}}}', 'subagent')
  thread.run('guard', CWD, 'review', null, null, null, '{"subagent":{"other":"guardian"}}', 'guardian_review')
  state.prepare('INSERT INTO thread_spawn_edges VALUES (?, ?, ?)').run('t2', 'child', 'open')
  state.close()

  const history = new DatabaseSync(join(dir, 'thread_history_1.sqlite'))
  history.exec(`
    CREATE TABLE thread_items (thread_id TEXT, created_at_ms INTEGER, completed_at_ms INTEGER, item_type TEXT, item_json TEXT);
    CREATE TABLE thread_turns (thread_id TEXT, started_at INTEGER, completed_at INTEGER);
  `)
  const item = history.prepare('INSERT INTO thread_items VALUES (?, ?, ?, ?, ?)')
  item.run('t1', ms(0), null, 'userMessage', userMessage('# Context from my IDE setup:\n## Active file: a.ts\n## My request for Codex:\nadd dark mode'))
  item.run('t1', ms(1), ms(15), 'commandExecution', null)
  item.run('t1', ms(16), null, 'agentMessage', null)
  item.run('t1', ms(120), null, 'userMessage', userMessage('and light mode'))
  item.run('t1', ms(125), null, 'agentMessage', null)
  item.run('t2', ms(0), null, 'userMessage', JSON.stringify({ content: [{ text: 'fix login' }] }))
  item.run('t2', ms(3), null, 'agentMessage', null)
  item.run('child', ms(0), ms(60), 'commandExecution', null)
  item.run('guard', ms(0), ms(30), 'agentMessage', null)
  // Turn timings are in seconds and extend the second thread to five minutes.
  history.prepare('INSERT INTO thread_turns VALUES (?, ?, ?)').run('t2', Math.floor(ms(0) / 1000), Math.floor(ms(5) / 1000))
  history.close()

  return dir
}

test('collectCodex reads user threads from the app database', () => {
  const dir = createCodexDir()
  try {
    const result = collectCodex({ codexDir: dir, since: SINCE, idleGapMs: IDLE })
    assert.equal(result.status.available, true, result.status.note)
    const byId = Object.fromEntries(result.entries.map((entry) => [entry.id, entry]))
    assert.deepEqual(Object.keys(byId).sort(), ['codex:t1', 'codex:t1:2', 'codex:t2'], 'spawned and guardian threads are skipped')

    assert.equal(byId['codex:t1'].summary, 'add dark mode', 'the full prompt beats the truncated title')
    assert.equal(byId['codex:t1'].durationMinutes, 16)
    assert.equal(byId['codex:t1'].timestamp, new Date(ms(0)).toISOString())
    assert.equal(byId['codex:t1'].projectPath, displayPath('C:\\Users\\dev\\Projects\\app'), 'long-path prefix is stripped')
    assert.equal(byId['codex:t1'].source, 'codex')

    assert.equal(byId['codex:t1:2'].summary, 'and light mode')
    assert.equal(byId['codex:t1:2'].durationMinutes, 5)

    assert.equal(byId['codex:t2'].summary, 'Fix login', 'the thread name wins when present')
    assert.equal(byId['codex:t2'].durationMinutes, 5, 'turn completion extends the session')

    assert.equal(result.repoUrls?.get(pathKey('C:\\Users\\dev\\Projects\\app')), 'git@github.com:dev/app.git')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('collectCodex is unavailable without the thread database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devtrack-codex-empty-'))
  try {
    const result = collectCodex({ codexDir: dir, since: SINCE, idleGapMs: IDLE })
    assert.equal(result.status.available, false)
    assert.match(result.status.note ?? '', /No thread database/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('collectCodex reports a schema it cannot read instead of throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devtrack-codex-broken-'))
  try {
    new DatabaseSync(join(dir, 'state_9.sqlite')).close()
    new DatabaseSync(join(dir, 'thread_history_3.sqlite')).close()
    const result = collectCodex({ codexDir: dir, since: SINCE, idleGapMs: IDLE })
    assert.equal(result.status.available, false)
    assert.match(result.status.note ?? '', /Could not read/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

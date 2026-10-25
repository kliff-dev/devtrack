import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { FileCache } from '../collector/cache.ts'
import { collectClaudeCode, type ParsedTranscript } from '../collector/claudeCode.ts'
import { displayPath } from '../collector/paths.ts'

const T0 = Date.parse('2026-10-20T09:00:00Z')
const SINCE = new Date('2026-10-01T00:00:00Z')
const IDLE = 30 * 60_000
const CWD = 'C:\\Users\\dev\\Projects\\app'

const line = (minutes: number, record: object) =>
  JSON.stringify({ timestamp: new Date(T0 + minutes * 60_000).toISOString(), ...record })
const user = (minutes: number, content: unknown, extra: object = {}) =>
  line(minutes, { type: 'user', cwd: CWD, message: { role: 'user', content }, ...extra })
const assistant = (minutes: number, extra: object = {}) =>
  line(minutes, {
    type: 'assistant',
    cwd: CWD.replace('C:', 'c:'), // Claude Code alternates drive-letter case within a session.
    message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ...extra,
  })

function writeTranscripts(claudeDir: string): string {
  const folder = join(claudeDir, 'projects', 'c--Users-dev-Projects-app')
  mkdirSync(join(folder, 'abc', 'subagents'), { recursive: true })
  const transcript = join(folder, 'abc.jsonl')
  writeFileSync(
    transcript,
    [
      JSON.stringify({ type: 'file-history-snapshot', messageId: 'x' }),
      user(0, 'Build the app'),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Early title', sessionId: 'abc' }),
      assistant(1),
      user(2, [{ type: 'tool_result', tool_use_id: 't1', content: 'done' }]),
      assistant(20),
      JSON.stringify({ type: 'ai-title', aiTitle: 'App foundation', sessionId: 'abc' }),
      user(25, 'thanks', { isMeta: true }),
      user(200, '<system-reminder>x</system-reminder>\nNow add tests'),
      assistant(230),
      user(231, 'sidechain', { isSidechain: true }),
      '{"type":"user","truncated line still being writ',
    ].join('\n') + '\n',
  )
  // Nested subagent transcripts overlap the parent session and must be ignored.
  writeFileSync(
    join(folder, 'abc', 'subagents', 'agent-1.jsonl'),
    [user(0, 'subagent work'), assistant(500)].join('\n'),
  )
  return transcript
}

test('collectClaudeCode turns transcripts into idle-split sessions', async () => {
  const base = mkdtempSync(join(tmpdir(), 'devtrack-claude-'))
  try {
    writeTranscripts(base)
    const result = await collectClaudeCode({ claudeDir: base, since: SINCE, idleGapMs: IDLE })
    assert.equal(result.status.available, true)
    assert.equal(result.status.sessions, 2)
    assert.equal(result.entries.length, 2)

    const [first, second] = result.entries
    assert.equal(first.id, 'claude:abc')
    assert.equal(first.summary, 'App foundation', 'the last ai-title wins')
    assert.equal(first.timestamp, new Date(T0).toISOString())
    assert.equal(first.durationMinutes, 25, 'meta prompts still count as activity; the sidechain line does not')
    assert.equal(first.projectPath, displayPath(CWD))
    assert.equal(first.source, 'claude-code')

    assert.equal(second.id, 'claude:abc:2')
    assert.equal(second.summary, 'Now add tests', 'later segments are named after their first prompt')
    assert.equal(second.durationMinutes, 30)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('collectClaudeCode reports a missing transcripts folder', async () => {
  const result = await collectClaudeCode({
    claudeDir: join(tmpdir(), `devtrack-missing-${Date.now()}`),
    since: SINCE,
    idleGapMs: IDLE,
  })
  assert.equal(result.status.available, false)
  assert.equal(result.entries.length, 0)
})

test('the transcript cache serves unchanged files and misses changed ones', async () => {
  const base = mkdtempSync(join(tmpdir(), 'devtrack-claude-cache-'))
  try {
    const transcript = writeTranscripts(base)
    const cacheFile = join(base, 'cache.json')
    const cache = new FileCache<ParsedTranscript>(cacheFile, 1)
    const first = await collectClaudeCode({ claudeDir: base, since: SINCE, idleGapMs: IDLE, cache })
    cache.save()

    const reloaded = new FileCache<ParsedTranscript>(cacheFile, 1)
    const { size, mtimeMs } = statSync(transcript)
    assert.ok(reloaded.get(transcript, size, mtimeMs), 'a saved cache survives a reload')
    assert.equal(reloaded.get(transcript, size + 1, mtimeMs), undefined, 'a changed file misses')
    assert.equal(new FileCache<ParsedTranscript>(cacheFile, 2).get(transcript, size, mtimeMs), undefined, 'a version bump invalidates')

    const second = await collectClaudeCode({ claudeDir: base, since: SINCE, idleGapMs: IDLE, cache: reloaded })
    assert.deepEqual(second.entries, first.entries)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

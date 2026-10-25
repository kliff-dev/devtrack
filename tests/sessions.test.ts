import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanPrompt, durationMinutes, splitSessions, truncate } from '../collector/sessions.ts'

const MINUTE = 60_000
const at = (minutes: number, prompt?: string) =>
  prompt ? { time: minutes * MINUTE, prompt } : { time: minutes * MINUTE }

test('splitSessions splits at idle gaps and drops sub-minute segments', () => {
  const segments = splitSessions(
    [at(0, 'start'), at(5), at(12), at(60, 'later'), at(61), at(200)],
    30 * MINUTE,
  )
  assert.deepEqual(
    segments.map((s) => [s.start / MINUTE, s.end / MINUTE, s.events, s.prompt]),
    [
      [0, 12, 3, 'start'],
      [60, 61, 2, 'later'],
    ],
  )
})

test('splitSessions sorts unordered events and ignores invalid times', () => {
  const segments = splitSessions([at(10), { time: NaN }, at(0, 'first'), at(3)], 30 * MINUTE)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].start, 0)
  assert.equal(segments[0].end, 10 * MINUTE)
  assert.equal(segments[0].prompt, 'first')
})

test('durationMinutes rounds to whole minutes and never reports zero', () => {
  assert.equal(durationMinutes({ start: 0, end: 90 * 1000, events: 2 }), 2)
  assert.equal(durationMinutes({ start: 0, end: 61 * 1000, events: 2 }), 1)
  assert.equal(durationMinutes({ start: 0, end: 20 * 1000, events: 2 }), 1)
})

test('cleanPrompt strips injected tags and keeps pasted content', () => {
  const raw =
    '<system-reminder>\nignore me\n</system-reminder>\n<pasted_content id="1">Build the thing.\nMore lines.</pasted_content id="1">'
  assert.equal(cleanPrompt(raw), 'Build the thing.')
})

test('cleanPrompt drops command wrappers and returns undefined for pure chrome', () => {
  assert.equal(
    cleanPrompt(
      '<command-name>/model</command-name>\n<local-command-stdout>Set model</local-command-stdout>\nHow should we build it?',
    ),
    'How should we build it?',
  )
  assert.equal(cleanPrompt('<command-name>/clear</command-name>'), undefined)
  assert.equal(cleanPrompt('   \n  '), undefined)
})

test('cleanPrompt extracts the request from a Codex IDE preamble', () => {
  const raw =
    '# Context from my IDE setup:\n## Active file: a.ts\n## Open tabs:\n- b.ts\n## My request for Codex:\nfix the login bug\nplease'
  assert.equal(cleanPrompt(raw), 'fix the login bug')
  assert.equal(cleanPrompt('# Context from my IDE setup:\n## Active file: a.ts'), undefined)
})

test('cleanPrompt collapses whitespace and truncates', () => {
  assert.equal(cleanPrompt('  hello    world  '), 'hello world')
  const long = 'word '.repeat(40).trim()
  const cleaned = cleanPrompt(long)
  assert.ok(cleaned && cleaned.length <= 100 && cleaned.endsWith('…'))
})

test('truncate cuts at a word boundary with an ellipsis', () => {
  assert.equal(truncate('short', 10), 'short')
  const cut = truncate('Can you make a better design for the vocabulary practice lab and tell me the approach', 40)
  assert.ok(cut.length <= 40, cut)
  assert.ok(cut.endsWith('…'))
  assert.ok(!cut.includes(' …'), 'no space before the ellipsis')
})

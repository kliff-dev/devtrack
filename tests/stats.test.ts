import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codingMinutesBySource, currentStreak, dailyCodingTotals, groupByDay, longestStreak } from '../src/lib/stats.ts'
import type { ActivityEntry, ActivitySource } from '../src/types.ts'

// Dates are built in local time because the stats bucket by local calendar day.
const local = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute)

const session = (id: string, start: Date, minutes: number, source?: ActivitySource): ActivityEntry => ({
  id,
  projectId: 'p',
  kind: 'session',
  summary: id,
  timestamp: start.toISOString(),
  durationMinutes: minutes,
  source,
})

test('dailyCodingTotals counts overlapping sessions once and splits at midnight', () => {
  const now = local(10, 25, 12).getTime()
  const activity = [
    session('a', local(10, 24, 10), 60, 'claude-code'),
    session('b', local(10, 24, 10, 30), 60, 'codex'), // overlaps "a" by 30 min: union is 10:00–11:30
    session('c', local(10, 24, 23, 30), 60), // 23:30–00:30 straddles midnight
    { id: 'commit', projectId: 'p', kind: 'commit' as const, summary: 'x', timestamp: local(10, 24, 9).toISOString() },
  ]
  const days = dailyCodingTotals(activity, 2, now)
  assert.deepEqual(days.map((day) => day.minutes), [120, 30])
  assert.equal(days[1].key, '2026-10-25')
})

test('codingMinutesBySource sums each tool separately', () => {
  const activity = [
    session('a', local(10, 24, 10), 60, 'claude-code'),
    session('b', local(10, 24, 10, 30), 60, 'codex'),
    session('old', local(9, 1, 10), 60, 'codex'),
    session('hand', local(10, 24, 15), 20),
  ]
  const totals = codingMinutesBySource(activity, local(10, 20, 0))
  assert.deepEqual([...totals].sort(), [['claude-code', 60], ['codex', 60], ['manual', 20]])
})

test('streaks follow days with sessions', () => {
  const now = local(10, 25, 12).getTime()
  const activity = [
    session('a', local(10, 25, 9), 30),
    session('b', local(10, 24, 9), 30),
    session('c', local(10, 21, 9), 30),
    session('d', local(10, 20, 9), 30),
    session('e', local(10, 19, 9), 30),
  ]
  assert.equal(currentStreak(activity, now), 2)
  assert.equal(longestStreak(activity), 3)
})

test('a streak survives a day that has not had a session yet', () => {
  const now = local(10, 25, 8).getTime()
  assert.equal(currentStreak([session('a', local(10, 24, 9), 30)], now), 1)
  assert.equal(currentStreak([session('a', local(10, 23, 9), 30)], now), 0)
})

test('groupByDay orders newest first with that day’s coding minutes', () => {
  const groups = groupByDay([
    session('a', local(10, 23, 9), 30),
    session('b', local(10, 24, 9), 45),
    session('c', local(10, 24, 9, 15), 45), // overlaps "b": union 9:00–10:00
  ])
  assert.deepEqual(groups.map((group) => [group.key, group.minutes, group.entries.map((entry) => entry.id)]), [
    ['2026-10-24', 60, ['c', 'b']],
    ['2026-10-23', 30, ['a']],
  ])
})

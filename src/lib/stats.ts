import type { ActivityEntry, ActivitySource } from '../types.ts'
import { calendarDaysBetween, dayKey, startOfDay } from './format.ts'

export interface DayTotal {
  key: string
  date: Date
  minutes: number
}

export interface DayGroup {
  key: string
  date: Date
  minutes: number
  entries: ActivityEntry[]
}

interface Interval {
  start: number
  end: number
}

export function latestFirst(entries: ActivityEntry[]): ActivityEntry[] {
  return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/** Session time ranges with overlaps merged, so two tools used at once count once. */
function sessionIntervals(activity: ActivityEntry[]): Interval[] {
  const intervals: Interval[] = []
  for (const entry of activity) {
    if (entry.kind !== 'session' || !entry.durationMinutes) continue
    const start = new Date(entry.timestamp).getTime()
    if (!Number.isFinite(start)) continue
    intervals.push({ start, end: start + entry.durationMinutes * 60_000 })
  }
  intervals.sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

/** Coding minutes per local calendar day; a session that crosses midnight is split between both days. */
function sessionMinutesByDay(activity: ActivityEntry[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const { start, end } of sessionIntervals(activity)) {
    let cursor = start
    while (cursor < end) {
      const day = startOfDay(cursor)
      const nextDay = new Date(day)
      nextDay.setDate(day.getDate() + 1)
      const stop = Math.min(end, nextDay.getTime())
      const key = dayKey(day)
      totals.set(key, (totals.get(key) ?? 0) + (stop - cursor) / 60_000)
      cursor = stop
    }
  }
  return totals
}

/** Coding minutes for each of the last `days` days, oldest first, ending today. */
export function dailyCodingTotals(
  activity: ActivityEntry[],
  days: number,
  now: number,
): DayTotal[] {
  const totals = sessionMinutesByDay(activity)
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - index))
    const key = dayKey(date)
    return { key, date, minutes: Math.round(totals.get(key) ?? 0) }
  })
}

export function sumMinutes(days: DayTotal[]): number {
  return days.reduce((total, day) => total + day.minutes, 0)
}

function sessionMinutesSince(activity: ActivityEntry[], since: Date, keyOf: (entry: ActivityEntry) => string) {
  const totals = new Map<string, number>()
  const sinceIso = since.toISOString()
  for (const entry of activity) {
    if (entry.kind !== 'session' || !entry.durationMinutes) continue
    if (entry.timestamp < sinceIso) continue
    const key = keyOf(entry)
    totals.set(key, (totals.get(key) ?? 0) + entry.durationMinutes)
  }
  return totals
}

export function codingMinutesByProject(activity: ActivityEntry[], since: Date): Map<string, number> {
  return sessionMinutesSince(activity, since, (entry) => entry.projectId)
}

/** Session minutes per tool. Unlike the daily totals these are plain sums, so overlapping tools both get credit. */
export function codingMinutesBySource(
  activity: ActivityEntry[],
  since: Date,
): Map<ActivitySource, number> {
  return sessionMinutesSince(activity, since, (entry) => entry.source ?? 'manual') as Map<
    ActivitySource,
    number
  >
}

/** Consecutive days with a coding session. A streak survives until today is over. */
export function currentStreak(activity: ActivityEntry[], now: number): number {
  const totals = sessionMinutesByDay(activity)
  const cursor = startOfDay(now)
  if (!totals.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (totals.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function longestStreak(activity: ActivityEntry[]): number {
  const keys = [...sessionMinutesByDay(activity).keys()].sort()
  let best = 0
  let run = 0
  let previous: Date | undefined
  for (const key of keys) {
    const [year, month, day] = key.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    run = previous && calendarDaysBetween(previous, date) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }
  return best
}

/** Groups entries (newest first) by the local day they started, with that day's coding minutes. */
export function groupByDay(entries: ActivityEntry[]): DayGroup[] {
  const minutesByDay = sessionMinutesByDay(entries)
  const groups = new Map<string, DayGroup>()
  for (const entry of latestFirst(entries)) {
    const date = new Date(entry.timestamp)
    const key = dayKey(date)
    let group = groups.get(key)
    if (!group) {
      group = { key, date: startOfDay(date), minutes: Math.round(minutesByDay.get(key) ?? 0), entries: [] }
      groups.set(key, group)
    }
    group.entries.push(entry)
  }
  return [...groups.values()]
}

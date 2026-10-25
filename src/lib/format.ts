const LOCALE = 'en'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
const shortDateFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' })
const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const longDateFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' })
const narrowWeekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' })

export function startOfDay(value: Date | number): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Local calendar date as YYYY-MM-DD, used to bucket entries by day. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Whole calendar days from `from` to `to` (rounding absorbs DST shifts). */
export function calendarDaysBetween(from: Date | number, to: Date | number): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)
}

export function formatRelative(iso: string, now: number): string {
  const time = new Date(iso).getTime()
  const diff = time - now
  const abs = Math.abs(diff)
  if (abs < MINUTE) return 'just now'
  if (abs < HOUR) return relativeFormat.format(Math.round(diff / MINUTE), 'minute')
  if (abs < DAY) return relativeFormat.format(Math.round(diff / HOUR), 'hour')
  const days = calendarDaysBetween(now, time)
  if (Math.abs(days) < 7) return relativeFormat.format(days, 'day')
  return shortDateFormat.format(time)
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total <= 0) return '0m'
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function formatDayHeading(date: Date, now: number): string {
  const days = calendarDaysBetween(date, now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return dayFormat.format(date)
}

export const formatDayLabel = (date: Date) => dayFormat.format(date)
export const formatLongDate = (value: Date | number) => longDateFormat.format(value)
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))
export const formatWeekdayNarrow = (date: Date) => narrowWeekdayFormat.format(date)

export function greeting(now: number): string {
  const hour = new Date(now).getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Percentage change from `previous` to `current`, or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

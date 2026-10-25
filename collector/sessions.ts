export interface TimelineEvent {
  /** Milliseconds since the epoch. */
  time: number
  /** Set when the event is a prompt the user typed. */
  prompt?: string
}

export interface SessionSegment {
  start: number
  end: number
  events: number
  /** The first prompt typed during this segment. */
  prompt?: string
}

/**
 * Splits a stream of timestamps into sessions wherever the gap between two
 * events exceeds `idleGapMs`. A tool left open overnight therefore yields two
 * sessions, not one 14-hour one. Segments shorter than `minDurationMs` (a
 * single prompt with an instant answer) are dropped.
 */
export function splitSessions(
  events: TimelineEvent[],
  idleGapMs: number,
  minDurationMs = 60_000,
): SessionSegment[] {
  const sorted = events.filter((event) => Number.isFinite(event.time)).sort((a, b) => a.time - b.time)
  const segments: SessionSegment[] = []
  let current: SessionSegment | undefined
  for (const event of sorted) {
    if (!current || event.time - current.end > idleGapMs) {
      current = { start: event.time, end: event.time, events: 0 }
      segments.push(current)
    }
    current.end = event.time
    current.events += 1
    if (event.prompt && !current.prompt) current.prompt = event.prompt
  }
  return segments.filter((segment) => segment.end - segment.start >= minDurationMs)
}

export function durationMinutes(segment: SessionSegment): number {
  return Math.max(1, Math.round((segment.end - segment.start) / 60_000))
}

// Both tools wrap injected context in XML-ish tags (<system-reminder>, <command-name>,
// <environment_context>…). Pasted content is the user's own text, so its body is kept.
const PASTED_BLOCK = /<(pasted_content)\b[^>]*>([\s\S]*?)<\/\1\b[^>]*>/g
const TAG_BLOCK = /<([a-zA-Z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/g
const LONE_TAG = /<\/?[a-zA-Z][\w:-]*\b[^>]*>/g
// The Codex IDE extension prepends "# Context from my IDE setup:" (open files, tabs)
// and puts what the user typed under a "My request" heading. Text that has the
// preamble but not the heading (Codex truncates stored titles) is context only.
const IDE_PREAMBLE = /^\s*#\s*Context from my IDE setup/i
const IDE_REQUEST_HEADING = /^#{1,3}\s*My request for Codex:?\s*$/im

/** The first meaningful line of a prompt, without injected context, cut to a summary length. */
export function cleanPrompt(raw: string, maxLength = 100): string | undefined {
  const request = IDE_REQUEST_HEADING.exec(raw)
  if (!request && IDE_PREAMBLE.test(raw)) return undefined
  const own = request ? raw.slice(request.index + request[0].length) : raw
  const text = own.replace(PASTED_BLOCK, '$2').replace(TAG_BLOCK, ' ').replace(LONE_TAG, ' ')
  const line = text
    .split('\n')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .find((part) => part.length > 0)
  return line ? truncate(line, maxLength) : undefined
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength - 1)
  const space = cut.lastIndexOf(' ')
  return (space > maxLength * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…'
}

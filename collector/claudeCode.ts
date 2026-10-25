import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'
import type { SyncEntry } from '../src/types.ts'
import type { FileCache } from './cache.ts'
import { displayPath, pathKey } from './paths.ts'
import { cleanPrompt, durationMinutes, splitSessions, type TimelineEvent } from './sessions.ts'
import { errorMessage, unavailable, type SourceResult } from './types.ts'

// Claude Code writes one JSONL transcript per session to ~/.claude/projects/<folder slug>/.
// Subagent transcripts live in nested folders and overlap the parent session, so only
// top-level files count. Lines of interest:
//   {"type":"user"|"assistant","timestamp":"…","cwd":"…","isMeta":…,"isSidechain":…,"message":{…}}
//   {"type":"ai-title","aiTitle":"…"}   (rewritten as the conversation evolves; the last one wins)

interface ContentBlock {
  type?: string
  text?: string
}

interface TranscriptLine {
  type?: string
  timestamp?: string
  cwd?: string
  isMeta?: boolean
  isSidechain?: boolean
  aiTitle?: string
  message?: { content?: string | ContentBlock[] }
}

/** What a transcript boils down to; cached between runs because the file rarely changes. */
export interface ParsedTranscript {
  cwd?: string
  title?: string
  events: TimelineEvent[]
}

interface ClaudeCodeOptions {
  claudeDir: string
  since: Date
  idleGapMs: number
  cache?: FileCache<ParsedTranscript>
}

const RELEVANT = ['"type":"user"', '"type":"assistant"', '"type":"ai-title"']

function promptText(content: string | ContentBlock[] | undefined): string | undefined {
  if (typeof content === 'string') return cleanPrompt(content)
  if (!Array.isArray(content)) return undefined
  if (content.some((block) => block?.type === 'tool_result')) return undefined
  const text = content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
  return text ? cleanPrompt(text) : undefined
}

async function parseTranscript(file: string): Promise<ParsedTranscript> {
  const events: TimelineEvent[] = []
  const cwdCounts = new Map<string, { path: string; count: number }>()
  let title: string | undefined

  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) {
    // Cheap pre-filter: most bytes are API request blobs and tool results we never need.
    if (!RELEVANT.some((marker) => line.includes(marker))) continue
    let record: TranscriptLine
    try {
      record = JSON.parse(line) as TranscriptLine
    } catch {
      continue // A line still being written, or not JSON.
    }
    if (record.type === 'ai-title') {
      if (typeof record.aiTitle === 'string' && record.aiTitle.trim()) title = record.aiTitle.trim()
      continue
    }
    if ((record.type !== 'user' && record.type !== 'assistant') || record.isSidechain) continue
    const time = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : NaN
    if (!Number.isFinite(time)) continue
    if (typeof record.cwd === 'string' && record.cwd) {
      const key = pathKey(record.cwd)
      const seen = cwdCounts.get(key) ?? { path: displayPath(record.cwd), count: 0 }
      seen.count += 1
      cwdCounts.set(key, seen)
    }
    const prompt = record.type === 'user' && !record.isMeta ? promptText(record.message?.content) : undefined
    events.push(prompt ? { time, prompt } : { time })
  }

  // Claude Code records the directory per message and it drifts into subfolders; the
  // most common one is the session's real working directory.
  let cwd: string | undefined
  let best = 0
  for (const seen of cwdCounts.values()) {
    if (seen.count > best) {
      best = seen.count
      cwd = seen.path
    }
  }
  return { cwd, title, events }
}

function toEntries(sessionId: string, transcript: ParsedTranscript, idleGapMs: number): SyncEntry[] {
  const { cwd, title } = transcript
  if (!cwd) return []
  return splitSessions(transcript.events, idleGapMs).map((segment, index) => {
    const continued = title ? `${title} (continued)` : 'Claude Code session'
    const summary =
      index === 0
        ? (title ?? segment.prompt ?? 'Claude Code session')
        : (segment.prompt ?? continued)
    return {
      id: index === 0 ? `claude:${sessionId}` : `claude:${sessionId}:${index + 1}`,
      projectPath: cwd,
      kind: 'session',
      source: 'claude-code',
      summary,
      timestamp: new Date(segment.start).toISOString(),
      durationMinutes: durationMinutes(segment),
    }
  })
}

export async function collectClaudeCode(options: ClaudeCodeOptions): Promise<SourceResult> {
  const projectsDir = join(options.claudeDir, 'projects')
  if (!existsSync(projectsDir)) {
    return unavailable('claude-code', `No transcripts folder at ${projectsDir}`)
  }

  const entries: SyncEntry[] = []
  let transcripts = 0
  let folders = 0
  const sinceMs = options.since.getTime()

  try {
    for (const folder of readdirSync(projectsDir, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue
      const folderPath = join(projectsDir, folder.name)
      let used = false
      for (const file of readdirSync(folderPath, { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith('.jsonl')) continue
        const filePath = join(folderPath, file.name)
        const { size, mtimeMs } = statSync(filePath)
        if (mtimeMs < sinceMs) continue // Finished before the lookback window.
        transcripts += 1
        used = true
        let parsed = options.cache?.get(filePath, size, mtimeMs)
        if (!parsed) {
          parsed = await parseTranscript(filePath)
          options.cache?.set(filePath, size, mtimeMs, parsed)
        }
        entries.push(...toEntries(basename(file.name, '.jsonl'), parsed, options.idleGapMs))
      }
      if (used) folders += 1
    }
  } catch (error) {
    return unavailable('claude-code', `Could not read transcripts: ${errorMessage(error)}`)
  }

  return {
    status: {
      source: 'claude-code',
      available: true,
      sessions: entries.length,
      note: `${transcripts} transcript${transcripts === 1 ? '' : 's'} in ${folders} project folder${folders === 1 ? '' : 's'}`,
    },
    entries,
  }
}
